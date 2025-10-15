from __future__ import annotations

from datetime import datetime, timezone
from typing import List, Optional, Tuple

import sqlalchemy as sa
from sqlalchemy import Select, func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from common.models import TrackedUser


def _base_query() -> Select[Tuple[TrackedUser]]:
    return select(TrackedUser).order_by(TrackedUser.added_at.desc())


async def list_tracked_users(
    session: AsyncSession,
    *,
    limit: int = 50,
    offset: int = 0,
    search: Optional[str] = None,
) -> Tuple[List[TrackedUser], int]:
    query = _base_query()
    count_query = select(func.count()).select_from(TrackedUser)
    if search:
        pattern = f"%{search.lower()}%"
        condition = (
            func.lower(TrackedUser.username).like(pattern)
            | func.lower(TrackedUser.display_name).like(pattern)
            | sa.cast(TrackedUser.tg_user_id, sa.String).like(pattern)
        )
        query = query.where(condition)
        count_query = count_query.where(condition)

    total_result = await session.execute(count_query)
    total = total_result.scalar_one()

    result = await session.execute(query.limit(limit).offset(offset))
    return result.scalars().all(), total


async def get_tracked_user(session: AsyncSession, tg_user_id: int) -> Optional[TrackedUser]:
    result = await session.execute(select(TrackedUser).where(TrackedUser.tg_user_id == tg_user_id))
    return result.scalar_one_or_none()


async def create_tracked_user(
    session: AsyncSession,
    *,
    tg_user_id: int,
    username: Optional[str],
    display_name: Optional[str],
    phone_e164: Optional[str],
    consent_basis: str,
    notes: Optional[str],
    consent_reference: Optional[str],
    tz: str,
) -> TrackedUser:
    now = datetime.now(timezone.utc)
    entity = TrackedUser(
        tg_user_id=tg_user_id,
        username=username,
        display_name=display_name,
        phone_e164=phone_e164,
        consent_basis=consent_basis,
        consent_at=now,
        added_at=now,
        tz=tz,
        notes=notes,
        consent_reference=consent_reference,
        track_enabled=True,
    )
    session.add(entity)
    await session.flush()
    return entity


async def update_tracked_user(
    session: AsyncSession,
    tg_user_id: int,
    **fields,
) -> Optional[TrackedUser]:
    fields = {k: v for k, v in fields.items() if v is not None}
    if not fields:
        return await get_tracked_user(session, tg_user_id)

    fields.setdefault("consent_at", datetime.now(timezone.utc) if "consent_basis" in fields else None)
    fields = {k: v for k, v in fields.items() if v is not None}

    await session.execute(
        update(TrackedUser).where(TrackedUser.tg_user_id == tg_user_id).values(**fields)
    )
    await session.flush()
    return await get_tracked_user(session, tg_user_id)


async def delete_tracked_user(session: AsyncSession, tg_user_id: int) -> bool:
    entity = await get_tracked_user(session, tg_user_id)
    if not entity:
        return False
    await session.delete(entity)
    await session.flush()
    return True
