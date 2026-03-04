from __future__ import annotations

import csv
import io
import json
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from redis.asyncio import Redis
from sqlalchemy.ext.asyncio import AsyncSession

from common import chat_authors as chat_author_repo
from common.config import ApiSettings
from common.models import AccountUser

from ..auth.dependencies import get_current_admin, get_current_user
from ..core.cache import get_redis
from ..core.config import get_settings
from ..core.db import get_db
from ..schemas.chat_authors import (
    ChatActiveAuthorOut,
    ChatActiveAuthorsResponse,
    ChatAuthorJobCreate,
    ChatAuthorJobOut,
    ChatResolveRequest,
    TelegramChatOut,
)
from ..services.telegram_resolver import resolve_chat


router = APIRouter(prefix="/telegram", tags=["telegram-chat-authors"])


def _validate_lookback(settings: ApiSettings, lookback_days: int) -> None:
    if lookback_days < 1 or lookback_days > settings.chat_authors_max_lookback_days:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"lookback_days must be between 1 and {settings.chat_authors_max_lookback_days}",
        )


def _job_out(job) -> ChatAuthorJobOut:
    return ChatAuthorJobOut.model_validate(job)


def _author_out(row) -> ChatActiveAuthorOut:
    active_author, user = row
    return ChatActiveAuthorOut(
        telegram_chat_id=active_author.telegram_chat_id,
        telegram_user_id=active_author.telegram_user_id,
        username=user.username,
        first_name=user.first_name,
        last_name=user.last_name,
        is_bot=user.is_bot,
        message_count=active_author.message_count,
        first_message_at=active_author.first_message_at,
        last_message_at=active_author.last_message_at,
    )


@router.post("/chats/resolve", response_model=TelegramChatOut)
async def resolve_telegram_chat(
    payload: ChatResolveRequest,
    session: AsyncSession = Depends(get_db),
    current_user: AccountUser = Depends(get_current_admin),
    settings: ApiSettings = Depends(get_settings),
) -> TelegramChatOut:
    if not settings.chat_authors_enabled:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Chat author collection is disabled")
    try:
        resolved = await resolve_chat(settings, payload.chat_ref)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc
    except LookupError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc

    chat = await chat_author_repo.upsert_chat(
        session,
        telegram_chat_id=resolved.telegram_chat_id,
        access_hash=resolved.access_hash,
        username=resolved.username,
        title=resolved.title,
        chat_type=resolved.chat_type,
    )
    await chat_author_repo.audit(
        session,
        actor_id=current_user.id,
        action="telegram_chat_resolved",
        entity="telegram_chat",
        entity_id=str(chat.telegram_chat_id),
        payload={"chat_ref": payload.chat_ref, "chat_type": chat.chat_type},
    )
    return TelegramChatOut.model_validate(chat)


@router.post("/chat-author-jobs", response_model=ChatAuthorJobOut, status_code=status.HTTP_201_CREATED)
async def create_chat_author_job(
    payload: ChatAuthorJobCreate,
    session: AsyncSession = Depends(get_db),
    redis: Redis = Depends(get_redis),
    current_user: AccountUser = Depends(get_current_admin),
    settings: ApiSettings = Depends(get_settings),
) -> ChatAuthorJobOut:
    if not settings.chat_authors_enabled:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Chat author collection is disabled")
    lookback_days = payload.lookback_days or settings.chat_authors_default_lookback_days
    _validate_lookback(settings, lookback_days)
    chat = await chat_author_repo.get_chat(session, payload.telegram_chat_id)
    if not chat:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Resolve and save the chat before starting a scan")
    job = await chat_author_repo.create_job(
        session,
        telegram_chat_id=payload.telegram_chat_id,
        requested_by=current_user,
        lookback_days=lookback_days,
    )
    await redis.lpush("chat_author_jobs:queue", str(job.id))
    await chat_author_repo.audit(
        session,
        actor_id=current_user.id,
        action="chat_author_scan_started",
        entity="telegram_chat_author_job",
        entity_id=str(job.id),
        payload={"telegram_chat_id": payload.telegram_chat_id, "lookback_days": lookback_days},
    )
    return _job_out(job)


@router.get("/chat-author-jobs/{job_id}", response_model=ChatAuthorJobOut)
async def get_chat_author_job(
    job_id: uuid.UUID,
    session: AsyncSession = Depends(get_db),
    _: AccountUser = Depends(get_current_user),
) -> ChatAuthorJobOut:
    job = await chat_author_repo.get_job(session, job_id)
    if not job:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chat author job not found")
    return _job_out(job)


