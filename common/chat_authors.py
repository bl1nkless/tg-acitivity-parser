from __future__ import annotations

import uuid
from datetime import UTC, datetime, timedelta
from typing import Any

from sqlalchemy import Select, and_, func, or_, select, update
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from .models import (
    AccountUser,
    AuditLog,
    ChatAuthorJobStatus,
    TelegramChat,
    TelegramChatActiveAuthor,
    TelegramChatAuthorJob,
    TelegramUser,
)


def utcnow() -> datetime:
    return datetime.now(UTC)


async def audit(
    session: AsyncSession,
    *,
    actor_id: int | None,
    action: str,
    entity: str,
    entity_id: str | None,
    payload: dict[str, Any] | None = None,
) -> None:
    session.add(
        AuditLog(
            actor_id=actor_id,
            action=action,
            entity=entity,
            entity_id=entity_id,
            created_at=utcnow(),
            payload=payload,
        )
    )


async def upsert_chat(
    session: AsyncSession,
    *,
    telegram_chat_id: int,
    access_hash: int | None,
    username: str | None,
    title: str | None,
    chat_type: str,
) -> TelegramChat:
    now = utcnow()
    stmt = (
        insert(TelegramChat)
        .values(
            telegram_chat_id=telegram_chat_id,
            access_hash=access_hash,
            username=username,
            title=title,
            chat_type=chat_type,
            is_active=True,
            created_at=now,
            updated_at=now,
        )
        .on_conflict_do_update(
            index_elements=[TelegramChat.telegram_chat_id],
            set_={
                "access_hash": access_hash,
                "username": username,
                "title": title,
                "chat_type": chat_type,
                "is_active": True,
                "updated_at": now,
            },
        )
        .returning(TelegramChat)
    )
    return (await session.execute(stmt)).scalar_one()


async def get_chat(session: AsyncSession, telegram_chat_id: int) -> TelegramChat | None:
    stmt = select(TelegramChat).where(TelegramChat.telegram_chat_id == telegram_chat_id)
    return (await session.execute(stmt)).scalar_one_or_none()


async def create_job(
    session: AsyncSession,
    *,
    telegram_chat_id: int,
    requested_by: AccountUser | None,
    lookback_days: int,
) -> TelegramChatAuthorJob:
    now = utcnow()
    period_end = now
    period_start = period_end - timedelta(days=lookback_days)
    job = TelegramChatAuthorJob(
        id=uuid.uuid4(),
        telegram_chat_id=telegram_chat_id,
        requested_by_account_user_id=requested_by.id if requested_by else None,
        lookback_days=lookback_days,
        period_start=period_start,
        period_end=period_end,
        status=ChatAuthorJobStatus.QUEUED,
        scanned_messages_count=0,
        unique_authors_count=0,
        created_at=now,
        updated_at=now,
    )
    session.add(job)
    await session.flush()
    return job


async def get_job(session: AsyncSession, job_id: uuid.UUID) -> TelegramChatAuthorJob | None:
    stmt = (
        select(TelegramChatAuthorJob)
        .options(selectinload(TelegramChatAuthorJob.chat))
        .where(TelegramChatAuthorJob.id == job_id)
    )
    return (await session.execute(stmt)).scalar_one_or_none()


async def latest_job_for_period(
    session: AsyncSession,
    *,
    telegram_chat_id: int,
    lookback_days: int,
) -> TelegramChatAuthorJob | None:
    stmt = (
        select(TelegramChatAuthorJob)
        .where(
            TelegramChatAuthorJob.telegram_chat_id == telegram_chat_id,
            TelegramChatAuthorJob.lookback_days == lookback_days,
            TelegramChatAuthorJob.status == ChatAuthorJobStatus.COMPLETED,
        )
        .order_by(TelegramChatAuthorJob.finished_at.desc().nullslast(), TelegramChatAuthorJob.created_at.desc())
        .limit(1)
    )
    return (await session.execute(stmt)).scalar_one_or_none()


