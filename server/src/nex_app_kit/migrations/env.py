"""Alembic environment of the kit's own migrations — run only through ``AppKit.upgrade_database``, on the
connection it passes, with the kit's own version table (``kit_alembic_version``)."""

from alembic import context

from nex_app_kit.models import KitBase

VERSION_TABLE = "kit_alembic_version"

connection = context.config.attributes["connection"]
context.configure(
    connection=connection,
    target_metadata=KitBase.metadata,
    version_table=VERSION_TABLE,
)
with context.begin_transaction():
    context.run_migrations()
