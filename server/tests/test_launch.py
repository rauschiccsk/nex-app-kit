"""DEV-252 — launched from NEX Manager: the ticket is checked as NEX Manager signs it and works once, NEX Manager
says who the person is and whether they may in, and is asked again every 5 minutes while the session lasts."""

from __future__ import annotations

import time
import uuid

import jwt
import pytest
from sqlalchemy import select

from nex_app_kit import AppKit, ManagerLink, ManagerLinkError, User
from nex_app_kit.models import Session

from .conftest import DEPLOY, MODULE, SIGNING_KEY, manifest


def ticket(login: str = "eva", **changes) -> str:
    now = int(time.time())
    claims = {
        "iss": "nex-manager",
        "aud": MODULE,
        "sub": login,
        "deploy": DEPLOY,
        "tv": 1,
        "jti": str(uuid.uuid4()),
        "purpose": "module-launch",
        "iat": now,
        "exp": now + 30,
    }
    claims.update(changes)
    key = claims.pop("_key", SIGNING_KEY)
    for name in [k for k, v in claims.items() if v is None]:
        del claims[name]
    return jwt.encode(claims, key, algorithm="HS256")


def launch(app, lt: str, how: str = "get"):
    if how == "get":
        return app.client.get("/api/v1/launch", params={"lt": lt}, follow_redirects=False)
    if how == "form":
        return app.client.post("/api/v1/launch", data={"lt": lt}, follow_redirects=False)
    return app.client.post("/api/v1/launch", json={"lt": lt}, follow_redirects=False)


@pytest.mark.parametrize("how", ["get", "form", "json"])
def test_a_good_ticket_opens_the_app_signed_in(make_app, how):
    app = make_app(auth="manager")
    app.manager.add("eva", first_name="Eva", last_name="Malá", role="admin")

    response = launch(app, ticket("eva"), how)

    assert response.status_code == 303
    assert response.headers["location"] == "/"
    assert "HttpOnly" in response.headers["set-cookie"]
    me = app.client.get("/api/v1/auth/me").json()
    assert (me["username"], me["first_name"], me["last_name"], me["email"], me["role"]) == (
        "eva",
        "Eva",
        "Malá",
        "eva@firma.sk",
        "admin",
    )
    assert app.client.get("/api/v1/areas").json() == {"for": "eva"}


def test_the_person_is_a_mirror_of_nex_manager_without_a_password(make_app):
    app = make_app(auth="manager")
    app.manager.add("eva")

    launch(app, ticket("eva"))

    with app.db() as db:
        eva = db.scalars(select(User).where(User.username == "eva")).one()
    assert (eva.source, eva.password_hash, eva.must_change_password) == ("manager", None, False)


def test_a_second_launch_refreshes_the_mirror(make_app):
    app = make_app(auth="manager")
    app.manager.add("eva", last_name="Malá")
    launch(app, ticket("eva"))
    app.manager.add("eva", last_name="Veľká", role="admin")

    launch(app, ticket("eva"))

    with app.db() as db:
        eva = db.scalars(select(User).where(User.username == "eva")).one()
        assert (eva.last_name, eva.role) == ("Veľká", "admin")
        assert db.scalar(select(User.id).where(User.username == "eva").limit(1)) == eva.id


def test_a_ticket_works_once(make_app):
    app = make_app(auth="manager")
    app.manager.add("eva")
    lt = ticket("eva")
    assert launch(app, lt).status_code == 303

    again = launch(app, lt)

    assert again.status_code == 401
    assert "Tento lístok na spustenie už bol použitý. Otvor aplikáciu znova z NEX Managera." in again.text


def page_says(response, status: int, sentence: str) -> None:
    assert response.status_code == status, response.text
    assert response.headers["content-type"].startswith("text/html")
    assert f"<p>{sentence}</p>" in response.text
    assert "set-cookie" not in response.headers


