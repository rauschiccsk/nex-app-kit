"""DEV-523 — the web of an app on the template (``web/``): its own accounts and sessions, and the admin's list of them.

A Web project has an administration (``frontend/``, sign-in by name) and a web (``web/``, sign-in by e-mail) on one
server. 26.11.2026 orthodox-register: the priests use the web, the administrator the administration. The web's accounts
are separate from the administration's — one e-mail may be on several of those (DEV-310), while the web signs in by
e-mail, so it is unique among the web's accounts — and a registration is a request the admin decides. Director
26.11.2026 on the proposal: „Súhlasím“; earlier (03.11.2026): „…každú požiadavku na registráciu musí schváliť človek -
administrátor.“

Mounted only when the app's manifest says ``"web": true``.
"""

from __future__ import annotations

import math
import secrets
import uuid
from collections.abc import Callable
from datetime import datetime, timedelta
from typing import TYPE_CHECKING, Any

from fastapi import APIRouter, Depends, Request, Response
from pydantic import BaseModel
from sqlalchemy import delete, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session as Db

from .errors import KitError, conflict, not_found, not_signed_in
from .models import User, WebAccount, WebSession
from .passwords import DUMMY_HASH, check_new_password, hash_password, verify_password
from .sessions import TOUCH_EVERY, same_origin, token_hash
from .system_settings import SystemSettings

if TYPE_CHECKING:
    from .kit import AppKit

COOKIE = "nex_web_session"
PENDING = "pending"
ACTIVE = "active"
REJECTED = "rejected"
DISABLED = "disabled"
MAX_FAILED_LOGINS = 5
LOCK_FOR = timedelta(minutes=15)


class RegisterBody(BaseModel):
    email: str
    password: str
    first_name: str = ""
    last_name: str = ""


class WebLoginBody(BaseModel):
    email: str
    password: str


def web_account_read(account: WebAccount) -> dict[str, Any]:
    return {
        "id": str(account.id),
        "email": account.email,
        "first_name": account.first_name,
        "last_name": account.last_name,
        "status": account.status,
        "created_at": account.created_at.isoformat() if account.created_at else None,
        "decided_at": account.decided_at.isoformat() if account.decided_at else None,
    }


class WebSessions:
    """One per browser signed in to the web — the administration's sessions (``sessions.Sessions``) in small: the same
    idle and longest time (system settings), a cookie of its own."""

    def __init__(self, settings: SystemSettings, clock: Callable[[], datetime], secure_cookies: bool) -> None:
        self._settings = settings
        self._clock = clock
        self._secure = secure_cookies

    def start(self, db: Db, account: WebAccount, request: Request, response: Response) -> WebSession:
        now = self._clock()
        token = secrets.token_urlsafe(32)
        max_hours = self._settings.get_int("auth_session_max_hours")
        row = WebSession(
            token_hash=token_hash(token),
            account_id=account.id,
            created_at=now,
            last_seen_at=now,
            expires_at=now + timedelta(hours=max_hours),
            user_agent=(request.headers.get("user-agent") or "")[:200] or None,
        )
        db.add(row)
        db.flush()
        response.set_cookie(
            COOKIE, token, max_age=max_hours * 3600, httponly=True, secure=self._secure, samesite="lax", path="/"
        )
        return row

    def end(self, db: Db, request: Request, response: Response) -> None:
        token = request.cookies.get(COOKIE)
        if token:
            db.execute(delete(WebSession).where(WebSession.token_hash == token_hash(token)))
        response.delete_cookie(COOKIE, path="/", secure=self._secure, httponly=True, samesite="lax")

    @staticmethod
    def end_account(db: Db, account_id: uuid.UUID) -> None:
        """Sign the web account out in every browser — when the admin switches it off. The web's sessions are its own;
        the app's ``on_account_change`` speaks of the administration's people (``AccountEvent``)."""
        db.execute(delete(WebSession).where(WebSession.account_id == account_id))

    def resolve(self, db: Db, request: Request) -> WebAccount | None:
        token = request.cookies.get(COOKIE)
        if not token:
            return None
        row = db.scalars(select(WebSession).where(WebSession.token_hash == token_hash(token))).one_or_none()
        if row is None:
            return None
        now = self._clock()
        idle = timedelta(minutes=self._settings.get_int("auth_session_idle_minutes"))
        account = db.get(WebAccount, row.account_id)
        if row.expires_at <= now or row.last_seen_at + idle <= now or account is None or account.status != ACTIVE:
            db.delete(row)
            db.commit()  # the request is refused right after, and a refusal rolls its transaction back
            return None
        if now - row.last_seen_at >= TOUCH_EVERY:
            row.last_seen_at = now
        return account


