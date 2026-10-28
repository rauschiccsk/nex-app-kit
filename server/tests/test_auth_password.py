"""DEV-252 — signing in with the app's own password: a session per browser in the database, a cookie JavaScript
cannot read, the first admin from ADMIN_INITIAL_PASSWORD, a lock after wrong passwords, a password change that
signs the other browsers out, and nothing sent from another site's page."""

from __future__ import annotations

import hashlib

import pytest
from sqlalchemy import select

from nex_app_kit.models import Session, User
from nex_app_kit.passwords import verify_password


def detail(response) -> str:
    return response.json()["detail"]


def test_signing_in_sets_a_cookie_javascript_cannot_read(make_app):
    app = make_app()
    app.user("eva")

    response = app.login("eva")

    assert response.status_code == 200
    assert response.json()["username"] == "eva"
    cookie = response.headers["set-cookie"]
    assert cookie.startswith("nex_session=")
    assert "HttpOnly" in cookie
    assert "Secure" in cookie
    assert "SameSite=lax" in cookie
    assert "Max-Age=86400" in cookie


def test_the_database_keeps_only_the_token_s_fingerprint(make_app):
    app = make_app()
    app.user("eva")
    app.login("eva")
    token = app.client.cookies.get("nex_session")

    with app.db() as db:
        stored = db.scalars(select(Session.token_hash)).all()

    assert stored == [hashlib.sha256(token.encode()).hexdigest()]


def test_the_signed_in_person_is_known_and_reaches_the_app_s_own_routes(make_app):
    app = make_app()
    app.user("eva", first_name="Eva", last_name="Malá")
    app.login("eva")

    me = app.client.get("/api/v1/auth/me")
    areas = app.client.get("/api/v1/areas")

    assert me.status_code == 200
    assert {k: me.json()[k] for k in ("username", "first_name", "last_name", "role", "must_change_password")} == {
        "username": "eva",
        "first_name": "Eva",
        "last_name": "Malá",
        "role": "user",
        "must_change_password": False,
    }
    assert areas.json() == {"for": "eva"}


def test_without_signing_in_nothing_is_open(make_app):
    app = make_app()

    response = app.client.get("/api/v1/areas")

    assert response.status_code == 401
    assert response.json() == {"detail": "Nie si prihlásený.", "code": "KIT-AUTH-REQUIRED"}


@pytest.mark.parametrize("username,password", [("eva", "zle-heslo"), ("nikto", "heslo-123")])
def test_a_wrong_name_and_a_wrong_password_read_the_same(make_app, username, password):
    app = make_app()
    app.user("eva")

    response = app.login(username, password)

    assert response.status_code == 401
    assert response.json() == {"detail": "Nesprávne meno alebo heslo.", "code": "KIT-AUTH-FAILED"}
    assert "set-cookie" not in response.headers


def test_five_wrong_passwords_lock_the_account_for_15_minutes(make_app):
    app = make_app()
    app.user("eva")
    for _ in range(5):
        assert app.login("eva", "zle").status_code == 401

    locked = app.login("eva")

    assert locked.status_code == 429
    assert locked.json() == {
        "detail": "Príliš veľa nesprávnych pokusov. Skús to znova o 15 min.",
        "code": "KIT-AUTH-LOCKED",
    }
    app.clock.advance(minutes=15, seconds=1)
    assert app.login("eva").status_code == 200


def test_four_wrong_passwords_do_not_lock_and_a_good_one_starts_the_count_again(make_app):
    app = make_app()
    app.user("eva")
    for _ in range(4):
        app.login("eva", "zle")
    assert app.login("eva").status_code == 200
    for _ in range(4):
        app.login("eva", "zle")

    assert app.login("eva").status_code == 200


def test_a_switched_off_account_does_not_sign_in(make_app):
    app = make_app()
    app.user("eva", is_active=False)

    response = app.login("eva")

    assert response.status_code == 403
    assert detail(response) == "Tento účet je vypnutý. Obráť sa na správcu aplikácie."


def test_a_person_switched_off_while_signed_in_is_out_at_once(make_app):
    app = make_app()
    eva = app.user("eva")
    app.login("eva")
    with app.db() as db:
        db.get(User, eva.id).is_active = False
        db.commit()

    assert app.client.get("/api/v1/areas").status_code == 401


# ── how long a session lasts ────────────────────────────────────────────────────────────────────────
def test_eight_hours_without_work_end_the_session(make_app):
    app = make_app()
    app.user("eva")
    app.login("eva")
    app.clock.advance(hours=7, minutes=59)
    assert app.client.get("/api/v1/areas").status_code == 200

    app.clock.advance(hours=8)

    assert app.client.get("/api/v1/areas").status_code == 401
    with app.db() as db:
        assert db.scalars(select(Session)).all() == []


