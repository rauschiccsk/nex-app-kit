"""DEV-310 — one e-mail on several accounts: a person with two accounts keeps their own e-mail on both.

05.11.2026, NEX Manager 1.5.2 on UAT ICC: the Director is „admin“ and „rausch“ and gave the admin account his e-mail —
„Tento e-mail už používa iný používateľ.“ (409). Nobody had asked for that rule: NEX Manager's first design (June
2026) wrote the e-mail „UNIQUE … atribút (nie login)“ and the template took it over (DEV-252). Sign-in is by username;
nothing looks a person up by e-mail. Director 05.11.2026: „chcem aby emailová adresa bola moja pri obidvoch.“
A launch from NEX Manager mirrors the e-mail into the app (sessions.mirror_identity), so the rule goes in the template,
for every app at once.
"""

from __future__ import annotations

from sqlalchemy import inspect, select, text

from nex_app_kit import User

from .conftest import password_kit
from .test_launch import launch, ticket
from .test_users import NEW, signed_in_admin


def test_a_new_user_may_have_the_e_mail_of_another(make_app):
    app, _ = signed_in_admin(make_app)

    response = app.client.post("/api/v1/users", json={**NEW, "email": "SPRAVCA@firma.sk"})

    assert response.status_code == 201
    assert response.json()["email"] == "SPRAVCA@firma.sk"


def test_a_user_may_get_the_e_mail_of_another(make_app):
    app, _ = signed_in_admin(make_app)
    eva = app.user("eva")

    response = app.client.patch(
        f"/api/v1/users/{eva.id}",
        json={"email": "spravca@firma.sk", "role": "user", "first_name": "Eva", "last_name": "Malá", "is_active": True},
    )

    assert response.status_code == 200
    assert response.json()["email"] == "spravca@firma.sk"


def test_own_e_mail_may_be_the_one_of_another_account(make_app):
    app = make_app()
    app.user("eva")
    app.user("peter")
    app.login("eva")

    response = app.client.patch("/api/v1/auth/me", json={"email": "peter@firma.sk"})

    assert response.status_code == 200
    assert response.json()["email"] == "peter@firma.sk"


def test_two_accounts_of_one_person_launched_from_nex_manager_both_get_in(make_app):
    app = make_app(auth="manager")
    app.manager.add("rausch", email="rausch@icc.sk")
    app.manager.add("admin", email="rausch@icc.sk", role="admin")

    assert launch(app, ticket("rausch")).status_code == 303
    assert launch(app, ticket("admin")).status_code == 303

    with app.db() as db:
        mirrors = db.execute(select(User.username, User.email).order_by(User.username)).all()
    assert [tuple(m) for m in mirrors] == [("admin", "rausch@icc.sk"), ("rausch", "rausch@icc.sk")]


def test_the_database_holds_no_rule_on_the_e_mail(migrated):
    unique = inspect(migrated).get_unique_constraints("kit_users")
    indexes = inspect(migrated).get_indexes("kit_users")

    assert [c["column_names"] for c in unique] == [["username"]]
    assert not [i for i in indexes if i.get("unique") and "email" in i["column_names"]]


def test_a_database_migrated_before_loses_the_rule(migrated, factory):
    """What every installed app has: kit_0001 with ``uq_kit_users_email``."""
    with migrated.begin() as connection:
        connection.execute(text("ALTER TABLE kit_users ADD CONSTRAINT uq_kit_users_email UNIQUE (email)"))
        connection.execute(text("UPDATE kit_alembic_version SET version_num = 'kit_0001'"))

    password_kit(factory).upgrade_database(migrated)

    with migrated.connect() as connection:
        version = connection.execute(text("SELECT version_num FROM kit_alembic_version")).scalars().all()
    assert version == ["kit_0002"]
    assert [c["name"] for c in inspect(migrated).get_unique_constraints("kit_users")] == ["uq_kit_users_username"]
