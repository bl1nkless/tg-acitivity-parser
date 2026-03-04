from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, Field


class ChatResolveRequest(BaseModel):
    chat_ref: str = Field(min_length=1, max_length=255)


class TelegramChatOut(BaseModel):
    telegram_chat_id: int
    access_hash: int | None
    username: str | None
    title: str | None
    chat_type: str

    class Config:
        from_attributes = True


class ChatAuthorJobCreate(BaseModel):
    telegram_chat_id: int
    lookback_days: int | None = Field(default=None, ge=1)


class ChatAuthorJobOut(BaseModel):
    id: uuid.UUID
    telegram_chat_id: int
    lookback_days: int
    period_start: datetime
    period_end: datetime
    status: str
    cursor_message_id: int | None
    cursor_message_date: datetime | None
    scanned_messages_count: int
    unique_authors_count: int
    flood_wait_until: datetime | None
    error_code: str | None
    error_message: str | None
    created_at: datetime
    started_at: datetime | None
    finished_at: datetime | None
    updated_at: datetime

    class Config:
        from_attributes = True


class ChatActiveAuthorOut(BaseModel):
    telegram_chat_id: int
    telegram_user_id: int
    username: str | None
    first_name: str | None
    last_name: str | None
    is_bot: bool | None
    message_count: int
    first_message_at: datetime
    last_message_at: datetime


class ChatActiveAuthorsResponse(BaseModel):
    items: list[ChatActiveAuthorOut]
    total: int
    limit: int
    offset: int
    period_start: datetime | None = None
    period_end: datetime | None = None
    latest_job: ChatAuthorJobOut | None = None
