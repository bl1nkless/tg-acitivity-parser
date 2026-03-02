from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field, model_validator


class TrackedUserCreate(BaseModel):
    tg_user_id: Optional[int] = Field(default=None, gt=0)
    username: Optional[str] = None
    display_name: Optional[str] = None
    phone_e164: Optional[str] = None

    notes: Optional[str] = None
    consent_reference: Optional[str] = None
    tz: str = Field(default="Europe/Kyiv")

    @model_validator(mode="after")
    def require_id_or_username(self) -> "TrackedUserCreate":
        if self.tg_user_id is None and not (self.username and self.username.strip()):
            raise ValueError("Telegram ID or username is required")
        return self


class TrackedUserUpdate(BaseModel):
    username: Optional[str] = None
    display_name: Optional[str] = None
    phone_e164: Optional[str] = None

    notes: Optional[str] = None
    consent_reference: Optional[str] = None
    tz: Optional[str] = None
    track_enabled: Optional[bool] = None


class TrackedUserOut(BaseModel):
    tg_user_id: int
    username: Optional[str]
    display_name: Optional[str]
    phone_e164: Optional[str]

    consent_at: datetime
    tz: str
    track_enabled: bool
    added_at: datetime
    notes: Optional[str]
    consent_reference: Optional[str]

    class Config:
        from_attributes = True
