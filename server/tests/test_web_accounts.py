"""DEV-523 — the web of an app on the template: own accounts signed in by e-mail, a registration that is a request the
admin decides in the administration, sessions of its own.

26.11.2026 orthodox-register: the priests use the web, the administrator the administration. The Director on the
proposal (own web accounts, sign-in by e-mail unique among them, a registration request the admin approves; the
administration's accounts stay as they are — one e-mail may be on several, DEV-310): „Súhlasím“.
"""

from __future__ import annotations

import hashlib

import pytest
from sqlalchemy import select

from nex_app_kit.manifest import ManifestError, manifest_from_data
from nex_app_kit.models import WebAccount, WebSession
from nex_app_kit.passwords import verify_password

PRIEST = {"email": "Otec.Jan@Farnost.sk", "password": "heslo-otca-1", "first_name": "Ján", "last_name": "Kňaz"}


def detail(response) -> str:
    return response.json()["detail"]


def code(response) -> str:
    return response.json()["code"]


def web_app(make_app):
    app = make_app(web=True)
    app.user("spravca", role="admin")
    return app


def register(app, **changes):
    return app.client.post("/api/v1/web/auth/register", json={**PRIEST, **changes})


def web_login(app, email=PRIEST["email"], password=PRIEST["password"], client=None):
    return (client or app.client).post("/api/v1/web/auth/login", json={"email": email, "password": password})


def as_admin(app):
    admin = app.other_browser()
    assert app.login("spravca", client=admin).status_code == 200
    return admin


def decide(app, account_id: str, action: str):
    return as_admin(app).post(f"/api/v1/web-accounts/{account_id}/{action}")


def test_an_app_without_a_web_has_none(make_app):
    app = make_app()

    assert register(app).status_code == 404
    assert app.client.get("/api/v1/web/auth/me").status_code == 404


def test_a_registration_is_a_request_that_waits_for_the_admin(make_app):
    app = web_app(make_app)

    answer = register(app)

    assert answer.status_code == 201, answer.text
    assert {k: answer.json()[k] for k in ("email", "first_name", "last_name", "status")} == {
        "email": "otec.jan@farnost.sk",
        "first_name": "Ján",
        "last_name": "Kňaz",
        "status": "pending",
    }
    with app.db() as db:
        account = db.scalars(select(WebAccount)).one()
        assert verify_password(PRIEST["password"], account.password_hash)
        assert PRIEST["password"] not in account.password_hash
    refused = web_login(app)
    assert (refused.status_code, code(refused), detail(refused)) == (
        403,
        "KIT-WEB-PENDING",
        "Vaša žiadosť o registráciu ešte čaká na schválenie správcom.",
    )


def test_one_e_mail_one_web_account_whatever_the_capitals(make_app):
    app = web_app(make_app)
    register(app)

    again = register(app, email="otec.jan@farnost.SK", password="ine-heslo")

    assert (again.status_code, code(again), detail(again)) == (
        409,
        "KIT-WEB-EMAIL-TAKEN",
        "Pre tento e-mail už konto alebo žiadosť o registráciu existuje.",
    )


def test_the_web_account_may_share_the_e_mail_of_an_administration_account(make_app):
    app = web_app(make_app)
    app.user("jan", email="otec.jan@farnost.sk")

    assert register(app).status_code == 201


def test_approved_the_priest_signs_in_by_e_mail_with_a_session_of_the_web(make_app):
    app = web_app(make_app)
    account_id = register(app).json()["id"]

    approved = decide(app, account_id, "approve")
    signed_in = web_login(app, email="OTEC.JAN@farnost.sk")

    assert approved.status_code == 200 and approved.json()["status"] == "active"
    assert signed_in.status_code == 200, signed_in.text
    cookie = signed_in.headers["set-cookie"]
    assert cookie.startswith("nex_web_session=") and "HttpOnly" in cookie and "SameSite=lax" in cookie
    assert app.client.get("/api/v1/web/auth/me").json()["email"] == "otec.jan@farnost.sk"
    with app.db() as db:
        assert db.scalars(select(WebSession.token_hash)).all() == [
            hashlib.sha256(app.client.cookies.get("nex_web_session").encode()).hexdigest()
        ]
        assert db.scalars(select(WebAccount.decided_by)).one() is not None


def test_the_web_and_the_administration_never_sign_in_for_each_other(make_app):
    app = web_app(make_app)
    account_id = register(app).json()["id"]
    decide(app, account_id, "approve")
    web_login(app)

    assert app.client.get("/api/v1/auth/me").status_code == 401  # a priest is nobody in the administration
    admin = as_admin(app)
    assert admin.get("/api/v1/web/auth/me").status_code == 401  # nor is the admin on the web
    assert app.client.get("/api/v1/web-accounts").status_code == 401