@pytest.mark.parametrize(
    "changes,status,sentence",
    [
        (
            {"exp": int(time.time()) - 60, "iat": int(time.time()) - 80},
            401,
            "Lístok na spustenie už neplatí. Otvor aplikáciu znova z NEX Managera.",
        ),
        (
            {"_key": "iny-kluc-iny-kluc-iny-kluc-iny-k"},
            401,
            "Lístok na spustenie nie je platný. Otvor aplikáciu znova z NEX Managera.",
        ),
        ({"aud": "ina-aplikacia"}, 401, "Lístok na spustenie nie je platný. Otvor aplikáciu znova z NEX Managera."),
        ({"iss": "niekto-iny"}, 401, "Lístok na spustenie nie je platný. Otvor aplikáciu znova z NEX Managera."),
        ({"jti": None}, 401, "Lístok na spustenie nie je platný. Otvor aplikáciu znova z NEX Managera."),
        ({"purpose": "iny-ucel"}, 401, "Lístok nie je na spustenie aplikácie."),
        ({"deploy": "iny-zakaznik"}, 401, "Lístok vydal NEX Manager iného zákazníka."),
        ({"exp": int(time.time()) + 300}, 401, "Lístok na spustenie platí príliš dlho — taký NEX Manager nevydáva."),
    ],
    ids=["expired", "wrong key", "other app", "other issuer", "no jti", "other purpose", "other customer", "too long"],
)
def test_a_ticket_not_as_nex_manager_signs_it_is_refused(make_app, changes, status, sentence):
    app = make_app(auth="manager")
    app.manager.add("eva")

    page_says(launch(app, ticket("eva", **changes)), status, sentence)
    assert app.manager.asked == []


def test_without_a_ticket_the_page_says_where_to_go(make_app):
    app = make_app(auth="manager")

    page_says(launch(app, ""), 400, "Chýba lístok na spustenie. Otvor aplikáciu z NEX Managera.")


def test_a_customer_check_is_left_out_when_the_app_has_no_deploy_slug(make_app):
    app = make_app(auth="manager", deploy=None)
    app.manager.add("eva")

    assert launch(app, ticket("eva", deploy="hocikto")).status_code == 303


@pytest.mark.parametrize(
    "person,status,sentence",
    [
        (None, 403, "NEX Manager túto osobu nepozná."),
        ({"is_active": False}, 403, "Tvoj účet v NEX Manageri je vypnutý."),
        ({"has_module_access": False}, 403, "K tejto aplikácii nemáš v NEX Manageri prístup."),
        (
            {"has_module_access": None},
            503,
            "NEX Manager nepovedal, či máš k tejto aplikácii prístup — treba novšiu verziu NEX Managera.",
        ),
        ({"must_change_password": True}, 403, "Najprv si zmeň heslo v NEX Manageri."),
    ],
    ids=["unknown", "switched off", "no access", "outdated manager", "password change due"],
)
def test_nex_manager_decides_who_may_in(make_app, person, status, sentence):
    app = make_app(auth="manager")
    if person is not None:
        app.manager.add("eva", **person)

    page_says(launch(app, ticket("eva")), status, sentence)
    with app.db() as db:
        assert db.scalars(select(Session)).all() == []


def test_nex_manager_down_at_launch_is_said(make_app):
    app = make_app(auth="manager")
    app.manager.down = True

    page_says(launch(app, ticket("eva")), 503, "NEX Manager teraz neodpovedá. Skús aplikáciu otvoriť o chvíľu znova.")


def test_the_message_on_the_page_is_escaped(make_app):
    from nex_app_kit.routes import launch_page

    assert "<p>a &lt;b&gt;</p>" in launch_page("a <b>", 403).body.decode()


# ── while the session lasts ─────────────────────────────────────────────────────────────────────────
def test_nex_manager_is_asked_again_after_5_minutes(make_app):
    app = make_app(auth="manager")
    app.manager.add("eva")
    launch(app, ticket("eva"))
    asked_at_launch = len(app.manager.asked)
    app.clock.advance(minutes=4, seconds=59)
    app.client.get("/api/v1/areas")
    assert len(app.manager.asked) == asked_at_launch

    app.clock.advance(seconds=2)
    assert app.client.get("/api/v1/areas").status_code == 200

    assert len(app.manager.asked) == asked_at_launch + 1


