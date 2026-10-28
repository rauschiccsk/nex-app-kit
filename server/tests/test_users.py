"""DEV-252 — Používatelia (an app with its own password, admin only) and Relácie."""

from __future__ import annotations

import pytest
from sqlalchemy import text

from nex_app_kit.passwords import verify_password


def signed_in_admin(make_app):
    app = make_app()
    admin = app.user("spravca", role="admin", first_name="Ján", last_name="Novák")
    app.login("spravca")
    return app, admin


NEW = {
    "username": "eva",
    "email": "eva@firma.sk",
    "password": "heslo-eva-1",
    "role": "user",
    "first_name": "Eva",
    "last_name": "Malá",
    "is_active": True,
}


def test_only_an_admin_manages_users(make_app):
    app = make_app()
    app.user("eva")
    app.login("eva")

    for response in (
        app.client.get("/api/v1/users"),
        app.client.post("/api/v1/users", json=NEW),
        app.client.delete("/api/v1/areas/1"),
    ):
        assert response.status_code == 403
        assert response.json() == {"detail": "Toto smie len správca aplikácie.", "code": "KIT-FORBIDDEN"}


def test_a_new_user_signs_in_and_must_change_the_password_first(make_app):
    app, _ = signed_in_admin(make_app)

    created = app.client.post("/api/v1/users", json=NEW)

    assert created.status_code == 201
    body = created.json()
    assert (body["username"], body["email"], body["role"], body["must_change_password"]) == (
        "eva",
        "eva@firma.sk",
        "user",
        True,
    )
    eva = app.other_browser()
    assert app.login("eva", "heslo-eva-1", client=eva).status_code == 200
    assert eva.get("/api/v1/areas").status_code == 403


def test_the_list_has_everyone_by_login(make_app):
    app, _ = signed_in_admin(make_app)
    app.user("zuzana")
    app.user("bohus")

    names = [u["username"] for u in app.client.get("/api/v1/users").json()]

    assert names == ["bohus", "spravca", "zuzana"]


@pytest.mark.parametrize(
    "changes,status,sentence",
    [
        (
            {"username": "ab"},
            422,
            "Prihlasovacie meno má 3 až 50 znakov: písmená bez diakritiky, číslice, bodku, pomlčku, "
            "podčiarkovník alebo zavináč.",
        ),
        (
            {"username": "ján"},
            422,
            "Prihlasovacie meno má 3 až 50 znakov: písmená bez diakritiky, číslice, bodku, "
            "pomlčku, podčiarkovník alebo zavináč.",
        ),
        ({"username": "spravca"}, 409, "Prihlasovacie meno „spravca“ už má iný používateľ."),
        ({"email": "SPRAVCA@firma.sk"}, 409, "Tento e-mail už používa iný používateľ."),
        ({"email": "zly"}, 422, "„zly“ nie je platný e-mail."),
        ({"password": "kratke"}, 422, "Heslo musí mať aspoň 8 znakov."),
        ({"role": "ri"}, 422, "Rola je „admin“ (správca) alebo „user“ (používateľ), nie „ri“."),
        ({"first_name": "x" * 101}, 422, "Meno môže mať najviac 100 znakov."),
    ],
)
def test_a_new_user_is_checked(make_app, changes, status, sentence):
    app, _ = signed_in_admin(make_app)

    response = app.client.post("/api/v1/users", json={**NEW, **changes})

    assert response.status_code == status
    assert response.json()["detail"] == sentence


def test_a_user_is_changed(make_app):
    app, _ = signed_in_admin(make_app)
    eva = app.user("eva")

    response = app.client.patch(
        f"/api/v1/users/{eva.id}",
        json={
            "email": "eva.nova@firma.sk",
            "role": "admin",
            "first_name": "Eva",
            "last_name": "Nová",
            "is_active": True,
        },
    )

    assert response.status_code == 200
    assert {k: response.json()[k] for k in ("email", "role", "last_name")} == {
        "email": "eva.nova@firma.sk",
        "role": "admin",
        "last_name": "Nová",
    }


def test_switching_a_user_off_signs_them_out(make_app):
    app, _ = signed_in_admin(make_app)
    eva = app.user("eva")
    browser = app.other_browser()
    app.login("eva", client=browser)

    app.client.patch(
        f"/api/v1/users/{eva.id}",
        json={"email": "eva@firma.sk", "role": "user", "first_name": "", "last_name": "", "is_active": False},
    )

    assert browser.get("/api/v1/areas").status_code == 401
    assert app.login("eva", client=browser).status_code == 403


