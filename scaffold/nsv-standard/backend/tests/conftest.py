"""The server's tests run against a real Postgres (compose service `test`, TEST_DATABASE_URL): the test database is
created when missing, emptied and migrated (the template's tables, then the app's) once per run."""

from __future__ import annotations

import os
from collections.abc import Iterator
from urllib.parse import urlsplit, urlunsplit

import pytest

TEST_DATABASE_URL = os.environ.get("TEST_DATABASE_URL", "")
if not TEST_DATABASE_URL:
    raise RuntimeError("TEST_DATABASE_URL is missing — the tests run against Postgres (compose service `test`).")
# The app reads its database at import — point it at the test database first.
os.environ["DATABASE_URL"] = TEST_DATABASE_URL

from alembic import command  # noqa: E402
from alembic.config import Config  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import create_engine, text  # noqa: E402

from app import config  # noqa: E402


def _ensure_database(url: str) -> None:
    parts = urlsplit(url)
    name = parts.path.lstrip("/")
    maintenance = urlunsplit(parts._replace(path="/postgres"))
    engine = create_engine(maintenance, isolation_level="AUTOCOMMIT")
    with engine.connect() as connection:
        if not connection.execute(text("SELECT 1 FROM pg_database WHERE datname = :n"), {"n": name}).first():
            connection.execute(text(f'CREATE DATABASE "{name}"'))
    engine.dispose()


@pytest.fixture(scope="session", autouse=True)
def database() -> Iterator[None]:
    _ensure_database(TEST_DATABASE_URL)
    engine = create_engine(TEST_DATABASE_URL)
    with engine.begin() as connection:
        connection.execute(text("DROP SCHEMA public CASCADE"))
        connection.execute(text("CREATE SCHEMA public"))
    engine.dispose()
    alembic = Config(str(config.BASE_DIR / "alembic.ini"))
    alembic.set_main_option("script_location", str(config.BASE_DIR / "alembic"))
    command.upgrade(alembic, "head")
    yield


@pytest.fixture
def client() -> Iterator[TestClient]:
    from app.main import app

    with TestClient(app, base_url="https://testserver") as test_client:
        yield test_client