def test_a_rejected_request_never_signs_in(make_app):
    app = web_app(make_app)
    account_id = register(app).json()["id"]

    rejected = decide(app, account_id, "reject")
    refused = web_login(app)

    assert rejected.json()["status"] == "rejected"
    assert (refused.status_code, code(refused), detail(refused)) == (
        403,
        "KIT-WEB-REJECTED",
        "Vašu žiadosť o registráciu správca zamietol.",
    )
    assert decide(app, account_id, "approve").status_code == 409


def test_a_switched_off_account_is_signed_out_at_once_and_can_be_switched_on(make_app):
    app = web_app(make_app)
    account_id = register(app).json()["id"]
    decide(app, account_id, "approve")
    web_login(app)

    off = decide(app, account_id, "disable")

    assert off.json()["status"] == "disabled"
    with app.db() as db:  # its sessions are gone at once, not only refused when the browser comes back
        assert db.scalars(select(WebSession)).all() == []
    assert app.client.get("/api/v1/web/auth/me").status_code == 401
    refused = web_login(app)
    assert (refused.status_code, code(refused)) == (403, "KIT-WEB-DISABLED")
    assert decide(app, account_id, "enable").json()["status"] == "active"
    assert web_login(app).status_code == 200


@pytest.mark.parametrize(("start", "action"), [("pending", "disable"), ("pending", "enable"), ("active", "reject")])
def test_a_decision_that_does_not_fit_the_account_is_refused(make_app, start, action):
    app = web_app(make_app)
    account_id = register(app).json()["id"]
    if start == "active":
        decide(app, account_id, "approve")

    answer = decide(app, account_id, action)

    assert (answer.status_code, code(answer)) == (409, "KIT-WEB-STATUS")


def test_only_the_admin_sees_and_decides_the_web_s_accounts(make_app):
    app = web_app(make_app)
    account_id = register(app).json()["id"]
    app.user("eva")
    eva = app.other_browser()
    app.login("eva", client=eva)

    assert eva.get("/api/v1/web-accounts").status_code == 403
    assert eva.post(f"/api/v1/web-accounts/{account_id}/approve").status_code == 403
    listed = as_admin(app).get("/api/v1/web-accounts")
    assert [(a["email"], a["status"]) for a in listed.json()] == [("otec.jan@farnost.sk", "pending")]


def test_wrong_passwords_lock_the_web_account_for_a_while(make_app):
    app = web_app(make_app)
    account_id = register(app).json()["id"]
    decide(app, account_id, "approve")

    for _ in range(5):
        assert web_login(app, password="zle").status_code == 401
    locked = web_login(app)

    assert (locked.status_code, code(locked)) == (429, "KIT-AUTH-LOCKED")
    assert web_login(app, email="nikto@farnost.sk").status_code == 401


def test_signing_out_of_the_web_ends_its_session(make_app):
    app = web_app(make_app)
    decide(app, register(app).json()["id"], "approve")
    web_login(app)

    assert app.client.post("/api/v1/web/auth/logout").status_code == 204
    assert app.client.get("/api/v1/web/auth/me").status_code == 401


def test_a_page_of_another_site_cannot_register_or_sign_in(make_app):
    app = web_app(make_app)

    foreign = {"origin": "https://zly.example", "sec-fetch-site": "cross-site"}
    assert app.client.post("/api/v1/web/auth/register", json=PRIEST, headers=foreign).status_code == 403
    assert app.client.post("/api/v1/web/auth/login", json=PRIEST, headers=foreign).status_code == 403


def test_the_manifest_gives_a_web_only_to_an_app_with_its_own_password():
    base = {"template": "nsv-standard", "name": "Orthodox Register", "initials": "OR"}

    assert manifest_from_data({**base, "auth": "password", "web": True}).web is True
    assert manifest_from_data({**base, "auth": "password"}).web is False
    with pytest.raises(ManifestError) as refused:
        manifest_from_data({**base, "auth": "manager", "web": True})
    assert refused.value.problems == [
        "Webový frontend (web) má len aplikácia s vlastným heslom (auth „password“) — web sa prihlasuje e-mailom."
    ]
    with pytest.raises(ManifestError) as refused:
        manifest_from_data({**base, "auth": "password", "web": "áno"})
    assert refused.value.problems == ["Webový frontend (web) je true alebo false."]