async def claim_next_job(session: AsyncSession) -> TelegramChatAuthorJob | None:
    now = utcnow()
    stmt: Select[tuple[TelegramChatAuthorJob]] = (
        select(TelegramChatAuthorJob)
        .where(
            or_(
                TelegramChatAuthorJob.status == ChatAuthorJobStatus.QUEUED,
                and_(
                    TelegramChatAuthorJob.status == ChatAuthorJobStatus.PAUSED_FLOOD_WAIT,
                    TelegramChatAuthorJob.flood_wait_until <= now,
                ),
            )
        )
        .order_by(TelegramChatAuthorJob.created_at.asc())
        .with_for_update(skip_locked=True)
        .limit(1)
    )
    job = (await session.execute(stmt)).scalar_one_or_none()
    if not job:
        return None
    job.status = ChatAuthorJobStatus.RUNNING
    job.started_at = job.started_at or now
    job.flood_wait_until = None
    job.error_code = None
    job.error_message = None
    job.updated_at = now
    await session.flush()
    return job


async def mark_job_progress(
    session: AsyncSession,
    *,
    job_id: uuid.UUID,
    cursor_message_id: int | None,
    cursor_message_date: datetime | None,
    scanned_messages_count: int,
) -> None:
    now = utcnow()
    await session.execute(
        update(TelegramChatAuthorJob)
        .where(TelegramChatAuthorJob.id == job_id)
        .values(
            cursor_message_id=cursor_message_id,
            cursor_message_date=cursor_message_date,
            scanned_messages_count=scanned_messages_count,
            updated_at=now,
        )
    )


async def pause_job_for_flood_wait(session: AsyncSession, *, job_id: uuid.UUID, seconds: int) -> None:
    now = utcnow()
    await session.execute(
        update(TelegramChatAuthorJob)
        .where(TelegramChatAuthorJob.id == job_id)
        .values(
            status=ChatAuthorJobStatus.PAUSED_FLOOD_WAIT,
            flood_wait_until=now + timedelta(seconds=seconds),
            error_code="FLOOD_WAIT",
            error_message=f"Telegram requested waiting for {seconds} seconds.",
            updated_at=now,
        )
    )


async def complete_job(session: AsyncSession, *, job_id: uuid.UUID) -> None:
    now = utcnow()
    unique_count = await session.scalar(
        select(func.count(TelegramChatActiveAuthor.id)).where(TelegramChatActiveAuthor.source_job_id == job_id)
    )
    await session.execute(
        update(TelegramChatAuthorJob)
        .where(TelegramChatAuthorJob.id == job_id)
        .values(
            status=ChatAuthorJobStatus.COMPLETED,
            unique_authors_count=unique_count or 0,
            finished_at=now,
            updated_at=now,
        )
    )


async def fail_job(session: AsyncSession, *, job_id: uuid.UUID, code: str, message: str) -> None:
    now = utcnow()
    await session.execute(
        update(TelegramChatAuthorJob)
        .where(TelegramChatAuthorJob.id == job_id)
        .values(
            status=ChatAuthorJobStatus.FAILED,
            error_code=code[:64],
            error_message=message[:512],
            finished_at=now,
            updated_at=now,
        )
    )


async def cancel_job(session: AsyncSession, *, job_id: uuid.UUID) -> TelegramChatAuthorJob | None:
    job = await get_job(session, job_id)
    if not job:
        return None
    if job.status in {ChatAuthorJobStatus.COMPLETED, ChatAuthorJobStatus.FAILED, ChatAuthorJobStatus.CANCELLED}:
        return job
    job.status = ChatAuthorJobStatus.CANCELLED
    job.finished_at = utcnow()
    job.updated_at = job.finished_at
    await session.flush()
    return job


