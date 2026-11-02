"""DEV-290 — the app is told when the kit ends a person's sign-in by someone's act.

NEX Manager moves onto the template in 1.5.0. Until then it raised its own sign-in counter when a person signed out,
changed their password, got a new one from an admin or was switched off, and every app opened from it signed the
person out within 5 minutes. On the template those acts are the template's: unless it tells the app, an app opened
from NEX Manager stays signed in for up to 8 idle hours after the person signed out of NEX Manager.
"""

from __future__ import annotations

import ast
from pathlib import Path

import pytest
from sqlalchemy import select

import nex_app_kit
from nex_app_kit import AccountEvent
from nex_app_kit.models import Session, User

from .test_launch import launch, ticket


class Told(list):
    """What the app was told: who, why, and the person as the act left them."""

    def __call__(self, db, user, event):
        self.append((user.username, event))
        self.seen = {"is_active": user.is_active, "must_change_password": user.must_change_password}


def signed_in_admin_and_eva(make_app, told):
    app = make_app(on_account_change=told)
    app.user("spravca", role="admin")
    eva = app.user("eva")
    app.login("spravca")
    browser = app.other_browser()
    app.login("eva", client=browser)
    return app, eva, browser


def eva_sessions(app, eva) -> list[Session]:
    with app.db() as db:
        return db.scalars(select(Session).where(Session.user_id == eva.id)).all()


# ── the person's own acts ───────────────────────────────────────────────────────────────────────────
def test_signing_out_is_told(make_app):
    told = Told()
    app = make_app(on_account_change=told)
    app.user("eva")
    app.login("eva")

    assert app.client.post("/api/v1/auth/logout").status_code == 204

    assert told == [("eva", AccountEvent.SIGNED_OUT)]


def test_signing_out_with_no_session_tells_nothing(make_app):
    told = Told()
    app = make_app(on_account_change=told)

    assert app.client.post("/api/v1/auth/logout").status_code == 204

    assert told == []


def test_a_changed_password_is_told(make_app):
    told = Told()
    app = make_app(on_account_change=told)
    app.user("eva")
    app.login("eva")

    response = app.client.post(
        "/api/v1/auth/change-password", json={"current_password": "heslo-123", "new_password": "nove-heslo-1"}
    )

    assert response.status_code == 204
    assert told == [("eva", AccountEvent.PASSWORD_CHANGED)]


# ── an admin's acts ─────────────────────────────────────────────────────────────────────────────────
def _set_password(app, eva):
    return app.client.post(f"/api/v1/users/{eva.id}/password", json={"new_password": "nove-heslo-1"})


def _switch_off(app, eva):
    body = {"email": "eva@firma.sk", "role": "user", "first_name": "", "last_name": "", "is_active": False}
    return app.client.patch(f"/api/v1/users/{eva.id}", json=body)


def _end_her_session(app, eva):
    (row,) = [r for r in app.client.get("/api/v1/sessions").json() if r["username"] == "eva"]
    return app.client.delete(f"/api/v1/sessions/{row['id']}")


def _delete(app, eva):
    return app.client.delete(f"/api/v1/users/{eva.id}")


@pytest.mark.parametrize(
    ("act", "event"),
    [
        (_set_password, AccountEvent.PASSWORD_SET),
        (_switch_off, AccountEvent.DEACTIVATED),
        (_end_her_session, AccountEvent.SESSION_ENDED),
        (_delete, AccountEvent.DELETED),
    ],
    ids=["new password", "switched off", "session ended", "deleted"],
)
def test_an_admin_s_act_is_told_as_the_person_s_not_the_admin_s(make_app, act, event):
    told = Told()
    app, eva, browser = signed_in_admin_and_eva(make_app, told)

    assert act(app, eva).status_code in (200, 204)

    assert told == [("eva", event)]
    assert browser.get("/api/v1/areas").status_code == 401


def test_the_app_sees_the_person_as_the_act_left_them(make_app):
    told = Told()
    app, eva, _browser = signed_in_admin_and_eva(make_app, told)

    _switch_off(app, eva)
    assert told.seen["is_active"] is False

    app.client.patch(
        f"/api/v1/users/{eva.id}",
        json={"email": "eva@firma.sk", "role": "user", "first_name": "", "last_name": "", "is_active": True},
    )
    _set_password(app, eva)
    assert told.seen["must_change_password"] is True


