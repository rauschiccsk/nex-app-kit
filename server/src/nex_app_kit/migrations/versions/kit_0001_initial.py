"""The kit's tables: people, sessions, used launch tickets, system and agent settings, layouts.

Revision ID: kit_0001
Revises:
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "kit_0001"
down_revision = None
branch_labels = None
depends_on = None

UUID = postgresql.UUID(as_uuid=True)


def _now() -> sa.Column:
    return sa.text("now()")


def upgrade() -> None:
    op.create_table(
        "kit_users",
        sa.Column("id", UUID, primary_key=True),
        sa.Column("username", sa.String(100), nullable=False),
        sa.Column("email", sa.String(255)),
        sa.Column("password_hash", sa.String(255)),
        sa.Column("role", sa.String(10), nullable=False),
        sa.Column("is_active", sa.Boolean, nullable=False),
        sa.Column("first_name", sa.String(100)),
        sa.Column("last_name", sa.String(100)),
        sa.Column("must_change_password", sa.Boolean, nullable=False),
        sa.Column("failed_logins", sa.Integer, nullable=False),
        sa.Column("locked_until", sa.DateTime(timezone=True)),
        sa.Column("source", sa.String(10), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=_now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=_now()),
        sa.CheckConstraint("role IN ('admin', 'user')", name="ck_kit_users_role"),
        sa.CheckConstraint("source IN ('local', 'manager')", name="ck_kit_users_source"),
        sa.UniqueConstraint("username", name="uq_kit_users_username"),
        sa.UniqueConstraint("email", name="uq_kit_users_email"),
    )
    op.create_table(
        "kit_sessions",
        sa.Column("id", UUID, primary_key=True),
        sa.Column("token_hash", sa.String(64), nullable=False),
        sa.Column(
            "user_id",
            UUID,
            sa.ForeignKey("kit_users.id", ondelete="CASCADE", name="fk_kit_sessions_user_id_kit_users"),
            nullable=False,
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=_now()),
        sa.Column("last_seen_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("verified_at", sa.DateTime(timezone=True)),
        sa.Column("manager_token_version", sa.Integer),
        sa.Column("user_agent", sa.String(200)),
        sa.UniqueConstraint("token_hash", name="uq_kit_sessions_token_hash"),
    )
    op.create_index("ix_kit_sessions_user_id", "kit_sessions", ["user_id"])
    op.create_table(
        "kit_used_launch_tokens",
        sa.Column("jti", sa.String(64), primary_key=True),
        sa.Column("login", sa.String(100), nullable=False),
        sa.Column("used_at", sa.DateTime(timezone=True), nullable=False, server_default=_now()),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_table(
        "kit_system_settings",
        sa.Column("key", sa.String(100), primary_key=True),
        sa.Column("value", sa.Text, nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=_now()),
        sa.Column(
            "updated_by",
            UUID,
            sa.ForeignKey("kit_users.id", ondelete="SET NULL", name="fk_kit_system_settings_updated_by_kit_users"),
        ),
    )
    op.create_table(
        "kit_agent_settings",
        sa.Column("role", sa.String(32), primary_key=True),
        sa.Column("model", sa.String(16)),
        sa.Column("effort", sa.String(16)),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=_now()),
        sa.Column(
            "updated_by",
            UUID,
            sa.ForeignKey("kit_users.id", ondelete="SET NULL", name="fk_kit_agent_settings_updated_by_kit_users"),
        ),
    )
    op.create_table(
        "kit_user_layouts",
        sa.Column(
            "user_id",
            UUID,
            sa.ForeignKey("kit_users.id", ondelete="CASCADE", name="fk_kit_user_layouts_user_id_kit_users"),
            primary_key=True,
        ),
        sa.Column("sidebar_width", sa.Integer),
        sa.Column("sidebar_collapsed", sa.Boolean, nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=_now()),
        sa.CheckConstraint(
            "sidebar_width IS NULL OR sidebar_width BETWEEN 180 AND 360", name="ck_kit_user_layouts_sidebar_width"
        ),
    )


def downgrade() -> None:
    for table in (
        "kit_user_layouts",
        "kit_agent_settings",
        "kit_system_settings",
        "kit_used_launch_tokens",
        "kit_sessions",
        "kit_users",
    ):
        op.drop_table(table)
