"""Migrations of the app — the template's tables first (nex-app-kit, its own record kit_alembic_version), then the
app's own, on the same connection: the app's tables may point at kit_users."""

from logging.config import fileConfig

from alembic import context
from nex_app_kit import upgrade_database
from sqlalchemy import create_engine, pool

import app.models  # noqa: F401 — the app's own tables
from app import config
from app.db import Base

if context.config.config_file_name:
    fileConfig(context.config.config_file_name)

url = context.config.attributes.get("url") or config.DATABASE_URL
engine = create_engine(url, poolclass=pool.NullPool)
with engine.connect() as connection:
    upgrade_database(connection)
    connection.commit()
    context.configure(connection=connection, target_metadata=Base.metadata)
    with context.begin_transaction():
        context.run_migrations()