def test_working_keeps_the_session_but_not_past_its_longest_time(make_app):
    app = make_app()
    app.user("eva")
    app.login("eva")
    for _ in range(3):
        app.clock.advance(hours=6)
        assert app.client.get("/api/v1/areas").status_code == 200, app.clock.now
    app.clock.advance(hours=5, minutes=59)
    assert app.client.get("/api/v1/areas").status_code == 200

    app.clock.advance(minutes=2)

    assert app.client.get("/api/v1/areas").status_code == 401


def test_the_idle_time_is_a_system_setting(make_app):
    app = make_app()
    admin = app.user("spravca", role="admin")
    app.login("spravca")
    assert (
        app.client.patch("/api/v1/system-settings/auth_session_idle_minutes", json={"value": "30"}).status_code == 200
    )
    assert admin

    app.clock.advance(minutes=31)

    assert app.client.get("/api/v1/areas").status_code == 401


def test_last_seen_is_written_at_most_once_a_minute(make_app):
    app = make_app()
    app.user("eva")
    app.login("eva")
    start = app.clock.now
    app.clock.advance(seconds=30)
    app.client.get("/api/v1/areas")
    with app.db() as db:
        assert db.scalars(select(Session.last_seen_at)).one() == start

    app.clock.advance(seconds=31)
    app.client.get("/api/v1/areas")

    with app.db() as db:
        assert db.scalars(select(Session.last_seen_at)).one() == app.clock.now


# ── logout and sessions ended elsewhere ─────────────────────────────────────────────────────────────
def test_logging_out_ends_the_session(make_app):
    app = make_app()
    app.user("eva")
    app.login("eva")
    token = app.client.cookies.get("nex_session")

    response = app.client.post("/api/v1/auth/logout")

    assert response.status_code == 204
    assert 'nex_session=""' in response.headers["set-cookie"]
    app.client.cookies.set("nex_session", token)
    assert app.client.get("/api/v1/auth/me").status_code == 401


def test_a_session_ended_in_relacie_stops_at_once(make_app):
    app = make_app()
    app.user("spravca", role="admin")
    app.user("eva")
    eva = app.other_browser()
    app.login("eva", client=eva)
    app.login("spravca")
    eva_session = next(s for s in app.client.get("/api/v1/sessions").json() if s["username"] == "eva")

    assert app.client.delete(f"/api/v1/sessions/{eva_session['id']}").status_code == 204

    assert eva.get("/api/v1/areas").status_code == 401


# ── first admin and password change ────────────────────────────────────────────────────────────────
def test_the_first_admin_comes_from_the_initial_password_and_must_change_it(make_app):
    app = make_app()

    assert app.kit.bootstrap_admin("pociatocne-heslo") is True
    assert app.kit.bootstrap_admin("ine-heslo") is False

    with app.db() as db:
        admin = db.scalars(select(User).where(User.username == "admin")).one()
    assert (admin.role, admin.must_change_password, admin.source) == ("admin", True, "local")
    assert verify_password("pociatocne-heslo", admin.password_hash)


def test_no_initial_password_no_admin(make_app):
    app = make_app()

    assert app.kit.bootstrap_admin(None) is False
    assert app.kit.bootstrap_admin("") is False
    with app.db() as db:
        assert db.scalars(select(User)).all() == []


def test_a_password_change_due_lets_in_only_to_change_it(make_app):
    app = make_app()
    app.kit.bootstrap_admin("pociatocne-heslo")
    app.login("admin", "pociatocne-heslo")

    me = app.client.get("/api/v1/auth/me")
    blocked = app.client.get("/api/v1/areas")
    settings = app.client.get("/api/v1/system-settings")

    assert me.json()["must_change_password"] is True
    assert blocked.status_code == settings.status_code == 403
    assert blocked.json() == {"detail": "Najprv si zmeň heslo.", "code": "KIT-PASSWORD-CHANGE"}

    changed = app.client.post(
        "/api/v1/auth/change-password",
        json={"current_password": "pociatocne-heslo", "new_password": "nove-heslo-1"},
    )

    assert changed.status_code == 204
    assert app.client.get("/api/v1/areas").status_code == 200
    assert app.client.get("/api/v1/auth/me").json()["must_change_password"] is False


