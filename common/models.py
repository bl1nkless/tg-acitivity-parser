from __future__ import annotations

import enum
import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import BigInteger, Boolean, CheckConstraint, DateTime, Enum, ForeignKey, Index, Integer, JSON, String, UniqueConstraint, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .db import Base


class UserRole(str, enum.Enum):
    ADMIN = "admin"
    VIEWER = "viewer"


class StatusPrecision(str, enum.Enum):
    EXACT = "exact"
    APPROX = "approx"


class StatusEventType(str, enum.Enum):
    ONLINE = "online"
    OFFLINE = "offline"
    RECENTLY = "recently"
    LAST_WEEK = "last_week"
    LAST_MONTH = "last_month"
    UNKNOWN = "unknown"


class StatusEventSource(str, enum.Enum):
    UPDATE = "update"
    POLL = "poll"
    RECOVERY = "recovery"


class SessionClosedReason(str, enum.Enum):
    OFFLINE = "offline"
    EXPIRY = "expiry"
    POLL = "poll"
    MANUAL = "manual"


class ChatAuthorJobStatus(str, enum.Enum):
    QUEUED = "queued"
    RUNNING = "running"
    PAUSED_FLOOD_WAIT = "paused_flood_wait"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


def enum_for(enum_cls: enum.EnumMeta, name: str) -> Enum:
    return Enum(
        enum_cls,
        values_callable=lambda obj: [member.value for member in obj],
        name=name,
    )


class AccountUser(Base):
    __tablename__ = "account_user"
    __table_args__ = (
        CheckConstraint("length(email) > 3", name="ck_account_user_email_len"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[UserRole] = mapped_column(enum_for(UserRole, "userrole"), nullable=False, default=UserRole.VIEWER)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    audit_logs: Mapped[list["AuditLog"]] = relationship("AuditLog", back_populates="actor")


class TrackedUser(Base):
    __tablename__ = "tracked_user"

    tg_user_id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    username: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    display_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    phone_e164: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    consent_basis: Mapped[str] = mapped_column(
        String(16),
        nullable=False,
        default="oral",
    )
    consent_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    tz: Mapped[str] = mapped_column(String(64), nullable=False, default="Europe/Kyiv")
    track_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    added_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    notes: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)
    consent_reference: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

    status_events: Mapped[list["StatusEvent"]] = relationship(
        "StatusEvent", back_populates="user", cascade="all, delete-orphan"
    )
    online_sessions: Mapped[list["OnlineSession"]] = relationship(
        "OnlineSession", back_populates="user", cascade="all, delete-orphan"
    )


class TelegramChat(Base):
    __tablename__ = "telegram_chats"
    __table_args__ = (
        Index("idx_telegram_chats_username", "username"),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    telegram_chat_id: Mapped[int] = mapped_column(BigInteger, unique=True, nullable=False)
    access_hash: Mapped[Optional[int]] = mapped_column(BigInteger, nullable=True)
    username: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    title: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    chat_type: Mapped[str] = mapped_column(String(32), nullable=False, default="unknown")
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    jobs: Mapped[list["TelegramChatAuthorJob"]] = relationship("TelegramChatAuthorJob", back_populates="chat")
    active_authors: Mapped[list["TelegramChatActiveAuthor"]] = relationship("TelegramChatActiveAuthor", back_populates="chat")


class TelegramUser(Base):
    __tablename__ = "telegram_users"
    __table_args__ = (
        Index("idx_telegram_users_username", "username"),
    )

    telegram_user_id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=False)
    access_hash: Mapped[Optional[int]] = mapped_column(BigInteger, nullable=True)
    username: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    first_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    last_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    is_bot: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)
    first_seen_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    last_seen_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    active_author_rows: Mapped[list["TelegramChatActiveAuthor"]] = relationship("TelegramChatActiveAuthor", back_populates="user")