def build_web_router(kit: AppKit) -> APIRouter:
    router = APIRouter()
    db_dep = Depends(kit.db)

    def refuse_other_sites(request: Request) -> None:
        if not same_origin(request):
            raise KitError(403, "KIT-ORIGIN", "kit.server.origin")

    def web_account(request: Request, db: Db = db_dep) -> WebAccount:
        account = kit.web_sessions.resolve(db, request)
        if account is None:
            raise not_signed_in("kit.server.web.notSignedIn")
        return account

    #: The account signed in to the web — an app's own web routes ask for it as the administration's ask for the user.
    kit.web_account = web_account

    def find(db: Db, account_id: str) -> WebAccount:
        try:
            found = db.get(WebAccount, uuid.UUID(account_id))
        except ValueError:
            found = None
        if found is None:
            raise not_found("kit.server.web.accountNotFound")
        return found

    def decide(db: Db, account: WebAccount, status: str, admin: User) -> dict:
        account.status = status
        account.decided_by = admin.id
        account.decided_at = kit.clock()
        account.updated_at = kit.clock()
        if status != ACTIVE:
            WebSessions.end_account(db, account.id)
        db.commit()
        return web_account_read(account)

    # ── the web: a registration request, sign-in by e-mail ─────────────────────────────────────────
    @router.post("/web/auth/register", status_code=201)
    def register(body: RegisterBody, request: Request, db: Db = db_dep) -> dict:
        from .routes import clean_email, clean_name

        refuse_other_sites(request)
        email = clean_email(body.email).lower()  # one e-mail, one web account — whatever the capitals
        check_new_password(body.password)
        account = WebAccount(
            email=email,
            password_hash=hash_password(body.password, kit.bcrypt_rounds),
            first_name=clean_name(body.first_name, "kit.server.field.firstName"),
            last_name=clean_name(body.last_name, "kit.server.field.lastName"),
            status=PENDING,
            failed_logins=0,
        )
        db.add(account)
        try:
            db.flush()
        except IntegrityError:
            db.rollback()
            raise conflict("kit.server.web.emailTaken", "KIT-WEB-EMAIL-TAKEN") from None
        db.commit()
        return web_account_read(account)

    @router.post("/web/auth/login")
    def login(body: WebLoginBody, request: Request, response: Response, db: Db = db_dep) -> dict:
        from .routes import clean_email

        refuse_other_sites(request)
        now = kit.clock()
        try:
            email = clean_email(body.email).lower()
        except KitError:
            email = body.email.strip().lower()
        account = db.scalars(select(WebAccount).where(WebAccount.email == email)).one_or_none()
        if account is not None and account.locked_until is not None and account.locked_until > now:
            minutes = max(1, math.ceil((account.locked_until - now).total_seconds() / 60))
            raise KitError(429, "KIT-AUTH-LOCKED", "kit.server.locked", params={"minutes": minutes})
        if account is None:
            verify_password(body.password, DUMMY_HASH)
            raise KitError(401, "KIT-AUTH-FAILED", "kit.server.web.wrongCredentials")
        if not verify_password(body.password, account.password_hash):
            account.failed_logins += 1
            if account.failed_logins >= MAX_FAILED_LOGINS:
                account.failed_logins = 0
                account.locked_until = now + LOCK_FOR
            db.commit()
            raise KitError(401, "KIT-AUTH-FAILED", "kit.server.web.wrongCredentials")
        if account.status == PENDING:
            raise KitError(403, "KIT-WEB-PENDING", "kit.server.web.pending")
        if account.status == REJECTED:
            raise KitError(403, "KIT-WEB-REJECTED", "kit.server.web.rejected")
        if account.status == DISABLED:
            raise KitError(403, "KIT-WEB-DISABLED", "kit.server.web.disabled")
        account.failed_logins = 0
        account.locked_until = None
        kit.web_sessions.start(db, account, request, response)
        db.commit()
        return web_account_read(account)

    @router.get("/web/auth/me")
    def me(account: WebAccount = Depends(web_account)) -> dict:
        return web_account_read(account)

    @router.post("/web/auth/logout", status_code=204)
    def logout(request: Request, db: Db = db_dep) -> Response:
        refuse_other_sites(request)
        response = Response(status_code=204)
        kit.web_sessions.end(db, request, response)
        db.commit()
        return response

    # ── the administration: the web's accounts, a request decided ──────────────────────────────────
    @router.get("/web-accounts")
    def list_accounts(_admin: User = Depends(kit.require_admin), db: Db = db_dep) -> list[dict]:
        rows = db.scalars(select(WebAccount).order_by(WebAccount.created_at, WebAccount.email)).all()
        return [web_account_read(row) for row in rows]

    def transition(name: str, allowed_from: tuple[str, ...], to: str) -> None:
        @router.post(f"/web-accounts/{{account_id}}/{name}", name=f"web_account_{name}")
        def act(account_id: str, admin: User = Depends(kit.require_admin), db: Db = db_dep) -> dict:
            account = find(db, account_id)
            if account.status not in allowed_from:
                raise conflict(f"kit.server.web.cannot.{name}", "KIT-WEB-STATUS")
            return decide(db, account, to, admin)

    transition("approve", (PENDING,), ACTIVE)
    transition("reject", (PENDING,), REJECTED)
    transition("disable", (ACTIVE,), DISABLED)
    transition("enable", (DISABLED,), ACTIVE)

    return router