@pytest.mark.parametrize(
    "current,new,sentence",
    [
        ("zle", "nove-heslo-1", "Súčasné heslo je nesprávne."),
        ("heslo-123", "heslo-123", "Nové heslo musí byť iné ako súčasné."),
        ("heslo-123", "kratke", "Heslo musí mať aspoň 8 znakov."),
        ("heslo-123", "ž" * 37, "Heslo je príliš dlhé — najviac 72 znakov (písmeno s diakritikou sa ráta za dva)."),
    ],
)
def test_a_password_change_says_what_is_wrong(make_app, current, new, sentence):
    app = make_app()
    app.user("eva")
    app.login("eva")

    response = app.client.post("/api/v1/auth/change-password", json={"current_password": current, "new_password": new})

    assert response.status_code == 422
    assert detail(response) == sentence


def test_a_new_password_signs_out_the_other_browsers_but_not_this_one(make_app):
    app = make_app()
    app.user("eva")
    phone = app.other_browser()
    app.login("eva", client=phone)
    app.login("eva")

    app.client.post(
        "/api/v1/auth/change-password", json={"current_password": "heslo-123", "new_password": "nove-heslo-1"}
    )

    assert app.client.get("/api/v1/areas").status_code == 200
    assert phone.get("/api/v1/areas").status_code == 401
    assert app.login("eva", "nove-heslo-1", client=phone).status_code == 200


# ── own account ─────────────────────────────────────────────────────────────────────────────────────
def test_own_name_and_e_mail_are_changed_here(make_app):
    app = make_app()
    app.user("eva")
    app.login("eva")

    response = app.client.patch(
        "/api/v1/auth/me", json={"email": " Eva.Mala@Firma.sk ", "first_name": " Eva ", "last_name": "Malá"}
    )

    assert response.status_code == 200
    body = response.json()
    assert (body["email"], body["first_name"], body["last_name"]) == ("Eva.Mala@firma.sk", "Eva", "Malá")


@pytest.mark.parametrize(
    "email,status,sentence",
    [
        ("peter@firma.sk", 409, "Tento e-mail už používa iný používateľ."),
        ("PETER@firma.sk", 409, "Tento e-mail už používa iný používateľ."),
        ("nie-je-mail", 422, "„nie-je-mail“ nie je platný e-mail."),
        ("  ", 422, "E-mail je povinný."),
    ],
)
def test_own_e_mail_is_checked(make_app, email, status, sentence):
    app = make_app()
    app.user("eva")
    app.user("peter")
    app.login("eva")

    response = app.client.patch("/api/v1/auth/me", json={"email": email})

    assert response.status_code == status
    assert detail(response) == sentence


# ── a request from another site's page ─────────────────────────────────────────────────────────────
@pytest.mark.parametrize(
    "headers",
    [
        {"Sec-Fetch-Site": "cross-site"},
        {"Sec-Fetch-Site": "same-site"},
        {"Origin": "https://zla-stranka.sk"},
        {"Origin": "null"},
    ],
)
def test_a_change_sent_from_another_site_is_refused(make_app, headers):
    app = make_app()
    app.user("eva")
    app.login("eva")

    response = app.client.patch("/api/v1/auth/me", json={"email": "eva2@firma.sk"}, headers=headers)

    assert response.status_code == 403
    assert response.json() == {"detail": "Požiadavka neprišla z tejto aplikácie — odmietnutá.", "code": "KIT-ORIGIN"}


@pytest.mark.parametrize("headers", [{"Sec-Fetch-Site": "same-origin"}, {"Origin": "https://testserver"}, {}])
def test_a_change_from_the_app_s_own_page_goes_through(make_app, headers):
    app = make_app()
    app.user("eva")
    app.login("eva")

    response = app.client.patch("/api/v1/auth/me", json={"email": "eva2@firma.sk"}, headers=headers)

    assert response.status_code == 200


def test_reading_from_another_site_is_not_a_change(make_app):
    app = make_app()
    app.user("eva")
    app.login("eva")

    assert app.client.get("/api/v1/areas", headers={"Sec-Fetch-Site": "cross-site"}).status_code == 200


def test_signing_in_from_another_site_is_refused(make_app):
    app = make_app()
    app.user("eva")

    response = app.client.post(
        "/api/v1/auth/login", json={"username": "eva", "password": "heslo-123"}, headers={"Origin": "https://zla.sk"}
    )

    assert response.status_code == 403
    assert "set-cookie" not in response.headers


def test_logging_out_from_another_site_is_refused(make_app):
    app = make_app()
    app.user("eva")
    app.login("eva")

    response = app.client.post("/api/v1/auth/logout", headers={"Sec-Fetch-Site": "cross-site"})

    assert response.status_code == 403
    assert app.client.get("/api/v1/areas").status_code == 200


def test_an_app_with_its_own_password_has_no_launch(make_app):
    app = make_app()

    assert app.client.get("/api/v1/launch", params={"lt": "x"}).status_code == 404