async def is_job_cancelled(session: AsyncSession, job_id: uuid.UUID) -> bool:
    status = await session.scalar(select(TelegramChatAuthorJob.status).where(TelegramChatAuthorJob.id == job_id))
    return status == ChatAuthorJobStatus.CANCELLED


async def upsert_user(
    session: AsyncSession,
    *,
    telegram_user_id: int,
    access_hash: int | None,
    username: str | None,
    first_name: str | None,
    last_name: str | None,
    is_bot: bool | None,
    seen_at: datetime,
) -> None:
    now = utcnow()
    stmt = (
        insert(TelegramUser)
        .values(
            telegram_user_id=telegram_user_id,
            access_hash=access_hash,
            username=username,
            first_name=first_name,
            last_name=last_name,
            is_bot=is_bot,
            first_seen_at=seen_at,
            last_seen_at=seen_at,
            updated_at=now,
        )
        .on_conflict_do_update(
            index_elements=[TelegramUser.telegram_user_id],
            set_={
                "access_hash": access_hash,
                "username": username,
                "first_name": first_name,
                "last_name": last_name,
                "is_bot": is_bot,
                "last_seen_at": func.greatest(TelegramUser.last_seen_at, seen_at),
                "updated_at": now,
            },
        )
    )
    await session.execute(stmt)


async def upsert_active_author(
    session: AsyncSession,
    *,
    telegram_chat_id: int,
    telegram_user_id: int,
    period_start: datetime,
    period_end: datetime,
    message_at: datetime,
    source_job_id: uuid.UUID,
) -> None:
    now = utcnow()
    stmt = (
        insert(TelegramChatActiveAuthor)
        .values(
            telegram_chat_id=telegram_chat_id,
            telegram_user_id=telegram_user_id,
            period_start=period_start,
            period_end=period_end,
            message_count=1,
            first_message_at=message_at,
            last_message_at=message_at,
            source_job_id=source_job_id,
            created_at=now,
            updated_at=now,
        )
        .on_conflict_do_update(
            constraint="uq_active_author_chat_user_period",
            set_={
                "message_count": TelegramChatActiveAuthor.message_count + 1,
                "first_message_at": func.least(TelegramChatActiveAuthor.first_message_at, message_at),
                "last_message_at": func.greatest(TelegramChatActiveAuthor.last_message_at, message_at),
                "source_job_id": source_job_id,
                "updated_at": now,
            },
        )
    )
    await session.execute(stmt)


async def list_active_authors(
    session: AsyncSession,
    *,
    telegram_chat_id: int,
    period_start: datetime,
    period_end: datetime,
    limit: int,
    offset: int,
    search: str | None = None,
) -> tuple[list[tuple[TelegramChatActiveAuthor, TelegramUser]], int]:
    filters = [
        TelegramChatActiveAuthor.telegram_chat_id == telegram_chat_id,
        TelegramChatActiveAuthor.period_start == period_start,
        TelegramChatActiveAuthor.period_end == period_end,
    ]
    if search:
        needle = f"%{search.strip().lstrip('@')}%"
        filters.append(
            or_(
                TelegramUser.username.ilike(needle),
                TelegramUser.first_name.ilike(needle),
                TelegramUser.last_name.ilike(needle),
            )
        )
    total_stmt = (
        select(func.count(TelegramChatActiveAuthor.id))
        .join(TelegramUser, TelegramUser.telegram_user_id == TelegramChatActiveAuthor.telegram_user_id)
        .where(*filters)
    )
    total = await session.scalar(total_stmt)
    stmt = (
        select(TelegramChatActiveAuthor, TelegramUser)
        .join(TelegramUser, TelegramUser.telegram_user_id == TelegramChatActiveAuthor.telegram_user_id)
        .where(*filters)
        .order_by(TelegramChatActiveAuthor.message_count.desc(), TelegramChatActiveAuthor.last_message_at.desc())
        .limit(limit)
        .offset(offset)
    )
    rows = list((await session.execute(stmt)).all())
    return rows, total or 0
