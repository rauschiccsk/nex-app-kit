"""The web's own accounts and sessions (DEV-523).

26.11.2026: an app on the template may have a web (``web/``) beside its administration — the priests of
orthodox-register sign in there by e-mail. The web's accounts are separate from the administration's (one e-mail may be
on several of those, DEV-310): the e-mail is unique among them, and a registration is a request the admin decides.

Revision ID: kit_0004
Revises: kit_0003
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID as PG_UUID

revision = "kit_0004"
down_revision = "kit_0003"
branch_labels = None
depends_on = None

UUID = PG_UUID(as_uuid=True)


def _now():
    return sa.text("now()")


def upgrade() -> None:
    op.create_table(
        "kit_web_accounts",
        sa.Column("id", UUID, primary_key=True),
        sa.Column("email", sa.String(255), nullable=False),
        sa.Column("password_hash", sa.String(255), nullable=False),
        sa.Column("first_name", sa.String(100)),
        sa.Column("last_name", sa.String(100)),
        sa.Column("status", sa.String(10), nullable=False),
        sa.Column("language", sa.String(8)),
        sa.Column("failed_logins", sa.Integer, nullable=False),
        sa.Column("locked_until", sa.DateTime(timezone=True)),
        sa.Column(
            "decided_by",
            UUID,
            sa.ForeignKey("kit_users.id", ondelete="SET NULL", name="fk_kit_web_accounts_decided_by_kit_users"),
        ),
        sa.Column("decided_at", sa.DateTime(timezone=True)),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=_now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=_now()),
        sa.CheckConstraint(
            "status IN ('pending', 'active', 'rejected', 'disabled')", name="ck_kit_web_accounts_status"
        ),
        sa.UniqueConstraint("email", name="uq_kit_web_accounts_email"),
    )
    op.create_table(
        "kit_web_sessions",
        sa.Column("id", UUID, primary_key=True),
        sa.Column("token_hash", sa.String(64), nullable=False),
        sa.Column(
            "account_id",
            UUID,
            sa.ForeignKey(
                "kit_web_accounts.id", ondelete="CASCADE", name="fk_kit_web_sessions_account_id_kit_web_accounts"
            ),
            nullable=False,
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=_now()),
        sa.Column("last_seen_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("user_agent", sa.String(200)),
        sa.UniqueConstraint("token_hash", name="uq_kit_web_sessions_token_hash"),
    )
    op.create_index("ix_kit_web_sessions_account_id", "kit_web_sessions", ["account_id"])


def downgrade() -> None:
    op.drop_index("ix_kit_web_sessions_account_id", table_name="kit_web_sessions")
    op.drop_table("kit_web_sessions")
    op.drop_table("kit_web_accounts")