@pytest.mark.parametrize(
    "change",
    [{"is_active": False}, {"has_module_access": False}, {"token_version": 2}, {"must_change_password": True}],
    ids=["switched off", "access taken", "signed out in NEX Manager", "password change due"],
)
def test_the_session_ends_when_nex_manager_no_longer_confirms(make_app, change):
    app = make_app(auth="manager")
    app.manager.add("eva")
    launch(app, ticket("eva"))
    app.manager.add("eva", **change)
    app.clock.advance(minutes=6)

    response = app.client.get("/api/v1/areas")

    assert response.status_code == 401
    assert response.json()["detail"] == "Prihlásenie vypršalo. Aplikáciu otvor znova z NEX Managera."
    with app.db() as db:
        assert db.scalars(select(Session)).all() == []


def test_a_person_nex_manager_forgot_is_out(make_app):
    app = make_app(auth="manager")
    app.manager.add("eva")
    launch(app, ticket("eva"))
    del app.manager.people["eva"]
    app.clock.advance(minutes=6)

    assert app.client.get("/api/v1/areas").status_code == 401


def test_nex_manager_down_does_not_throw_people_out_and_is_asked_again_in_a_minute(make_app):
    app = make_app(auth="manager")
    app.manager.add("eva")
    launch(app, ticket("eva"))
    app.manager.down = True
    app.clock.advance(minutes=6)
    assert app.client.get("/api/v1/areas").status_code == 200
    asked = len(app.manager.asked)
    app.clock.advance(seconds=59)
    app.client.get("/api/v1/areas")
    assert len(app.manager.asked) == asked

    app.manager.down = False
    app.manager.add("eva", is_active=False)
    app.clock.advance(seconds=2)

    assert app.client.get("/api/v1/areas").status_code == 401


def test_a_confirmation_refreshes_the_mirror(make_app):
    app = make_app(auth="manager")
    app.manager.add("eva", last_name="Malá")
    launch(app, ticket("eva"))
    app.manager.add("eva", last_name="Nová")
    app.clock.advance(minutes=6)

    assert app.client.get("/api/v1/auth/me").json()["last_name"] == "Nová"


def test_launched_apps_have_no_own_password(make_app):
    app = make_app(auth="manager")

    assert app.client.post("/api/v1/auth/login", json={"username": "a", "password": "b"}).status_code == 404
    assert app.client.get("/api/v1/users").status_code == 404
    assert app.client.patch("/api/v1/auth/me", json={"email": "a@b.sk"}).status_code == 405


def test_without_a_session_the_sentence_points_to_nex_manager(make_app):
    app = make_app(auth="manager")

    assert app.client.get("/api/v1/areas").json() == {
        "detail": "Prihlásenie vypršalo. Aplikáciu otvor znova z NEX Managera.",
        "code": "KIT-AUTH-REQUIRED",
    }


# ── setting the link up ─────────────────────────────────────────────────────────────────────────────
def test_the_link_comes_from_the_cockpit_s_environment():
    link = ManagerLink.from_env(
        {
            "MANAGER_LAUNCH_SIGNING_KEY": "k",
            "MANAGER_MODULE_SLUG": "nex-knowledge",
            "MANAGER_DEPLOY_SLUG": "zakaznik",
            "NEX_MANAGER_BASE_URL": "https://zakaznik-manager.example/",
            "NEX_MANAGER_API_KEY": "a",
        }
    )
    assert (link.module_slug, link.deploy_slug, link.base_url) == (
        "nex-knowledge",
        "zakaznik",
        "https://zakaznik-manager.example",
    )


def test_a_missing_part_of_the_link_is_named():
    with pytest.raises(ManagerLinkError) as caught:
        ManagerLink.from_env({"MANAGER_LAUNCH_SIGNING_KEY": "k", "MANAGER_MODULE_SLUG": "m"})
    assert str(caught.value) == (
        "Aplikácia sa spúšťa z NEX Managera, ale chýba prepojenie s ním — prázdne: NEX_MANAGER_BASE_URL, "
        "NEX_MANAGER_API_KEY."
    )


