"""chat active authors

Revision ID: 0002_chat_active_authors
Revises: 0001_initial
Create Date: 2026-03-03 15:32:00.000000
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op


revision = "0002_chat_active_authors"
down_revision = "0001_initial"
branch_labels = None
depends_on = None


chatauthorjobstatus = sa.Enum(
    "queued",
    "running",
    "paused_flood_wait",
    "completed",
    "failed",
    "cancelled",
    name="chatauthorjobstatus",
)


def upgrade() -> None:
    op.create_table(
        "telegram_chats",
        sa.Column("id", sa.BigInteger(), primary_key=True),
        sa.Column("telegram_chat_id", sa.BigInteger(), nullable=False, unique=True),
        sa.Column("access_hash", sa.BigInteger()),
        sa.Column("username", sa.String(length=255)),
        sa.Column("title", sa.String(length=255)),
        sa.Column("chat_type", sa.String(length=32), nullable=False, server_default="unknown"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("TRUE")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("idx_telegram_chats_username", "telegram_chats", ["username"])

    op.create_table(
        "telegram_users",
        sa.Column("telegram_user_id", sa.BigInteger(), primary_key=True, autoincrement=False),
        sa.Column("access_hash", sa.BigInteger()),
        sa.Column("username", sa.String(length=255)),
        sa.Column("first_name", sa.String(length=255)),
        sa.Column("last_name", sa.String(length=255)),
        sa.Column("is_bot", sa.Boolean()),
        sa.Column("first_seen_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("last_seen_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("idx_telegram_users_username", "telegram_users", ["username"])

    op.create_table(
        "telegram_chat_author_jobs",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "telegram_chat_id",
            sa.BigInteger(),
            sa.ForeignKey("telegram_chats.telegram_chat_id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("requested_by_account_user_id", sa.Integer(), sa.ForeignKey("account_user.id", ondelete="SET NULL")),
        sa.Column("lookback_days", sa.Integer(), nullable=False),
        sa.Column("period_start", sa.DateTime(timezone=True), nullable=False),
        sa.Column("period_end", sa.DateTime(timezone=True), nullable=False),
        sa.Column("status", chatauthorjobstatus, nullable=False),
        sa.Column("cursor_message_id", sa.BigInteger()),
        sa.Column("cursor_message_date", sa.DateTime(timezone=True)),
        sa.Column("scanned_messages_count", sa.BigInteger(), nullable=False, server_default="0"),
        sa.Column("unique_authors_count", sa.BigInteger(), nullable=False, server_default="0"),
        sa.Column("flood_wait_until", sa.DateTime(timezone=True)),
        sa.Column("error_code", sa.String(length=64)),
        sa.Column("error_message", sa.String(length=512)),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("started_at", sa.DateTime(timezone=True)),
        sa.Column("finished_at", sa.DateTime(timezone=True)),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.CheckConstraint("lookback_days >= 1", name="chk_chat_author_lookback_days_positive"),
    )
    op.create_index("idx_chat_author_jobs_status", "telegram_chat_author_jobs", ["status"])
    op.create_index("idx_chat_author_jobs_chat_time", "telegram_chat_author_jobs", ["telegram_chat_id", "created_at"])

    op.create_table(
        "telegram_chat_active_authors",
        sa.Column("id", sa.BigInteger(), primary_key=True),
        sa.Column(
            "telegram_chat_id",
            sa.BigInteger(),
            sa.ForeignKey("telegram_chats.telegram_chat_id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "telegram_user_id",
            sa.BigInteger(),
            sa.ForeignKey("telegram_users.telegram_user_id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("period_start", sa.DateTime(timezone=True), nullable=False),
        sa.Column("period_end", sa.DateTime(timezone=True), nullable=False),
        sa.Column("message_count", sa.BigInteger(), nullable=False, server_default="0"),
        sa.Column("first_message_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("last_message_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("source_job_id", sa.Uuid(), sa.ForeignKey("telegram_chat_author_jobs.id", ondelete="CASCADE"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint(
            "telegram_chat_id",
            "telegram_user_id",
            "period_start",
            "period_end",
            name="uq_active_author_chat_user_period",
        ),
    )
    op.create_index(
        "idx_active_authors_chat_period",
        "telegram_chat_active_authors",
        ["telegram_chat_id", "period_start", "period_end"],
    )
    op.create_index("idx_active_authors_user", "telegram_chat_active_authors", ["telegram_user_id"])
    op.create_index("idx_active_authors_message_count", "telegram_chat_active_authors", ["message_count"])


def downgrade() -> None:
    op.drop_index("idx_active_authors_message_count", table_name="telegram_chat_active_authors")
    op.drop_index("idx_active_authors_user", table_name="telegram_chat_active_authors")
    op.drop_index("idx_active_authors_chat_period", table_name="telegram_chat_active_authors")
    op.drop_table("telegram_chat_active_authors")
    op.drop_index("idx_chat_author_jobs_chat_time", table_name="telegram_chat_author_jobs")
    op.drop_index("idx_chat_author_jobs_status", table_name="telegram_chat_author_jobs")
    op.drop_table("telegram_chat_author_jobs")
    op.drop_index("idx_telegram_users_username", table_name="telegram_users")
    op.drop_table("telegram_users")
    op.drop_index("idx_telegram_chats_username", table_name="telegram_chats")
    op.drop_table("telegram_chats")
    chatauthorjobstatus.drop(op.get_bind(), checkfirst=True)