class TelegramChatAuthorJob(Base):
    __tablename__ = "telegram_chat_author_jobs"
    __table_args__ = (
        CheckConstraint("lookback_days >= 1", name="chk_chat_author_lookback_days_positive"),
        Index("idx_chat_author_jobs_status", "status"),
        Index("idx_chat_author_jobs_chat_time", "telegram_chat_id", "created_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    telegram_chat_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey("telegram_chats.telegram_chat_id", ondelete="CASCADE"),
        nullable=False,
    )
    requested_by_account_user_id: Mapped[Optional[int]] = mapped_column(ForeignKey("account_user.id", ondelete="SET NULL"))
    lookback_days: Mapped[int] = mapped_column(Integer, nullable=False)
    period_start: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    period_end: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    status: Mapped[ChatAuthorJobStatus] = mapped_column(enum_for(ChatAuthorJobStatus, "chatauthorjobstatus"), nullable=False)
    cursor_message_id: Mapped[Optional[int]] = mapped_column(BigInteger, nullable=True)
    cursor_message_date: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    scanned_messages_count: Mapped[int] = mapped_column(BigInteger, nullable=False, default=0)
    unique_authors_count: Mapped[int] = mapped_column(BigInteger, nullable=False, default=0)
    flood_wait_until: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    error_code: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    error_message: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    started_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    finished_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    chat: Mapped[TelegramChat] = relationship("TelegramChat", back_populates="jobs")
    active_authors: Mapped[list["TelegramChatActiveAuthor"]] = relationship("TelegramChatActiveAuthor", back_populates="source_job")


class TelegramChatActiveAuthor(Base):
    __tablename__ = "telegram_chat_active_authors"
    __table_args__ = (
        UniqueConstraint("telegram_chat_id", "telegram_user_id", "period_start", "period_end", name="uq_active_author_chat_user_period"),
        Index("idx_active_authors_chat_period", "telegram_chat_id", "period_start", "period_end"),
        Index("idx_active_authors_user", "telegram_user_id"),
        Index("idx_active_authors_message_count", "message_count"),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    telegram_chat_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey("telegram_chats.telegram_chat_id", ondelete="CASCADE"),
        nullable=False,
    )
    telegram_user_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey("telegram_users.telegram_user_id", ondelete="CASCADE"),
        nullable=False,
    )
    period_start: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    period_end: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    message_count: Mapped[int] = mapped_column(BigInteger, nullable=False, default=0)
    first_message_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    last_message_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    source_job_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("telegram_chat_author_jobs.id", ondelete="CASCADE"),
        nullable=False,
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    chat: Mapped[TelegramChat] = relationship("TelegramChat", back_populates="active_authors")
    user: Mapped[TelegramUser] = relationship("TelegramUser", back_populates="active_author_rows")
    source_job: Mapped[TelegramChatAuthorJob] = relationship("TelegramChatAuthorJob", back_populates="active_authors")


class StatusEvent(Base):
    __tablename__ = "status_event"
    __table_args__ = (
        Index("ix_status_event_user_ts", "tg_user_id", "ts"),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    tg_user_id: Mapped[int] = mapped_column(ForeignKey("tracked_user.tg_user_id", ondelete="CASCADE"))
    status: Mapped[StatusEventType] = mapped_column(enum_for(StatusEventType, "statuseventtype"), nullable=False)
    source_precision: Mapped[StatusPrecision] = mapped_column(enum_for(StatusPrecision, "statusprecision"), nullable=False)
    ts: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    expires_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    source: Mapped[StatusEventSource] = mapped_column(enum_for(StatusEventSource, "statuseventsource"), nullable=False)
    raw: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)

    user: Mapped[TrackedUser] = relationship("TrackedUser", back_populates="status_events")


class OnlineSession(Base):
    __tablename__ = "online_session"
    __table_args__ = (
        Index("ix_online_session_user_from", "tg_user_id", "ts_from"),
        CheckConstraint("ts_to IS NULL OR ts_to >= ts_from", name="ck_online_session_ts_range"),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    tg_user_id: Mapped[int] = mapped_column(ForeignKey("tracked_user.tg_user_id", ondelete="CASCADE"))
    ts_from: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    ts_to: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    source_precision: Mapped[StatusPrecision] = mapped_column(enum_for(StatusPrecision, "statusprecision"), nullable=False)
    closed_reason: Mapped[Optional[SessionClosedReason]] = mapped_column(
        enum_for(SessionClosedReason, "sessionclosedreason"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    user: Mapped[TrackedUser] = relationship("TrackedUser", back_populates="online_sessions")


class AggHourly(Base):
    __tablename__ = "agg_hourly"
    __table_args__ = (
        CheckConstraint("online_seconds >= 0", name="ck_agg_hourly_non_negative"),
    )

    bucket_start: Mapped[datetime] = mapped_column(DateTime(timezone=True), primary_key=True)
    tg_user_id: Mapped[int] = mapped_column(
        ForeignKey("tracked_user.tg_user_id", ondelete="CASCADE"), primary_key=True
    )
    online_seconds: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)


class AuditLog(Base):
    __tablename__ = "audit_log"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    actor_id: Mapped[Optional[int]] = mapped_column(ForeignKey("account_user.id", ondelete="SET NULL"))
    action: Mapped[str] = mapped_column(String(64), nullable=False)
    entity: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    entity_id: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    payload: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)

    actor: Mapped[Optional[AccountUser]] = relationship("AccountUser", back_populates="audit_logs")
