from __future__ import annotations

import csv
import io
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from common.models import AccountUser, StatusPrecision

from ..auth.dependencies import get_current_user
from ..core.db import get_db
from ..services import sessions as sessions_service
from ..services import tracked as tracked_service

router = APIRouter(prefix="/users", tags=["export"])


async def _ensure_tracked(session: AsyncSession, tg_user_id: int) -> None:
    entity = await tracked_service.get_tracked_user(session, tg_user_id)
    if not entity:
        raise HTTPException(status_code=404, detail="Tracked user not found")


@router.get("/{tg_user_id}/export/sessions.csv")
async def export_sessions_csv(
    tg_user_id: int,
    precision: Optional[StatusPrecision] = Query(default=None),
    since: Optional[datetime] = Query(default=None),
    until: Optional[datetime] = Query(default=None),
    session: AsyncSession = Depends(get_db),
    _: AccountUser = Depends(get_current_user),
) -> StreamingResponse:
    await _ensure_tracked(session, tg_user_id)
    items, _ = await sessions_service.list_sessions(
        session,
        tg_user_id,
        limit=10_000,
        offset=0,
        precision=precision,
        since=since,
        until=until,
    )

    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(
        ["session_id", "tg_user_id", "ts_from", "ts_to", "precision", "closed_reason", "created_at", "updated_at"]
    )
    for item in items:
        writer.writerow(
            [
                item.id,
                item.tg_user_id,
                item.ts_from.isoformat(),
                item.ts_to.isoformat() if item.ts_to else "",
                item.source_precision.value,
                item.closed_reason.value if item.closed_reason else "",
                item.created_at.isoformat(),
                item.updated_at.isoformat(),
            ]
        )
    buffer.seek(0)
    filename = f"sessions_{tg_user_id}.csv"
    return StreamingResponse(
        iter([buffer.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/{tg_user_id}/export/sessions.json")
async def export_sessions_json(
    tg_user_id: int,
    precision: Optional[StatusPrecision] = Query(default=None),
    since: Optional[datetime] = Query(default=None),
    until: Optional[datetime] = Query(default=None),
    session: AsyncSession = Depends(get_db),
    _: AccountUser = Depends(get_current_user),
) -> list[dict]:
    await _ensure_tracked(session, tg_user_id)
    items, _ = await sessions_service.list_sessions(
        session,
        tg_user_id,
        limit=10_000,
        offset=0,
        precision=precision,
        since=since,
        until=until,
    )
    return [
        {
            "id": item.id,
            "tg_user_id": item.tg_user_id,
            "ts_from": item.ts_from.isoformat(),
            "ts_to": item.ts_to.isoformat() if item.ts_to else None,
            "source_precision": item.source_precision.value,
            "closed_reason": item.closed_reason.value if item.closed_reason else None,
            "created_at": item.created_at.isoformat(),
            "updated_at": item.updated_at.isoformat(),
        }
        for item in items
    ]
