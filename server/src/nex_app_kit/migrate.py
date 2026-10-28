"""The kit's own migrations — runnable on their own (``python -m nex_app_kit.migrate``) and from inside the app's
own Alembic ``env.py``, before the app's migrations, on the same connection:

    from nex_app_kit import upgrade_database

    with engine.connect() as connection:
        upgrade_database(connection)          # kit_ tables first — the app's tables point at kit_users
        context.configure(connection=connection, target_metadata=Base.metadata)
        ...

It drives Alembic's migration context directly, never ``alembic.context``, so it can run inside another
``env.py`` without taking that one's context away. Its record is ``kit_alembic_version``; the app keeps its own."""

from __future__ import annotations

import os
from pathlib import Path

from alembic.operations import Operations
from alembic.runtime.migration import MigrationContext
from alembic.script import ScriptDirectory
from sqlalchemy import create_engine
from sqlalchemy.engine import Connection, Engine

from .models import KitBase

MIGRATIONS = Path(__file__).resolve().parent / "migrations"
VERSION_TABLE = "kit_alembic_version"


def _run(connection: Connection) -> None:
    script = ScriptDirectory(str(MIGRATIONS))

    def to_head(revision, _context):
        return script._upgrade_revs("head", revision)

    context = MigrationContext.configure(
        connection,
        opts={"script": script, "fn": to_head, "version_table": VERSION_TABLE, "target_metadata": KitBase.metadata},
    )
    with Operations.context(context):
        context.run_migrations()


def upgrade_database(bind: Engine | Connection) -> None:
    """Create or bring up to date the kit's own tables."""
    if isinstance(bind, Connection):
        _run(bind)
        return
    with bind.begin() as connection:
        _run(connection)


def main() -> None:
    upgrade_database(create_engine(os.environ["DATABASE_URL"]))


if __name__ == "__main__":
    main()
