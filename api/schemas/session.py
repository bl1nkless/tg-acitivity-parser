from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel

from common.models import SessionClosedReason, StatusEventSource, StatusEventType, StatusPrecision


class StatusEventOut(BaseModel):
    id: int
    tg_user_id: int
    status: StatusEventType
    source_precision: StatusPrecision
    ts: datetime
    expires_at: Optional[datetime]
    source: StatusEventSource
    raw: Optional[dict]

    class Config:
        from_attributes = True


class OnlineSessionOut(BaseModel):
    id: int
    tg_user_id: int
    ts_from: datetime
    ts_to: Optional[datetime]
    source_precision: StatusPrecision
    closed_reason: Optional[SessionClosedReason]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
