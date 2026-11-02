"""Sessions — one per signed-in browser, kept in the database, for both ways of signing in.

The browser holds a random token in a cookie JavaScript cannot read (HttpOnly, SameSite=Lax); the table holds its
SHA-256. A session ends after the idle time and at the latest after the longest time (both system settings), when
it is ended in Nastavenia → Relácie, at logout, when the password changes — and, launched from NEX Manager, when
NEX Manager no longer confirms the person (asked again every 5 minutes).

When a session ends by someone's act — not by time running out, nor because NEX Manager no longer confirms the person
— the app is told why (``AccountEvent``), inside the same transaction as the act (DEV-290)."""

from __future__ import annotations

import hashlib
import logging
import secrets
from collections.abc import Callable
from datetime import datetime, timedelta
from enum import StrEnum
from urllib.parse import urlsplit

from fastapi import Request, Response
from sqlalchemy import delete, select
from sqlalchemy.orm import Session as Db

from .manager import ManagerLink, ManagerUnavailable, admission_problem
from .models import Session, User
from .system_settings import SystemSettings

logger = logging.getLogger("nex_app_kit.sessions")

COOKIE = "nex_session"
#: ``last_seen_at`` is written at most this often — not on every request.
TOUCH_EVERY = timedelta(seconds=60)
#: Launched from NEX Manager: how often NEX Manager is asked again whether the person may stay.
REVERIFY_EVERY = timedelta(minutes=5)
#: NEX Manager could not be asked: the person stays, and it is asked again after this.
RETRY_AFTER_OUTAGE = timedelta(minutes=1)
SAFE_METHODS = ("GET", "HEAD", "OPTIONS")


class AccountEvent(StrEnum):
    """Why the kit ended a person's sign-in — always someone's act (DEV-290)."""

    #: The person signed out in this browser.
    SIGNED_OUT = "signed_out"
    #: The person changed their own password; their other browsers sign in again.
    PASSWORD_CHANGED = "password_changed"
    #: An admin gave the person a new password; every browser signs in again.
    PASSWORD_SET = "password_set"
    #: An admin switched the person's account off.
    DEACTIVATED = "deactivated"
    #: An admin ended one of the person's sessions in Nastavenia → Relácie.
    SESSION_ENDED = "session_ended"
    #: An admin deleted the person's account.
    DELETED = "deleted"


#: What the app is told when the kit ends a person's sign-in by someone's act — ``(db, person, event)``, inside the
#: same transaction, so what the app does about it stands or falls with the act. NEX Manager raises its sign-in counter
#: and every app opened from it signs the person out within 5 minutes (DEV-290).
AccountChanged = Callable[[Db, User, AccountEvent], None]


