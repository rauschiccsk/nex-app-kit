"""One e-mail on several accounts — the e-mail of a person is not unique (DEV-310).

05.11.2026: the Director has two accounts, „admin“ and „rausch“, and wants his e-mail on both. Sign-in is by username;
nothing looks a person up by e-mail, and a launch from NEX Manager mirrors the e-mail into the app — so a unique e-mail
kept the second account of one person out of every app.

Revision ID: kit_0002
Revises: kit_0001
"""

from alembic import op

revision = "kit_0002"
down_revision = "kit_0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_constraint("uq_kit_users_email", "kit_users", type_="unique")


def downgrade() -> None:
    op.create_unique_constraint("uq_kit_users_email", "kit_users", ["email"])
