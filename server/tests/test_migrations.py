"""DEV-252 — the kit's own tables, migrated with its own record, never touching the app's migrations."""

from __future__ import annotations

import pytest
from alembic.autogenerate import compare_metadata
from alembic.migration import MigrationContext
from sqlalchemy import inspect, text
from sqlalchemy.exc import IntegrityError

from nex_app_kit import SIDEBAR_WIDTH, KitBase

from .conftest import password_kit


def test_the_tables_match_the_models(migrated):
    with migrated.connect() as connection:
        context = MigrationContext.configure(connection, opts={"version_table": "kit_alembic_version"})
        diff = compare_metadata(context, KitBase.metadata)
    assert diff == []


def test_every_table_of_the_kit_starts_with_kit_(migrated):
    tables = set(inspect(migrated).get_table_names())
    assert {t for t in tables if not t.startswith("kit_")} == set()
    assert "kit_alembic_version" in tables


def test_the_app_s_own_migration_record_is_left_alone(migrated, factory):
    with migrated.begin() as connection:
        connection.execute(text("CREATE TABLE alembic_version (version_num varchar(32) PRIMARY KEY)"))
        connection.execute(text("INSERT INTO alembic_version VALUES ('app_0007')"))
    try:
        password_kit(factory).upgrade_database(migrated)
        with migrated.connect() as connection:
            assert connection.execute(text("SELECT version_num FROM alembic_version")).scalars().all() == ["app_0007"]
            assert connection.execute(text("SELECT version_num FROM kit_alembic_version")).scalars().all() == [
                "kit_0001"
            ]
    finally:
        with migrated.begin() as connection:
            connection.execute(text("DROP TABLE alembic_version"))


def test_upgrading_twice_changes_nothing(migrated, factory):
    password_kit(factory).upgrade_database(migrated)
    with migrated.connect() as connection:
        assert connection.execute(text("SELECT count(*) FROM kit_alembic_version")).scalar() == 1


@pytest.mark.parametrize("width", [SIDEBAR_WIDTH.min - 1, SIDEBAR_WIDTH.max + 1])
def test_the_database_refuses_a_width_out_of_bounds(migrated, width):
    with pytest.raises(IntegrityError), migrated.begin() as connection:
        user_id = connection.execute(
            text(
                "INSERT INTO kit_users (id, username, role, is_active, must_change_password, failed_logins, source)"
                " VALUES (gen_random_uuid(), 'w', 'user', true, false, 0, 'local') RETURNING id"
            )
        ).scalar()
        connection.execute(
            text("INSERT INTO kit_user_layouts (user_id, sidebar_width, sidebar_collapsed) VALUES (:u, :w, false)"),
            {"u": user_id, "w": width},
        )


@pytest.mark.parametrize("width", [SIDEBAR_WIDTH.min, SIDEBAR_WIDTH.max])
def test_the_database_takes_the_bounds_themselves(migrated, width):
    with migrated.begin() as connection:
        user_id = connection.execute(
            text(
                "INSERT INTO kit_users (id, username, role, is_active, must_change_password, failed_logins, source)"
                " VALUES (gen_random_uuid(), 'w', 'user', true, false, 0, 'local') RETURNING id"
            )
        ).scalar()
        connection.execute(
            text("INSERT INTO kit_user_layouts (user_id, sidebar_width, sidebar_collapsed) VALUES (:u, :w, false)"),
            {"u": user_id, "w": width},
        )