def token_hash(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def same_origin(request: Request) -> bool:
    """Does a request that changes something come from this app's own pages? A page of another site could make the
    browser send the cookie along; the browser's own headers say where the request started."""
    site = request.headers.get("sec-fetch-site")
    if site is not None:
        return site in ("same-origin", "none")
    origin = request.headers.get("origin")
    if origin is None:
        return True
    # „null“ (a sandboxed or file page) has no address, so it never matches this app's.
    return urlsplit(origin).netloc.lower() == request.headers.get("host", "").lower()


class Sessions:
    def __init__(
        self,
        settings: SystemSettings,
        clock: Callable[[], datetime],
        secure_cookies: bool,
        manager: ManagerLink | None,
        on_account_change: AccountChanged | None = None,
    ) -> None:
        self._settings = settings
        self._clock = clock
        self._secure = secure_cookies
        self._manager = manager
        self._on_account_change = on_account_change

    # ── start and end ──────────────────────────────────────────────────────────────────────────────
    def start(
        self, db: Db, user: User, request: Request, response: Response, *, manager_token_version: int | None = None
    ) -> Session:
        now = self._clock()
        token = secrets.token_urlsafe(32)
        max_hours = self._settings.get_int("auth_session_max_hours")
        row = Session(
            token_hash=token_hash(token),
            user_id=user.id,
            created_at=now,
            last_seen_at=now,
            expires_at=now + timedelta(hours=max_hours),
            verified_at=now if manager_token_version is not None else None,
            manager_token_version=manager_token_version,
            user_agent=(request.headers.get("user-agent") or "")[:200] or None,
        )
        db.add(row)
        db.flush()
        response.set_cookie(
            COOKIE,
            token,
            max_age=max_hours * 3600,
            httponly=True,
            secure=self._secure,
            samesite="lax",
            path="/",
        )
        return row

    def end(self, db: Db, request: Request, response: Response) -> None:
        """Sign out in this browser."""
        token = request.cookies.get(COOKIE)
        row = None
        if token:
            row = db.scalars(select(Session).where(Session.token_hash == token_hash(token))).one_or_none()
        if row is not None:
            user = db.get(User, row.user_id)
            db.delete(row)
            self._tell(db, user, AccountEvent.SIGNED_OUT)
        self.clear_cookie(response)

    def clear_cookie(self, response: Response) -> None:
        response.delete_cookie(COOKIE, path="/", secure=self._secure, httponly=True, samesite="lax")

    def end_all(self, db: Db, user_id, *, keep: Session | None = None, event: AccountEvent | None = None) -> None:
        """End the person's sessions (but ``keep``). The kit always says why (``event``) and the app is told even when
        no session was open — a new password matters to NEX Manager either way. An app ending them for a reason of
        its own (NEX Manager no longer knows the person) passes no event."""
        query = delete(Session).where(Session.user_id == user_id)
        if keep is not None:
            query = query.where(Session.id != keep.id)
        db.execute(query)
        if event is not None:
            self._tell(db, db.get(User, user_id), event)

    def revoke(self, db: Db, row: Session) -> None:
        """An admin ends one session in Nastavenia → Relácie."""
        user = db.get(User, row.user_id)
        db.delete(row)
        self._tell(db, user, AccountEvent.SESSION_ENDED)

    def _tell(self, db: Db, user: User, event: AccountEvent) -> None:
        if self._on_account_change is not None:
            db.flush()
            self._on_account_change(db, user, event)

    # ── who is it ──────────────────────────────────────────────────────────────────────────────────
    def resolve(self, db: Db, request: Request) -> tuple[Session, User] | None:
        token = request.cookies.get(COOKIE)
        if not token:
            return None
        row = db.scalars(select(Session).where(Session.token_hash == token_hash(token))).one_or_none()
        if row is None:
            return None
        now = self._clock()
        idle = timedelta(minutes=self._settings.get_int("auth_session_idle_minutes"))
        user = db.get(User, row.user_id)
        if row.expires_at <= now or row.last_seen_at + idle <= now or user is None or not user.is_active:
            return self._drop(db, row)
        if row.manager_token_version is not None and not self._still_confirmed(db, row, user, now):
            return self._drop(db, row)
        if now - row.last_seen_at >= TOUCH_EVERY:
            row.last_seen_at = now
        return row, user

    @staticmethod
    def _drop(db: Db, row: Session) -> None:
        # Committed at once: the request is refused right after, and a refusal rolls its transaction back.
        db.delete(row)
        db.commit()
        return None

    def _still_confirmed(self, db: Db, row: Session, user: User, now: datetime) -> bool:
        if self._manager is None:
            return False
        if row.verified_at is not None and now - row.verified_at < REVERIFY_EVERY:
            return True
        try:
            identity = self._manager.lookup(user.username)
        except ManagerUnavailable as exc:
            logger.warning("NEX Manager could not confirm %s: %s", user.username, exc)
            row.verified_at = now - REVERIFY_EVERY + RETRY_AFTER_OUTAGE
            return True
        if admission_problem(identity) is not None or identity.token_version != row.manager_token_version:
            return False
        mirror_identity(user, identity, now)
        row.verified_at = now
        return True


def mirror_identity(user: User, identity, now: datetime) -> None:
    """The person as NEX Manager knows them — the app keeps only this mirror."""
    user.first_name = identity.first_name or None
    user.last_name = identity.last_name or None
    user.email = identity.email or None
    user.role = "admin" if identity.role == "admin" else "user"
    user.is_active = identity.is_active
    user.updated_at = now
