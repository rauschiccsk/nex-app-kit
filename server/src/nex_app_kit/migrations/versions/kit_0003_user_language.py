"""The person's language (DEV-394).

15.11.2026: one app used in several languages at once — each person chooses theirs (Moje konto), or NEX Manager says
it at the launch. Empty = the installation's language.

Revision ID: kit_0003
Revises: kit_0002
"""

import sqlalchemy as sa
from alembic import op

revision = "kit_0003"
down_revision = "kit_0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("kit_users", sa.Column("language", sa.String(8), nullable=True))


def downgrade() -> None:
    op.drop_column("kit_users", "language")
