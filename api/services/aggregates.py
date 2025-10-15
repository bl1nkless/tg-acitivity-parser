from __future__ import annotations

from datetime import datetime
from typing import List, Optional

import sqlalchemy as sa
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from common.models import AggHourly


async def list_hourly_aggregates(
    session: AsyncSession,
    tg_user_id: int,
    *,
    since: Optional[datetime] = None,
    until: Optional[datetime] = None,
) -> List[AggHourly]:
    query = (
        select(AggHourly)
        .where(AggHourly.tg_user_id == tg_user_id)
        .order_by(AggHourly.bucket_start.asc())
    )
    if since:
        query = query.where(AggHourly.bucket_start >= since)
    if until:
        query = query.where(AggHourly.bucket_start < until)

    result = await session.execute(query)
    return result.scalars().all()


async def get_heatmap(
    session: AsyncSession,
    tg_user_id: int,
    *,
    since: Optional[datetime] = None,
    until: Optional[datetime] = None,
) -> List[tuple[int, int, int]]:
    query = (
        select(
            func.extract("dow", AggHourly.bucket_start).cast(sa.Integer).label("weekday"),
            func.extract("hour", AggHourly.bucket_start).cast(sa.Integer).label("hour"),
            func.sum(AggHourly.online_seconds).label("online_seconds"),
        )
        .where(AggHourly.tg_user_id == tg_user_id)
        .group_by("weekday", "hour")
        .order_by("weekday", "hour")
    )
    if since:
        query = query.where(AggHourly.bucket_start >= since)
    if until:
        query = query.where(AggHourly.bucket_start < until)

    result = await session.execute(query)
    return [(row.weekday, row.hour, row.online_seconds) for row in result.all()]
