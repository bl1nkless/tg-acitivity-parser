from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Optional

from sqlalchemy import Select, and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from common.aggregation import upsert_hourly_range
from common.models import (
    OnlineSession,
    SessionClosedReason,
    StatusEvent,
    StatusEventSource,
    StatusEventType,
    StatusPrecision,
)


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


async def get_active_session(session: AsyncSession, tg_user_id: int) -> Optional[OnlineSession]:
    stmt: Select = (
        select(OnlineSession)
        .where(and_(OnlineSession.tg_user_id == tg_user_id, OnlineSession.ts_to.is_(None)))
        .order_by(OnlineSession.ts_from.desc())
        .limit(1)
    )
    result = await session.execute(stmt)
    return result.scalar_one_or_none()


async def create_status_event(
    session: AsyncSession,
    *,
    tg_user_id: int,
    status: StatusEventType,
    precision: StatusPrecision,
    source: StatusEventSource,
    expires_at: Optional[datetime] = None,
    raw: Optional[dict] = None,
) -> StatusEvent:
    event = StatusEvent(
        tg_user_id=tg_user_id,
        status=status,
        source_precision=precision,
        source=source,
        ts=_utcnow(),
        expires_at=expires_at,
        raw=raw,
    )
    session.add(event)
    await session.flush()
    return event


async def open_session(
    session: AsyncSession,
    *,
    tg_user_id: int,
    precision: StatusPrecision,
) -> OnlineSession:
    existing = await get_active_session(session, tg_user_id)
    if existing:
        return existing

    now = _utcnow()
    new_session = OnlineSession(
        tg_user_id=tg_user_id,
        ts_from=now,
        ts_to=None,
        source_precision=precision,
        closed_reason=None,
        created_at=now,
        updated_at=now,
    )
    session.add(new_session)
    await session.flush()
    return new_session


async def close_session(
    session: AsyncSession,
    *,
    tg_user_id: int,
    precision: StatusPrecision,
    reason: SessionClosedReason,
    ts_to: Optional[datetime] = None,
) -> Optional[OnlineSession]:
    active = await get_active_session(session, tg_user_id)
    if not active:
        return None
    now = ts_to or _utcnow()
    if active.ts_from and now <= active.ts_from:
        now = active.ts_from + timedelta(seconds=1)
    active.ts_to = now
    active.closed_reason = reason
    active.source_precision = precision
    active.updated_at = _utcnow()
    await session.flush()
    if active.ts_from and active.ts_to:
        await upsert_hourly_range(
            session,
            tg_user_id=tg_user_id,
            start=active.ts_from,
            end=active.ts_to,
        )
    return active
