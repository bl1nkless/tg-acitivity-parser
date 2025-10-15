from __future__ import annotations

from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from .models import AggHourly


def _floor_to_hour(dt: datetime) -> datetime:
    return dt.replace(minute=0, second=0, microsecond=0)


def _ceil_to_hour(dt: datetime) -> datetime:
    floored = _floor_to_hour(dt)
    return floored if floored == dt else floored + timedelta(hours=1)


async def upsert_hourly_range(
    session: AsyncSession,
    *,
    tg_user_id: int,
    start: datetime,
    end: datetime,
) -> None:
    if start >= end:
        return

    tz_aware_start = start if start.tzinfo else start.replace(tzinfo=timezone.utc)
    tz_aware_end = end if end.tzinfo else end.replace(tzinfo=timezone.utc)

    current = tz_aware_start
    while current < tz_aware_end:
        bucket_start = _floor_to_hour(current)
        bucket_end = bucket_start + timedelta(hours=1)
        overlap_end = min(bucket_end, tz_aware_end)
        delta_seconds = (overlap_end - current).total_seconds()
        if delta_seconds <= 0:
            effective_end = min(bucket_end, tz_aware_end, current + timedelta(seconds=1))
            delta_seconds = (effective_end - current).total_seconds()
            overlap_end = effective_end
        seconds = int(max(1, round(delta_seconds)))
        if overlap_end <= current:
            break
        if seconds > 0:
            stmt = insert(AggHourly).values(
                tg_user_id=tg_user_id,
                bucket_start=bucket_start,
                online_seconds=seconds,
                updated_at=datetime.now(timezone.utc),
            )
            stmt = stmt.on_conflict_do_update(
                index_elements=["tg_user_id", "bucket_start"],
                set_={
                    "online_seconds": AggHourly.online_seconds + seconds,
                    "updated_at": datetime.now(timezone.utc),
                },
            )
            await session.execute(stmt)
        current = overlap_end
