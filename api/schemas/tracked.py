from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class TrackedUserCreate(BaseModel):
    tg_user_id: int = Field(..., gt=0)
    username: Optional[str] = None
    display_name: Optional[str] = None
    phone_e164: Optional[str] = None
    consent_basis: str = Field(default="oral")
    notes: Optional[str] = None
    consent_reference: Optional[str] = None
    tz: str = Field(default="Europe/Kyiv")


class TrackedUserUpdate(BaseModel):
    username: Optional[str] = None
    display_name: Optional[str] = None
    phone_e164: Optional[str] = None
    consent_basis: Optional[str] = None
    notes: Optional[str] = None
    consent_reference: Optional[str] = None
    tz: Optional[str] = None
    track_enabled: Optional[bool] = None


class TrackedUserOut(BaseModel):
    tg_user_id: int
    username: Optional[str]
    display_name: Optional[str]
    phone_e164: Optional[str]
    consent_basis: str
    consent_at: datetime
    tz: str
    track_enabled: bool
    added_at: datetime
    notes: Optional[str]
    consent_reference: Optional[str]

    class Config:
        from_attributes = True