def test_changes_that_keep_the_sign_in_tell_nothing(make_app):
    told = Told()
    app, eva, browser = signed_in_admin_and_eva(make_app, told)
    switched_off = app.user("jan", is_active=False)

    app.client.patch(
        f"/api/v1/users/{eva.id}",
        json={
            "email": "eva.nova@firma.sk",
            "role": "admin",
            "first_name": "Eva",
            "last_name": "Nová",
            "is_active": True,
        },
    )
    app.client.patch(
        f"/api/v1/users/{switched_off.id}",
        json={"email": "jan@firma.sk", "role": "user", "first_name": "", "last_name": "", "is_active": True},
    )
    browser.patch("/api/v1/auth/me", json={"email": "eva@firma.sk", "first_name": "Eva", "last_name": "Malá"})

    assert told == []
    assert browser.get("/api/v1/areas").status_code == 200


# ── what is nobody's act ────────────────────────────────────────────────────────────────────────────
def test_a_sign_in_that_runs_out_tells_nothing(make_app):
    told = Told()
    app = make_app(on_account_change=told)
    app.user("eva")
    app.login("eva")
    app.clock.advance(hours=8)

    assert app.client.get("/api/v1/areas").status_code == 401

    assert told == []


def test_a_person_nex_manager_no_longer_confirms_tells_nothing(make_app):
    told = Told()
    app = make_app(auth="manager", on_account_change=told)
    app.manager.add("eva")
    launch(app, ticket("eva"))
    app.manager.add("eva", token_version=2)
    app.clock.advance(minutes=6)

    assert app.client.get("/api/v1/areas").status_code == 401

    assert told == []


# ── the app's record stands or falls with the act ───────────────────────────────────────────────────
def test_an_act_the_app_cannot_record_does_not_happen(make_app):
    def refuse(db, user, event):
        raise RuntimeError("počítadlo sa nedá zvýšiť")

    app, eva, browser = signed_in_admin_and_eva(make_app, refuse)

    with pytest.raises(RuntimeError):
        _switch_off(app, eva)
    with pytest.raises(RuntimeError):
        browser.post("/api/v1/auth/logout")

    with app.db() as db:
        assert db.get(User, eva.id).is_active is True
    assert len(eva_sessions(app, eva)) == 1
    assert browser.get("/api/v1/areas").status_code == 200


# ── the rule, not a list ────────────────────────────────────────────────────────────────────────────
PACKAGE = Path(nex_app_kit.__file__).parent


def _functions(module: Path):
    """Each function of a module with its own nodes — those of the functions defined inside it belong to them."""
    for function in ast.walk(ast.parse(module.read_text(encoding="utf-8"))):
        if isinstance(function, (ast.FunctionDef, ast.AsyncFunctionDef)):
            own, stack = [], [c for c in function.body if not isinstance(c, (ast.FunctionDef, ast.AsyncFunctionDef))]
            while stack:
                node = stack.pop()
                own.append(node)
                stack.extend(
                    c for c in ast.iter_child_nodes(node) if not isinstance(c, (ast.FunctionDef, ast.AsyncFunctionDef))
                )
            yield function, own


def _called(call: ast.Call) -> str | None:
    return call.func.attr if isinstance(call.func, ast.Attribute) else getattr(call.func, "id", None)


def test_the_kit_ends_a_person_s_sessions_only_by_saying_why():
    """A new route that ends sessions must not slip past the app: only sessions.py deletes a session, and every
    end_all the kit itself calls names the act."""
    silent = []
    for module in sorted(PACKAGE.glob("*.py")):
        for function, own in _functions(module):
            calls = [n for n in own if isinstance(n, ast.Call)]
            touches_sessions = any(isinstance(n, ast.Name) and n.id == "Session" for n in own)
            if module.name != "sessions.py" and touches_sessions and any(_called(c) == "delete" for c in calls):
                silent.append(f"{module.name}:{function.name} deletes a session itself")
            for call in calls:
                if _called(call) == "end_all" and not any(k.arg == "event" for k in call.keywords):
                    silent.append(f"{module.name}:{function.name} ends sessions without saying why")

    assert silent == []
