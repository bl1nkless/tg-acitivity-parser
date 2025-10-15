from __future__ import annotations

from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from common.models import AccountUser, StatusPrecision

from ..auth.dependencies import get_current_user
from ..core.db import get_db
from ..schemas.common import PaginatedResponse
from ..schemas.session import OnlineSessionOut, StatusEventOut
from ..services import sessions as sessions_service
from ..services import tracked as tracked_service

router = APIRouter(prefix="/users", tags=["sessions"])


async def _ensure_tracked(session: AsyncSession, tg_user_id: int) -> None:
    entity = await tracked_service.get_tracked_user(session, tg_user_id)
    if not entity:
        raise HTTPException(status_code=404, detail="Tracked user not found")


@router.get("/{tg_user_id}/sessions", response_model=PaginatedResponse[OnlineSessionOut])
async def list_sessions(
    tg_user_id: int,
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    precision: Optional[StatusPrecision] = Query(default=None),
    since: Optional[datetime] = Query(default=None),
    until: Optional[datetime] = Query(default=None),
    session: AsyncSession = Depends(get_db),
    _: AccountUser = Depends(get_current_user),
) -> PaginatedResponse[OnlineSessionOut]:
    await _ensure_tracked(session, tg_user_id)
    items, total = await sessions_service.list_sessions(
        session,
        tg_user_id,
        limit=limit,
        offset=offset,
        precision=precision,
        since=since,
        until=until,
    )
    return PaginatedResponse[OnlineSessionOut](
        items=[OnlineSessionOut.model_validate(item) for item in items],
        total=total,
        limit=limit,
        offset=offset,
    )


@router.get("/{tg_user_id}/events", response_model=PaginatedResponse[StatusEventOut])
async def list_events(
    tg_user_id: int,
    limit: int = Query(200, ge=1, le=1000),
    offset: int = Query(0, ge=0),
    precision: Optional[StatusPrecision] = Query(default=None),
    since: Optional[datetime] = Query(default=None),
    until: Optional[datetime] = Query(default=None),
    session: AsyncSession = Depends(get_db),
    _: AccountUser = Depends(get_current_user),
) -> PaginatedResponse[StatusEventOut]:
    await _ensure_tracked(session, tg_user_id)
    items, total = await sessions_service.list_status_events(
        session,
        tg_user_id,
        limit=limit,
        offset=offset,
        precision=precision,
        since=since,
        until=until,
    )
    return PaginatedResponse[StatusEventOut](
        items=[StatusEventOut.model_validate(item) for item in items],
        total=total,
        limit=limit,
        offset=offset,
    )