def test_an_admin_changes_own_name_but_not_own_role_or_activity(make_app):
    app, admin = signed_in_admin(make_app)
    path = f"/api/v1/users/{admin.id}"
    same = {"email": "spravca@firma.sk", "role": "admin", "first_name": "Ján", "last_name": "Nový", "is_active": True}

    assert app.client.patch(path, json=same).status_code == 200
    for change in ({"role": "user"}, {"is_active": False}):
        response = app.client.patch(path, json={**same, **change})
        assert response.status_code == 409
        assert response.json()["detail"] == "Vlastnú rolu si nezmeníš a vlastný účet nevypneš — urobí to iný správca."


def test_a_user_is_deleted(make_app):
    app, _ = signed_in_admin(make_app)
    eva = app.user("eva")

    assert app.client.delete(f"/api/v1/users/{eva.id}").status_code == 204

    assert [u["username"] for u in app.client.get("/api/v1/users").json()] == ["spravca"]


def test_an_admin_does_not_delete_themselves(make_app):
    app, admin = signed_in_admin(make_app)

    response = app.client.delete(f"/api/v1/users/{admin.id}")

    assert response.status_code == 409
    assert response.json()["detail"] == "Vlastný účet nezmažeš — urobí to iný správca."


def test_a_user_the_app_s_records_point_at_is_switched_off_instead(make_app, migrated):
    app, _ = signed_in_admin(make_app)
    eva = app.user("eva")
    with migrated.begin() as connection:
        connection.execute(
            text("CREATE TABLE app_notes (id serial PRIMARY KEY, author uuid NOT NULL REFERENCES kit_users(id))")
        )
        connection.execute(text("INSERT INTO app_notes (author) VALUES (:a)"), {"a": eva.id})
    try:
        response = app.client.delete(f"/api/v1/users/{eva.id}")

        assert response.status_code == 409
        assert response.json() == {
            "detail": "Používateľa nejde zmazať — aplikácia má záznamy, ktoré k nemu patria. Vypni ho namiesto toho.",
            "code": "KIT-USER-IN-USE",
        }
    finally:
        with migrated.begin() as connection:
            connection.execute(text("DROP TABLE app_notes"))


@pytest.mark.parametrize("missing", ["00000000-0000-0000-0000-000000000000", "nie-je-id"])
def test_an_unknown_user_is_said(make_app, missing):
    app, _ = signed_in_admin(make_app)

    response = app.client.delete(f"/api/v1/users/{missing}")

    assert response.status_code == 404
    assert response.json()["detail"] == "Taký používateľ nie je."


def test_a_new_password_from_the_admin_signs_out_and_must_be_changed(make_app):
    app, _ = signed_in_admin(make_app)
    eva = app.user("eva", failed_logins=3)
    browser = app.other_browser()
    app.login("eva", client=browser)

    response = app.client.post(f"/api/v1/users/{eva.id}/password", json={"new_password": "nove-heslo-1"})

    assert response.status_code == 204
    assert browser.get("/api/v1/areas").status_code == 401
    assert app.login("eva", "nove-heslo-1", client=browser).json()["must_change_password"] is True
    with app.db() as db:
        from nex_app_kit.models import User

        assert verify_password("nove-heslo-1", db.get(User, eva.id).password_hash)


def test_own_password_is_changed_in_moje_konto_not_here(make_app):
    app, admin = signed_in_admin(make_app)

    response = app.client.post(f"/api/v1/users/{admin.id}/password", json={"new_password": "nove-heslo-1"})

    assert response.status_code == 409
    assert response.json()["detail"] == "Svoje heslo si zmeň v Moje konto."


# ── Relácie ─────────────────────────────────────────────────────────────────────────────────────────
def test_an_admin_sees_every_session_with_whose_it_is(make_app):
    app, _ = signed_in_admin(make_app)
    app.user("eva")
    app.login("eva", client=app.other_browser())

    rows = app.client.get("/api/v1/sessions").json()

    assert sorted((r["username"], r["current"]) for r in rows) == [("eva", False), ("spravca", True)]
    assert set(rows[0]) == {
        "id",
        "user_id",
        "username",
        "created_at",
        "last_seen_at",
        "updated_at",
        "expires_at",
        "user_agent",
        "current",
    }


def test_a_user_sees_only_own_sessions_and_ends_none(make_app):
    app = make_app()
    app.user("spravca", role="admin")
    app.user("eva")
    app.login("spravca", client=app.other_browser())
    app.login("eva")

    rows = app.client.get("/api/v1/sessions").json()

    assert [r["username"] for r in rows] == ["eva"]
    assert app.client.delete(f"/api/v1/sessions/{rows[0]['id']}").status_code == 403


def test_an_ended_session_is_said(make_app):
    app, _ = signed_in_admin(make_app)

    response = app.client.delete("/api/v1/sessions/00000000-0000-0000-0000-000000000000")

    assert response.status_code == 404
    assert response.json()["detail"] == "Taká relácia nie je — možno už skončila."
