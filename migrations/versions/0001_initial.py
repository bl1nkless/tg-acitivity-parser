"""initial schema

Revision ID: 0001_initial
Revises:
Create Date: 2025-10-13 21:39:00.000000
"""

from __future__ import annotations

from datetime import datetime

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "0001_initial"
down_revision = None
branch_labels = None
depends_on = None


userrole = sa.Enum("admin", "viewer", name="userrole")
statusprecision = sa.Enum("exact", "approx", name="statusprecision")
statuseventtype = sa.Enum("online", "offline", "recently", "last_week", "last_month", "unknown", name="statuseventtype")
statuseventsource = sa.Enum("update", "poll", "recovery", name="statuseventsource")
sessionclosedreason = sa.Enum("offline", "expiry", "poll", "manual", name="sessionclosedreason")


def upgrade() -> None:
    op.create_table(
        "account_user",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("email", sa.String(length=255), nullable=False, unique=True),
        sa.Column("password_hash", sa.String(length=255), nullable=False),
        sa.Column("role", userrole, nullable=False, server_default="viewer"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("TRUE")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.CheckConstraint("length(email) > 3", name="ck_account_user_email_len"),
    )

    op.create_table(
        "tracked_user",
        sa.Column("tg_user_id", sa.BigInteger(), primary_key=True),
        sa.Column("username", sa.String(length=255)),
        sa.Column("display_name", sa.String(length=255)),
        sa.Column("phone_e164", sa.String(length=32)),
        sa.Column("consent_basis", sa.String(length=16), nullable=False, server_default="oral"),
        sa.Column("consent_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("tz", sa.String(length=64), nullable=False, server_default="Europe/Kyiv"),
        sa.Column("track_enabled", sa.Boolean(), nullable=False, server_default=sa.text("TRUE")),
        sa.Column("added_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("notes", sa.String(length=512)),
        sa.Column("consent_reference", sa.String(length=255)),
    )

    op.create_table(
        "audit_log",
        sa.Column("id", sa.BigInteger(), primary_key=True),
        sa.Column("actor_id", sa.Integer(), sa.ForeignKey("account_user.id", ondelete="SET NULL")),
        sa.Column("action", sa.String(length=64), nullable=False),
        sa.Column("entity", sa.String(length=64)),
        sa.Column("entity_id", sa.String(length=128)),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("payload", sa.JSON()),
    )

    op.create_table(
        "status_event",
        sa.Column("id", sa.BigInteger(), primary_key=True),
        sa.Column(
            "tg_user_id",
            sa.BigInteger(),
            sa.ForeignKey("tracked_user.tg_user_id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("status", statuseventtype, nullable=False),
        sa.Column("source_precision", statusprecision, nullable=False),
        sa.Column("ts", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("expires_at", sa.DateTime(timezone=True)),
        sa.Column("source", statuseventsource, nullable=False),
        sa.Column("raw", sa.JSON()),
    )
    op.create_index("ix_status_event_user_ts", "status_event", ["tg_user_id", "ts"])

    op.create_table(
        "online_session",
        sa.Column("id", sa.BigInteger(), primary_key=True),
        sa.Column(
            "tg_user_id",
            sa.BigInteger(),
            sa.ForeignKey("tracked_user.tg_user_id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("ts_from", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("ts_to", sa.DateTime(timezone=True)),
        sa.Column("source_precision", statusprecision, nullable=False),
        sa.Column("closed_reason", sessionclosedreason),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.CheckConstraint("ts_to IS NULL OR ts_to >= ts_from", name="ck_online_session_ts_range"),
    )
    op.create_index("ix_online_session_user_from", "online_session", ["tg_user_id", "ts_from"])

    op.create_table(
        "agg_hourly",
        sa.Column("bucket_start", sa.DateTime(timezone=True), primary_key=True),
        sa.Column(
            "tg_user_id",
            sa.BigInteger(),
            sa.ForeignKey("tracked_user.tg_user_id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column("online_seconds", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.CheckConstraint("online_seconds >= 0", name="ck_agg_hourly_non_negative"),
    )


def downgrade() -> None:
    op.drop_table("agg_hourly")
    op.drop_index("ix_online_session_user_from", table_name="online_session")
    op.drop_table("online_session")
    op.drop_index("ix_status_event_user_ts", table_name="status_event")
    op.drop_table("status_event")
    op.drop_table("audit_log")
    op.drop_table("tracked_user")
    op.drop_table("account_user")
    sessionclosedreason.drop(op.get_bind(), checkfirst=False)
    statuseventsource.drop(op.get_bind(), checkfirst=False)
    statuseventtype.drop(op.get_bind(), checkfirst=False)
    statusprecision.drop(op.get_bind(), checkfirst=False)
    userrole.drop(op.get_bind(), checkfirst=False)
