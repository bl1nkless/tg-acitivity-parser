from __future__ import annotations

from datetime import datetime, timezone
from itertools import islice
from typing import Dict, Iterable, Optional, Union

import structlog
from redis.asyncio import Redis
from sqlalchemy import select
from telethon.tl import types as tl_types

from common.config import CollectorSettings
from common.db import get_session_factory
from common.models import (
    OnlineSession,
    SessionClosedReason,
    StatusEventSource,
    StatusEventType,
    StatusPrecision,
    TrackedUser,
)

from .storage import close_session, create_status_event, open_session


def _chunked(iterable: Iterable[int], size: int) -> Iterable[list[int]]:
    iterator = iter(iterable)
    while chunk := list(islice(iterator, size)):
        yield chunk


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _to_datetime(value: Optional[Union[int, datetime]]) -> Optional[datetime]:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value.astimezone(timezone.utc)
    return datetime.fromtimestamp(value, tz=timezone.utc)


def _iso_or_none(value: Optional[datetime]) -> Optional[str]:
    return value.isoformat() if value else None


class StatusTracker:
    def __init__(self, settings: CollectorSettings, redis: Redis):
        self.settings = settings
        self.redis = redis
        self.session_factory = get_session_factory(settings.database)
        self.logger = structlog.get_logger("collector.status_tracker")

    async def handle_update(self, update: tl_types.Update) -> None:
        if not isinstance(update, tl_types.UpdateUserStatus):
            return
        if update.user_id is None:
            return

        user_id = update.user_id
        status = update.status

        async with self.session_factory() as session:
            tracked = await session.get(TrackedUser, user_id)
            if not tracked or not tracked.track_enabled:
                return

            if isinstance(status, tl_types.UserStatusOnline):
                expires_at = _to_datetime(status.expires)
                await open_session(session, tg_user_id=user_id, precision=StatusPrecision.EXACT)
                await create_status_event(
                    session,
                    tg_user_id=user_id,
                    status=StatusEventType.ONLINE,
                    precision=StatusPrecision.EXACT,
                    source=StatusEventSource.UPDATE,
                    expires_at=expires_at,
                    raw={"expires": _iso_or_none(expires_at)},
                )
                ttl_seconds = self._compute_ttl_seconds(expires_at)
                await self.redis.setex(self._active_key(user_id), ttl_seconds, "1")
                self.logger.info("online_detected", user_id=user_id, ttl=ttl_seconds)
            elif isinstance(status, tl_types.UserStatusOffline):
                ts_to = _to_datetime(status.was_online)
                await close_session(
                    session,
                    tg_user_id=user_id,
                    precision=StatusPrecision.EXACT,
                    reason=SessionClosedReason.OFFLINE,
                    ts_to=ts_to,
                )
                await create_status_event(
                    session,
                    tg_user_id=user_id,
                    status=StatusEventType.OFFLINE,
                    precision=StatusPrecision.EXACT,
                    source=StatusEventSource.UPDATE,
                    raw={"was_online": _iso_or_none(ts_to)},
                )
                await self.redis.delete(self._active_key(user_id))
                self.logger.info("offline_detected", user_id=user_id)
            elif isinstance(status, tl_types.UserStatusRecently):
                await self._record_approx_event(session, user_id, StatusEventType.RECENTLY)
            elif isinstance(status, tl_types.UserStatusLastWeek):
                await self._record_approx_event(session, user_id, StatusEventType.LAST_WEEK)
            elif isinstance(status, tl_types.UserStatusLastMonth):
                await self._record_approx_event(session, user_id, StatusEventType.LAST_MONTH)
            else:
                await self._record_approx_event(session, user_id, StatusEventType.UNKNOWN)

            await session.commit()

    async def _record_approx_event(
        self,
        session,
        user_id: int,
        status: StatusEventType,
    ) -> None:
        await create_status_event(
            session,
            tg_user_id=user_id,
            status=status,
            precision=StatusPrecision.APPROX,
            source=StatusEventSource.UPDATE,
            raw={"precision": "approx"},
        )
        self.logger.info("approx_status_detected", user_id=user_id, status=status.value)

    async def close_stale_sessions(self) -> int:
        """Close sessions missing redis heartbeat."""
        async with self.session_factory() as session:
            result = await session.execute(
                select(OnlineSession)
                .join(TrackedUser, TrackedUser.tg_user_id == OnlineSession.tg_user_id)
                .where(
                    OnlineSession.ts_to.is_(None),
                    TrackedUser.track_enabled.is_(True),
                )
            )
            open_sessions = result.scalars().all()
            closed = 0
            for session_row in open_sessions:
                redis_key = self._active_key(session_row.tg_user_id)
                if await self.redis.exists(redis_key):
                    continue
                await close_session(
                    session,
                    tg_user_id=session_row.tg_user_id,
                    precision=session_row.source_precision,
                    reason=SessionClosedReason.EXPIRY,
                    ts_to=_utcnow(),
                )
                await create_status_event(
                    session,
                    tg_user_id=session_row.tg_user_id,
                    status=StatusEventType.OFFLINE,
                    precision=session_row.source_precision,
                    source=StatusEventSource.RECOVERY,
                    raw={"reason": "expiry"},
                )
                closed += 1
            await session.commit()
            return closed

    def _active_key(self, user_id: int) -> str:
        return f"active:{user_id}"

    def _compute_ttl_seconds(self, expires_at: Optional[datetime]) -> int:
        if not expires_at:
            return max(self.settings.ttl_grace_seconds, 30)
        now = _utcnow()
        delta = (expires_at - now).total_seconds()
        return max(int(max(delta, 0)) + self.settings.ttl_grace_seconds, self.settings.ttl_grace_seconds)

    async def sync_tracked_users(self, client, batch_size: int = 50) -> int:
        """Ensure Telethon has entities for all tracked users to receive presence updates."""
        async with self.session_factory() as session:
            result = await session.execute(
                select(TrackedUser.tg_user_id).where(TrackedUser.track_enabled.is_(True))
            )
            user_ids = [row[0] for row in result.all()]

        synced = 0
        for chunk in _chunked(user_ids, batch_size):
            for user_id in chunk:
                try:
                    await client.get_entity(user_id)
                    synced += 1
                except Exception as exc:  # pragma: no cover - defensive
                    self.logger.warning("prefetch_failed", user_id=user_id, error=str(exc))
        if synced:
            self.logger.info("tracked_users_prefetched", count=synced)
        return synced
