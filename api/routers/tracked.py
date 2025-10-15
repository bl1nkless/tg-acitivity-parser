from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from common.models import AccountUser

from ..auth.dependencies import get_current_admin, get_current_user
from ..core.db import get_db
from ..schemas.common import DeleteResponse, PaginatedResponse
from ..schemas.tracked import TrackedUserCreate, TrackedUserOut, TrackedUserUpdate
from ..services import tracked as tracked_service

router = APIRouter(prefix="/tracked", tags=["tracked"])


@router.get("/", response_model=PaginatedResponse[TrackedUserOut])
async def list_tracked(
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    q: str | None = Query(default=None, alias="search"),
    session: AsyncSession = Depends(get_db),
    current_user: AccountUser = Depends(get_current_user),
) -> PaginatedResponse[TrackedUserOut]:
    items, total = await tracked_service.list_tracked_users(session, limit=limit, offset=offset, search=q)
    return PaginatedResponse[TrackedUserOut](
        items=[TrackedUserOut.model_validate(item) for item in items],
        total=total,
        limit=limit,
        offset=offset,
    )


@router.post("/", response_model=TrackedUserOut, status_code=status.HTTP_201_CREATED)
async def create_tracked(
    payload: TrackedUserCreate,
    session: AsyncSession = Depends(get_db),
    _: AccountUser = Depends(get_current_admin),
) -> TrackedUserOut:
    existing = await tracked_service.get_tracked_user(session, payload.tg_user_id)
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="User already tracked")
    entity = await tracked_service.create_tracked_user(
        session,
        tg_user_id=payload.tg_user_id,
        username=payload.username,
        display_name=payload.display_name,
        phone_e164=payload.phone_e164,
        consent_basis=payload.consent_basis,
        notes=payload.notes,
        consent_reference=payload.consent_reference,
        tz=payload.tz,
    )
    return TrackedUserOut.model_validate(entity)


@router.get("/{tg_user_id}", response_model=TrackedUserOut)
async def get_tracked(
    tg_user_id: int,
    session: AsyncSession = Depends(get_db),
    _: AccountUser = Depends(get_current_user),
) -> TrackedUserOut:
    entity = await tracked_service.get_tracked_user(session, tg_user_id)
    if not entity:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tracked user not found")
    return TrackedUserOut.model_validate(entity)


@router.patch("/{tg_user_id}", response_model=TrackedUserOut)
async def update_tracked(
    tg_user_id: int,
    payload: TrackedUserUpdate,
    session: AsyncSession = Depends(get_db),
    _: AccountUser = Depends(get_current_admin),
) -> TrackedUserOut:
    entity = await tracked_service.update_tracked_user(session, tg_user_id, **payload.model_dump(exclude_none=True))
    if not entity:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tracked user not found")
    return TrackedUserOut.model_validate(entity)


@router.delete("/{tg_user_id}", response_model=DeleteResponse)
async def delete_tracked(
    tg_user_id: int,
    purge: bool = Query(default=True, description="Hard delete the user and cascade all data"),
    session: AsyncSession = Depends(get_db),
    _: AccountUser = Depends(get_current_admin),
) -> DeleteResponse:
    if purge:
        deleted = await tracked_service.delete_tracked_user(session, tg_user_id)
        if not deleted:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tracked user not found")
        return DeleteResponse(deleted=True)
    else:
        entity = await tracked_service.update_tracked_user(session, tg_user_id, track_enabled=False)
        if not entity:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tracked user not found")
        return DeleteResponse(deleted=True, detail="Tracking disabled without data removal")
