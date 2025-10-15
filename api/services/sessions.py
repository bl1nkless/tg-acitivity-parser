from __future__ import annotations

from datetime import datetime
from typing import List, Optional, Tuple

import sqlalchemy as sa
from sqlalchemy import Select, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from common.models import OnlineSession, StatusEvent, StatusPrecision


def _sessions_query(tg_user_id: int) -> Select:
    return select(OnlineSession).where(OnlineSession.tg_user_id == tg_user_id).order_by(
        OnlineSession.ts_from.desc()
    )


def _events_query(tg_user_id: int) -> Select:
    return select(StatusEvent).where(StatusEvent.tg_user_id == tg_user_id).order_by(StatusEvent.ts.desc())


async def list_sessions(
    session: AsyncSession,
    tg_user_id: int,
    *,
    limit: int = 100,
    offset: int = 0,
    precision: Optional[StatusPrecision] = None,
    since: Optional[datetime] = None,
    until: Optional[datetime] = None,
) -> Tuple[List[OnlineSession], int]:
    query = _sessions_query(tg_user_id)
    count_query = select(func.count()).select_from(OnlineSession).where(OnlineSession.tg_user_id == tg_user_id)

    if precision:
        query = query.where(OnlineSession.source_precision == precision)
        count_query = count_query.where(OnlineSession.source_precision == precision)
    if since:
        query = query.where(OnlineSession.ts_from >= since)
        count_query = count_query.where(OnlineSession.ts_from >= since)
    if until:
        query = query.where(OnlineSession.ts_from <= until)
        count_query = count_query.where(OnlineSession.ts_from <= until)

    total_result = await session.execute(count_query)
    total = total_result.scalar_one()

    result = await session.execute(query.limit(limit).offset(offset))
    return result.scalars().all(), total


async def list_status_events(
    session: AsyncSession,
    tg_user_id: int,
    *,
    limit: int = 500,
    offset: int = 0,
    precision: Optional[StatusPrecision] = None,
    since: Optional[datetime] = None,
    until: Optional[datetime] = None,
) -> Tuple[List[StatusEvent], int]:
    query = _events_query(tg_user_id)
    count_query = (
        select(func.count()).select_from(StatusEvent).where(StatusEvent.tg_user_id == tg_user_id)
    )

    if precision:
        query = query.where(StatusEvent.source_precision == precision)
        count_query = count_query.where(StatusEvent.source_precision == precision)
    if since:
        query = query.where(StatusEvent.ts >= since)
        count_query = count_query.where(StatusEvent.ts >= since)
    if until:
        query = query.where(StatusEvent.ts <= until)
        count_query = count_query.where(StatusEvent.ts <= until)

    total_result = await session.execute(count_query)
    total = total_result.scalar_one()

    result = await session.execute(query.limit(limit).offset(offset))
    return result.scalars().all(), total
