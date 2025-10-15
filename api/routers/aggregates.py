from __future__ import annotations

from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from common.models import AccountUser

from ..auth.dependencies import get_current_user
from ..core.db import get_db
from ..schemas.aggregate import HeatmapCell, HeatmapResponse, HourlyAggregate
from ..services import aggregates as aggregates_service
from ..services import tracked as tracked_service

router = APIRouter(prefix="/users", tags=["aggregates"])


async def _ensure_tracked(session: AsyncSession, tg_user_id: int) -> None:
    entity = await tracked_service.get_tracked_user(session, tg_user_id)
    if not entity:
        raise HTTPException(status_code=404, detail="Tracked user not found")


@router.get("/{tg_user_id}/agg/hourly", response_model=List[HourlyAggregate])
async def get_hourly(
    tg_user_id: int,
    since: Optional[datetime] = Query(default=None),
    until: Optional[datetime] = Query(default=None),
    session: AsyncSession = Depends(get_db),
    _: AccountUser = Depends(get_current_user),
) -> List[HourlyAggregate]:
    await _ensure_tracked(session, tg_user_id)
    items = await aggregates_service.list_hourly_aggregates(
        session,
        tg_user_id,
        since=since,
        until=until,
    )
    return [HourlyAggregate.model_validate(item) for item in items]


@router.get("/{tg_user_id}/agg/heatmap", response_model=HeatmapResponse)
async def get_heatmap(
    tg_user_id: int,
    since: Optional[datetime] = Query(default=None),
    until: Optional[datetime] = Query(default=None),
    session: AsyncSession = Depends(get_db),
    _: AccountUser = Depends(get_current_user),
) -> HeatmapResponse:
    await _ensure_tracked(session, tg_user_id)
    rows = await aggregates_service.get_heatmap(
        session,
        tg_user_id,
        since=since,
        until=until,
    )
    cells = [HeatmapCell(weekday=row[0], hour=row[1], online_seconds=row[2]) for row in rows]
    return HeatmapResponse(tg_user_id=tg_user_id, cells=cells)
