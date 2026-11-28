"""Sprievodca — the goals people bring to it and what tells how well it works (DEV-535).

28.11.2026: an app on the template gets Sprievodca, the guide that leads a person step by step to their goal from the
app's catalog of steps. A session keeps the goal, the composed path and how far the guiding got; an event keeps what the
feedback is made of (a step missing in the catalog, a person stuck, a guiding stopped, an idea).

Revision ID: kit_0005
Revises: kit_0004
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.dialects.postgresql import UUID as PG_UUID

revision = "kit_0005"
down_revision = "kit_0004"
branch_labels = None
depends_on = None

UUID = PG_UUID(as_uuid=True)


def _now():
    return sa.text("now()")


def upgrade() -> None:
    op.create_table(
        "kit_guide_sessions",
        sa.Column("id", UUID, primary_key=True),
        sa.Column(
            "user_id",
            UUID,
            sa.ForeignKey("kit_users.id", ondelete="CASCADE", name="fk_kit_guide_sessions_user_id_kit_users"),
            nullable=False,
        ),
        sa.Column("goal", sa.Text, nullable=False),
        sa.Column("language", sa.String(8), nullable=False),
        sa.Column("status", sa.String(10), nullable=False),
        sa.Column("transcript", JSONB, nullable=False),
        sa.Column("steps", JSONB, nullable=False),
        sa.Column("current_step", sa.Integer, nullable=False),
        sa.Column("stop_reason", sa.String(20)),
        sa.Column("rating", sa.String(4)),
        sa.Column("comment", sa.Text),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=_now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=_now()),
        sa.CheckConstraint(
            "status IN ('asking', 'planned', 'missing', 'guiding', 'done', 'stopped')",
            name="ck_kit_guide_sessions_status",
        ),
        sa.CheckConstraint("rating IS NULL OR rating IN ('up', 'down')", name="ck_kit_guide_sessions_rating"),
    )
    op.create_index("ix_kit_guide_sessions_user_id", "kit_guide_sessions", ["user_id"])
    op.create_table(
        "kit_guide_events",
        sa.Column("id", UUID, primary_key=True),
        sa.Column(
            "session_id",
            UUID,
            sa.ForeignKey(
                "kit_guide_sessions.id", ondelete="CASCADE", name="fk_kit_guide_events_session_id_kit_guide_sessions"
            ),
        ),
        sa.Column(
            "user_id",
            UUID,
            sa.ForeignKey("kit_users.id", ondelete="SET NULL", name="fk_kit_guide_events_user_id_kit_users"),
        ),
        sa.Column("kind", sa.String(14), nullable=False),
        sa.Column("step_id", sa.String(80)),
        sa.Column("detail", sa.Text),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=_now()),
        sa.CheckConstraint(
            "kind IN ('missing_step', 'invalid_plan', 'stuck', 'not_detected', 'no_target', 'skipped', 'stopped', "
            "'finished', 'idea', 'note')",
            name="ck_kit_guide_events_kind",
        ),
    )
    op.create_index("ix_kit_guide_events_session_id", "kit_guide_events", ["session_id"])


def downgrade() -> None:
    op.drop_index("ix_kit_guide_events_session_id", table_name="kit_guide_events")
    op.drop_table("kit_guide_events")
    op.drop_index("ix_kit_guide_sessions_user_id", table_name="kit_guide_sessions")
    op.drop_table("kit_guide_sessions")
