from __future__ import annotations

import asyncio
from contextlib import suppress
from datetime import UTC, datetime

import structlog
from redis.asyncio import Redis
from sqlalchemy.ext.asyncio import async_sessionmaker
from telethon import TelegramClient
from telethon.errors import FloodWaitError

from common import chat_authors as repo
from common.config import CollectorSettings
from common.db import get_session_factory


def _aware_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=UTC)
    return value.astimezone(UTC)


class ChatAuthorJobWorker:
    def __init__(self, settings: CollectorSettings, redis: Redis, client: TelegramClient) -> None:
        self.settings = settings
        self.redis = redis
        self.client = client
        self.session_factory: async_sessionmaker = get_session_factory(settings.database)
        self.logger = structlog.get_logger("collector.chat_authors")

    async def run_once(self) -> int:
        if not self.settings.chat_authors_enabled:
            return 0
        lock_key = "chat_author_jobs:global_lock"
        lock = await self.redis.set(lock_key, "1", ex=900, nx=True)
        if not lock:
            return 0
        try:
            async with self.session_factory() as session:
                job = await repo.claim_next_job(session)
                await session.commit()
            if not job:
                return 0
            await self._process_job(job.id)
            return 1
        finally:
            with suppress(Exception):
                await self.redis.delete(lock_key)

    async def _process_job(self, job_id) -> None:
        async with self.session_factory() as session:
            job = await repo.get_job(session, job_id)
            if not job:
                return
            chat_wait_key = f"chat_author_jobs:chat_wait:{job.telegram_chat_id}"
            if await self.redis.exists(chat_wait_key):
                await repo.pause_job_for_flood_wait(session, job_id=job.id, seconds=self.settings.chat_authors_min_seconds_between_jobs)
                await session.commit()
                return
            telegram_chat_id = job.telegram_chat_id
            period_start = _aware_utc(job.period_start)
            period_end = _aware_utc(job.period_end)
            lookback_days = job.lookback_days
            scanned = job.scanned_messages_count
            await session.commit()

        if lookback_days > self.settings.chat_authors_max_lookback_days:
            async with self.session_factory() as session:
                await repo.fail_job(
                    session,
                    job_id=job_id,
                    code="LOOKBACK_LIMIT",
                    message=f"lookback_days exceeds configured limit {self.settings.chat_authors_max_lookback_days}",
                )
                await session.commit()
            return

        try:
            entity = await self.client.get_entity(telegram_chat_id)
            cursor_message_id = None
            cursor_message_date = None

            async for message in self.client.iter_messages(
                entity,
                limit=self.settings.chat_authors_max_messages_per_job,
                offset_id=job.cursor_message_id or 0,
                wait_time=self.settings.chat_authors_history_wait_seconds,
            ):
                message_date = getattr(message, "date", None)
                if not message_date:
                    continue
                message_at = _aware_utc(message_date)
                if message_at < period_start:
                    break
                if message_at > period_end:
                    continue

                scanned += 1
                cursor_message_id = getattr(message, "id", None)
                cursor_message_date = message_at
                sender_id = getattr(message, "sender_id", None)
                if sender_id:
                    sender = getattr(message, "sender", None)
                    if sender is None:
                        sender = await message.get_sender()
                    if sender is not None:
                        async with self.session_factory() as session:
                            await repo.upsert_user(
                                session,
                                telegram_user_id=sender_id,
                                access_hash=getattr(sender, "access_hash", None),
                                username=getattr(sender, "username", None),
                                first_name=getattr(sender, "first_name", None),
                                last_name=getattr(sender, "last_name", None),
                                is_bot=getattr(sender, "bot", None),
                                seen_at=message_at,
                            )
                            await repo.upsert_active_author(
                                session,
                                telegram_chat_id=telegram_chat_id,
                                telegram_user_id=sender_id,
                                period_start=period_start,
                                period_end=period_end,
                                message_at=message_at,
                                source_job_id=job_id,
                            )
                            await repo.mark_job_progress(
                                session,
                                job_id=job_id,
                                cursor_message_id=cursor_message_id,
                                cursor_message_date=cursor_message_date,
                                scanned_messages_count=scanned,
                            )
                            await session.commit()

                if scanned % 100 == 0:
                    async with self.session_factory() as session:
                        if await repo.is_job_cancelled(session, job_id):
                            self.logger.info("chat_author_job_cancelled", job_id=str(job_id))
                            return
                        await repo.mark_job_progress(
                            session,
                            job_id=job_id,
                            cursor_message_id=cursor_message_id,
                            cursor_message_date=cursor_message_date,
                            scanned_messages_count=scanned,
                        )
                        await session.commit()

            async with self.session_factory() as session:
                await repo.mark_job_progress(
                    session,
                    job_id=job_id,
                    cursor_message_id=cursor_message_id,
                    cursor_message_date=cursor_message_date,
                    scanned_messages_count=scanned,
                )
                await repo.complete_job(session, job_id=job_id)
                await repo.audit(
                    session,
                    actor_id=None,
                    action="chat_author_scan_completed",
                    entity="telegram_chat_author_job",
                    entity_id=str(job_id),
                    payload={"telegram_chat_id": telegram_chat_id, "scanned_messages_count": scanned},
                )
                await session.commit()
            await self.redis.set(
                f"chat_author_jobs:chat_wait:{telegram_chat_id}",
                "1",
                ex=self.settings.chat_authors_min_seconds_between_jobs,
            )
            self.logger.info("chat_author_job_completed", job_id=str(job_id), scanned_messages_count=scanned)
        except FloodWaitError as exc:
            wait_seconds = int(getattr(exc, "seconds", 60))
            async with self.session_factory() as session:
                await repo.pause_job_for_flood_wait(session, job_id=job_id, seconds=wait_seconds)
                await session.commit()
            await self.redis.set("chat_author_jobs:flood_wait", "1", ex=wait_seconds)
            self.logger.warning("chat_author_job_flood_wait", job_id=str(job_id), seconds=wait_seconds)
        except asyncio.CancelledError:
            raise
        except Exception as exc:  # pragma: no cover - defensive against MTProto edge cases
            async with self.session_factory() as session:
                await repo.fail_job(session, job_id=job_id, code=type(exc).__name__, message=str(exc))
                await session.commit()
            self.logger.exception("chat_author_job_failed", job_id=str(job_id), error=str(exc))