@router.post("/chat-author-jobs/{job_id}/cancel", response_model=ChatAuthorJobOut)
async def cancel_chat_author_job(
    job_id: uuid.UUID,
    session: AsyncSession = Depends(get_db),
    current_user: AccountUser = Depends(get_current_admin),
) -> ChatAuthorJobOut:
    job = await chat_author_repo.cancel_job(session, job_id=job_id)
    if not job:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chat author job not found")
    await chat_author_repo.audit(
        session,
        actor_id=current_user.id,
        action="chat_author_scan_cancelled",
        entity="telegram_chat_author_job",
        entity_id=str(job.id),
        payload={"telegram_chat_id": job.telegram_chat_id},
    )
    return _job_out(job)


async def _load_active_authors(
    session: AsyncSession,
    *,
    settings: ApiSettings,
    telegram_chat_id: int,
    period_days: int,
    limit: int,
    offset: int,
    search: str | None,
) -> ChatActiveAuthorsResponse:
    _validate_lookback(settings, period_days)
    latest_job = await chat_author_repo.latest_job_for_period(
        session,
        telegram_chat_id=telegram_chat_id,
        lookback_days=period_days,
    )
    if not latest_job:
        return ChatActiveAuthorsResponse(items=[], total=0, limit=limit, offset=offset)
    rows, total = await chat_author_repo.list_active_authors(
        session,
        telegram_chat_id=telegram_chat_id,
        period_start=latest_job.period_start,
        period_end=latest_job.period_end,
        limit=limit,
        offset=offset,
        search=search,
    )
    return ChatActiveAuthorsResponse(
        items=[_author_out(row) for row in rows],
        total=total,
        limit=limit,
        offset=offset,
        period_start=latest_job.period_start,
        period_end=latest_job.period_end,
        latest_job=_job_out(latest_job),
    )


@router.get("/chats/{telegram_chat_id}/active-authors", response_model=ChatActiveAuthorsResponse)
async def list_chat_active_authors(
    telegram_chat_id: int,
    period_days: int = Query(default=30, ge=1),
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    search: str | None = Query(default=None),
    session: AsyncSession = Depends(get_db),
    _: AccountUser = Depends(get_current_user),
    settings: ApiSettings = Depends(get_settings),
) -> ChatActiveAuthorsResponse:
    return await _load_active_authors(
        session,
        settings=settings,
        telegram_chat_id=telegram_chat_id,
        period_days=period_days,
        limit=limit,
        offset=offset,
        search=search,
    )


@router.get("/chats/{telegram_chat_id}/active-authors.csv")
async def export_chat_active_authors_csv(
    telegram_chat_id: int,
    period_days: int = Query(default=30, ge=1),
    session: AsyncSession = Depends(get_db),
    _: AccountUser = Depends(get_current_user),
    settings: ApiSettings = Depends(get_settings),
) -> Response:
    data = await _load_active_authors(
        session,
        settings=settings,
        telegram_chat_id=telegram_chat_id,
        period_days=period_days,
        limit=10_000,
        offset=0,
        search=None,
    )
    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(["telegram_user_id", "username", "first_name", "last_name", "is_bot", "message_count", "first_message_at", "last_message_at"])
    for item in data.items:
        writer.writerow([
            item.telegram_user_id,
            item.username or "",
            item.first_name or "",
            item.last_name or "",
            item.is_bot,
            item.message_count,
            item.first_message_at.isoformat(),
            item.last_message_at.isoformat(),
        ])
    return Response(
        content=buffer.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=chat-{telegram_chat_id}-authors.csv"},
    )


@router.get("/chats/{telegram_chat_id}/active-authors.json")
async def export_chat_active_authors_json(
    telegram_chat_id: int,
    period_days: int = Query(default=30, ge=1),
    session: AsyncSession = Depends(get_db),
    _: AccountUser = Depends(get_current_user),
    settings: ApiSettings = Depends(get_settings),
) -> Response:
    data = await _load_active_authors(
        session,
        settings=settings,
        telegram_chat_id=telegram_chat_id,
        period_days=period_days,
        limit=10_000,
        offset=0,
        search=None,
    )
    payload = {
        "telegram_chat_id": telegram_chat_id,
        "period_start": data.period_start.isoformat() if data.period_start else None,
        "period_end": data.period_end.isoformat() if data.period_end else None,
        "items": [item.model_dump(mode="json") for item in data.items],
    }
    return Response(
        content=json.dumps(payload, ensure_ascii=False),
        media_type="application/json",
        headers={"Content-Disposition": f"attachment; filename=chat-{telegram_chat_id}-authors.json"},
    )