def test_a_launched_app_not_yet_paired_starts_and_says_so_at_launch(factory):
    from fastapi.testclient import TestClient

    from .conftest import build_app

    kit = AppKit(manifest=manifest("manager"), version="1", session_factory=factory)
    client = TestClient(build_app(kit), base_url="https://testserver")

    page_says(
        client.get("/api/v1/launch", params={"lt": ticket("eva")}, follow_redirects=False),
        503,
        "Aplikácia ešte nie je prepojená s NEX Managerom. Povedz o tom správcovi aplikácie.",
    )
    assert client.get("/api/v1/health").status_code == 200
    assert client.get("/api/v1/areas").json()["detail"] == "Prihlásenie vypršalo. Aplikáciu otvor znova z NEX Managera."


# ── asking NEX Manager over HTTP ────────────────────────────────────────────────────────────────────
class FakeResponse:
    def __init__(self, status: int, data=None) -> None:
        self.status_code = status
        self._data = data

    def json(self):
        if isinstance(self._data, Exception):
            raise self._data
        return self._data


def http_link() -> ManagerLink:
    return ManagerLink(signing_key="k", module_slug="nex-skuska", base_url="https://manager.example", api_key="api-key")


def test_nex_manager_is_asked_with_the_app_s_own_key(monkeypatch):
    import httpx

    sent = {}

    def fake_get(url, headers, timeout):
        sent.update(url=url, headers=headers, timeout=timeout)
        return FakeResponse(
            200,
            {
                "login": "eva@firma.sk",
                "first_name": "Eva",
                "last_name": None,
                "email": "eva@firma.sk",
                "role": "admin",
                "is_active": True,
                "must_change_password": False,
                "token_version": 3,
                "has_module_access": True,
                "groups": [],
            },
        )

    monkeypatch.setattr(httpx, "get", fake_get)

    identity = http_link().lookup("eva@firma.sk")

    assert sent["url"] == "https://manager.example/api/v1/identity/eva%40firma.sk"
    assert sent["headers"] == {"X-Module-Slug": "nex-skuska", "Authorization": "Bearer api-key"}
    assert sent["timeout"] == 5.0
    assert (identity.login, identity.last_name, identity.role, identity.token_version, identity.has_module_access) == (
        "eva@firma.sk",
        "",
        "admin",
        3,
        True,
    )


def test_a_person_nex_manager_does_not_know_is_none(monkeypatch):
    import httpx

    monkeypatch.setattr(httpx, "get", lambda url, headers, timeout: FakeResponse(404))

    assert http_link().lookup("nikto") is None


def test_an_older_nex_manager_says_nothing_about_access(monkeypatch):
    import httpx

    data = {"login": "eva", "is_active": True, "token_version": 1}
    monkeypatch.setattr(httpx, "get", lambda url, headers, timeout: FakeResponse(200, data))

    assert http_link().lookup("eva").has_module_access is None


@pytest.mark.parametrize(
    "answer",
    [FakeResponse(500), FakeResponse(401), FakeResponse(200, ValueError("not json")), FakeResponse(200, {"x": 1})],
    ids=["server error", "key refused", "not json", "no login"],
)
def test_nex_manager_answering_nonsense_is_unavailable(monkeypatch, answer):
    import httpx

    from nex_app_kit import ManagerUnavailable

    monkeypatch.setattr(httpx, "get", lambda url, headers, timeout: answer)

    with pytest.raises(ManagerUnavailable):
        http_link().lookup("eva")


def test_nex_manager_not_reachable_is_unavailable(monkeypatch):
    import httpx

    from nex_app_kit import ManagerUnavailable

    def refuse(url, headers, timeout):
        raise httpx.ConnectError("refused")

    monkeypatch.setattr(httpx, "get", refuse)

    with pytest.raises(ManagerUnavailable):
        http_link().lookup("eva")
