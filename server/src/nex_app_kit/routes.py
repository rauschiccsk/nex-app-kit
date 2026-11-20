"""The standard interface (KONTRAKT.md) — every route the template's frame calls, with who may call it.

Which routes exist follows the manifest: an app with its own password has login, own account and users; an app
launched from NEX Manager has the launch instead; an app with AI has the agents."""

from __future__ import annotations

import json
import math
import re
import uuid
from datetime import timedelta
from html import escape
from typing import TYPE_CHECKING, Any
from urllib.parse import parse_qs

from email_validator import EmailNotValidError, validate_email
from fastapi import APIRouter, Depends, Request, Response
from fastapi.responses import HTMLResponse, JSONResponse, RedirectResponse
from pydantic import BaseModel
from sqlalchemy import delete, select, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session as Db

from . import docs
from .errors import KitError, conflict, invalid, not_found, request_language
from .i18n import tr
from .installation import Installation
from .kit import ADMIN_ROLE
from .layout import SIDEBAR_WIDTH
from .manager import LaunchRefused, ManagerUnavailable, admission_problem, ticket_expiry
from .models import AgentSetting, Session, UsedLaunchToken, User, UserLayout
from .passwords import DUMMY_HASH, check_new_password, hash_password, verify_password
from .sessions import AccountEvent, mirror_identity, same_origin
from .system_settings import said_in as settings_said_in

if TYPE_CHECKING:
    from .kit import AppKit

ROLES = ("admin", "user")
MODEL_FAMILIES = (("opus", "Opus"), ("sonnet", "Sonnet"), ("haiku", "Haiku"))
EFFORTS = ("low", "medium", "high", "xhigh", "max")
USERNAME = re.compile(r"^[A-Za-z0-9._@-]{3,50}$")
NAME_MAX = 100
#: After this many wrong passwords in a row the account waits :data:`LOCK_FOR`.
MAX_FAILED_LOGINS = 5
LOCK_FOR = timedelta(minutes=15)


# ── bodies ───────────────────────────────────────────────────────────────────────────────────────
class LoginBody(BaseModel):
    username: str
    password: str


class ProfileBody(BaseModel):
    email: str
    first_name: str = ""
    last_name: str = ""


class ChangePasswordBody(BaseModel):
    #: DEV-439 — no longer asked: the signed-in person changes their password without the current one. A frame of an
    #: older template still sends it; it is ignored.
    current_password: str = ""
    new_password: str


class NewUserBody(BaseModel):
    username: str
    email: str
    password: str
    role: str
    first_name: str = ""
    last_name: str = ""
    is_active: bool = True
    #: DEV-415 — one of the app's languages; absent = the person follows the installation's.
    language: str | None = None


class UserChangesBody(BaseModel):
    email: str
    role: str
    first_name: str = ""
    last_name: str = ""
    is_active: bool
    #: DEV-415 — the person's new language; absent = unchanged.
    language: str | None = None


class PasswordBody(BaseModel):
    new_password: str


class LanguageBody(BaseModel):
    language: str


class SettingBody(BaseModel):
    value: str


class AgentBody(BaseModel):
    model: str = ""
    effort: str = ""


class LayoutBody(BaseModel):
    sidebar_width: int | None = None
    sidebar_collapsed: bool | None = None


# ── shapes of answers ────────────────────────────────────────────────────────────────────────────
def user_read(user: User) -> dict[str, Any]:
    return {
        "id": str(user.id),
        "username": user.username,
        "email": user.email or "",
        "role": user.role,
        "is_active": user.is_active,
        "first_name": user.first_name,
        "last_name": user.last_name,
        "must_change_password": user.must_change_password,
        "language": user.language,
        "created_at": user.created_at.isoformat(),
        "updated_at": user.updated_at.isoformat(),
    }


def session_read(row: Session, username: str | None, current: Session | None) -> dict[str, Any]:
    return {
        "id": str(row.id),
        "user_id": str(row.user_id),
        "username": username,
        "created_at": row.created_at.isoformat(),
        "last_seen_at": row.last_seen_at.isoformat(),
        "updated_at": row.last_seen_at.isoformat(),
        "expires_at": row.expires_at.isoformat(),
        "user_agent": row.user_agent,
        "current": current is not None and row.id == current.id,
    }


def layout_read(row: UserLayout | None) -> dict[str, Any]:
    return {
        "sidebar_width": row.sidebar_width if row else None,
        "sidebar_collapsed": row.sidebar_collapsed if row else False,
        "limits": {
            "sidebar_width": {"min": SIDEBAR_WIDTH.min, "max": SIDEBAR_WIDTH.max, "default": SIDEBAR_WIDTH.default}
        },
    }


# ── checks of what people type ───────────────────────────────────────────────────────────────────
def clean_email(value: str) -> str:
    text_ = value.strip()
    if not text_:
        raise invalid("kit.server.emailRequired", "KIT-EMAIL")
    try:
        return validate_email(text_, check_deliverability=False).normalized
    except EmailNotValidError:
        raise invalid("kit.server.emailInvalid", "KIT-EMAIL", {"email": text_}) from None


def clean_name(value: str, what: str) -> str | None:
    text_ = value.strip()
    if len(text_) > NAME_MAX:
        raise invalid("kit.server.nameTooLong", params={"what": what, "max": NAME_MAX})
    return text_ or None


def clean_role(value: str) -> str:
    if value not in ROLES:
        raise invalid("kit.server.roleInvalid", "KIT-ROLE", {"role": value})
    return value


def same_origin_or_refuse(request: Request) -> None:
    if not same_origin(request):
        raise KitError(403, "KIT-ORIGIN", "kit.server.origin")


def launch_page(request: Request, message: str, status: int) -> HTMLResponse:
    """A launch that fails ends in the browser, not in the app: one sentence, in plain words — in the language the
    browser asks for (DEV-394; ``message`` is the key of the sentence)."""
    language = request_language(request)
    title = escape(tr(language, "kit.server.launch.pageTitle"))
    heading = escape(tr(language, "kit.server.launch.pageHeading"))
    body = f"""<!doctype html><html lang="{language}"><head><meta charset="utf-8"><title>{title}</title>
<meta name="viewport" content="width=device-width, initial-scale=1"><style>
body{{font:15px/1.5 system-ui,sans-serif;margin:0;min-height:100vh;display:flex;align-items:center;
justify-content:center;background:#0f172a;color:#e2e8f0}}
main{{max-width:28rem;padding:1.5rem;border:1px solid #334155;border-radius:.75rem;
background:#1e293b}}h1{{font-size:1rem;margin:0 0 .5rem}}p{{margin:0;color:#cbd5e1}}</style></head><body><main>
<h1>{heading}</h1><p>{escape(tr(language, message))}</p></main></body></html>"""
    return HTMLResponse(body, status_code=status)


def build_router(kit: AppKit) -> APIRouter:
    router = APIRouter()
    password_mode = kit.manifest.auth == "password"
    db_dep = Depends(kit.db)

    # ── health, release notes, getting started ─────────────────────────────────────────────────────
    @router.get("/health")
    def health(db: Db = db_dep) -> JSONResponse:
        try:
            db.execute(text("SELECT 1"))
            database = "ok"
        except Exception:  # noqa: BLE001 — a broken database is the answer, not a crash
            database = "error"
        ok = database == "ok"
        return JSONResponse(
            {"status": "ok" if ok else "error", "version": kit.version, "checks": {"database": database}},
            status_code=200 if ok else 503,
        )

    # ── whom this installation serves (DEV-377) — before the sign-in too: the window says it from the start ─────────
    @router.get("/installation")
    def installation() -> dict:
        # DEV-394: the languages the app speaks, and the installation's for whoever chose none (one of them).
        here = Installation.from_env()
        offered = list(kit.manifest.languages)
        return {
            **here.as_dict(),
            "language": here.language if here.language in offered else offered[0],
            "languages": offered,
        }

    @router.get("/installation/manifest.webmanifest")
    def installation_manifest() -> JSONResponse:
        return JSONResponse(
            Installation.from_env().web_manifest(kit.manifest.name), media_type="application/manifest+json"
        )

    # DEV-415: the notes and the guide in the person's language, when the app wrote them in it.
    @router.get("/release-notes")
    def release_notes(request: Request) -> list[dict]:
        return docs.release_notes(kit.docs_dir, request_language(request))

    @router.get("/getting-started")
    def getting_started(request: Request, _user: User = Depends(kit.current_user)) -> dict:
        return {"markdown": docs.getting_started(kit.docs_dir, request_language(request))}

    # ── own account ──────────────────────────────────────────────────────────────────────────────
    @router.get("/auth/me")
    def me(user: User = Depends(kit.signed_in)) -> dict:
        return user_read(user)

    @router.post("/auth/logout", status_code=204)
    def logout(request: Request, db: Db = db_dep) -> Response:
        same_origin_or_refuse(request)
        response = Response(status_code=204)
        kit.sessions.end(db, request, response)
        db.commit()
        return response

    if password_mode:

        @router.post("/auth/login")
        def login(body: LoginBody, request: Request, response: Response, db: Db = db_dep) -> dict:
            same_origin_or_refuse(request)
            now = kit.clock()
            user = db.scalars(select(User).where(User.username == body.username.strip())).one_or_none()
            if user is not None and user.locked_until is not None and user.locked_until > now:
                minutes = max(1, math.ceil((user.locked_until - now).total_seconds() / 60))
                raise KitError(429, "KIT-AUTH-LOCKED", "kit.server.locked", params={"minutes": minutes})
            if user is None or user.source != "local":
                verify_password(body.password, DUMMY_HASH)
                raise KitError(401, "KIT-AUTH-FAILED", "kit.server.wrongCredentials")
            if not verify_password(body.password, user.password_hash):
                user.failed_logins += 1
                if user.failed_logins >= MAX_FAILED_LOGINS:
                    user.failed_logins = 0
                    user.locked_until = now + LOCK_FOR
                db.commit()
                raise KitError(401, "KIT-AUTH-FAILED", "kit.server.wrongCredentials")
            if not user.is_active:
                raise KitError(403, "KIT-AUTH-INACTIVE", "kit.server.accountInactive")
            user.failed_logins = 0
            user.locked_until = None
            kit.sessions.start(db, user, request, response)
            db.commit()
            return user_read(user)

        @router.patch("/auth/me")
        def update_me(body: ProfileBody, user: User = Depends(kit.current_user), db: Db = db_dep) -> dict:
            user.email = clean_email(body.email)
            user.first_name = clean_name(body.first_name, "kit.server.field.firstName")
            user.last_name = clean_name(body.last_name, "kit.server.field.lastName")
            user.updated_at = kit.clock()
            db.commit()
            return user_read(user)

        def offered_language(language: str) -> str:
            """One of the app's languages (its manifest) — else the refusal says which ones it speaks."""
            offered = list(kit.manifest.languages)
            if language not in offered:
                raise invalid(
                    "kit.server.languageUnknown",
                    "KIT-LANGUAGE",
                    {"language": language, "languages": ", ".join(offered)},
                )
            return language

        @router.put("/auth/language")
        def set_language(body: LanguageBody, user: User = Depends(kit.current_user), db: Db = db_dep) -> dict:
            """DEV-394 — the person's language, one of the app's (its manifest)."""
            user.language = offered_language(body.language)
            user.updated_at = kit.clock()
            db.commit()
            return user_read(user)

        @router.post("/auth/change-password", status_code=204)
        def change_password(
            body: ChangePasswordBody, request: Request, user: User = Depends(kit.signed_in), db: Db = db_dep
        ) -> Response:
            check_new_password(body.new_password)
            # The password the person has now — the initial one from the admin above all — is not chosen again.
            if verify_password(body.new_password, user.password_hash):
                raise invalid("kit.server.passwordSame", "KIT-PASSWORD-SAME")
            user.password_hash = hash_password(body.new_password, kit.bcrypt_rounds)
            user.must_change_password = False
            user.updated_at = kit.clock()
            # The other browsers of this person sign in again with the new password; this one stays.
            kit.sessions.end_all(db, user.id, keep=request.state.kit_session, event=AccountEvent.PASSWORD_CHANGED)
            db.commit()
            return Response(status_code=204)

        # ── users (admin) ──────────────────────────────────────────────────────────────────────────
        @router.get("/users")
        def list_users(_admin: User = Depends(kit.require_admin), db: Db = db_dep) -> list[dict]:
            return [user_read(u) for u in db.scalars(select(User).order_by(User.username))]

        @router.post("/users", status_code=201)
        def create_user(body: NewUserBody, _admin: User = Depends(kit.require_admin), db: Db = db_dep) -> dict:
            username = body.username.strip()
            if not USERNAME.match(username):
                raise invalid("kit.server.usernameInvalid", "KIT-USERNAME")
            if db.scalars(select(User.id).where(User.username == username)).first() is not None:
                raise conflict("kit.server.usernameTaken", "KIT-USERNAME-TAKEN", {"username": username})
            email = clean_email(body.email)
            check_new_password(body.password)
            # DEV-415: the admin may give the person a language; without one the person follows the installation's.
            language = offered_language(body.language) if body.language is not None else None
            now = kit.clock()
            user = User(
                username=username,
                email=email,
                password_hash=hash_password(body.password, kit.bcrypt_rounds),
                role=clean_role(body.role),
                is_active=body.is_active,
                first_name=clean_name(body.first_name, "kit.server.field.firstName"),
                last_name=clean_name(body.last_name, "kit.server.field.lastName"),
                must_change_password=True,
                failed_logins=0,
                source="local",
                language=language,
                created_at=now,
                updated_at=now,
            )
            db.add(user)
            db.commit()
            return user_read(user)

        def find_user(db: Db, user_id: str) -> User:
            try:
                user = db.get(User, _uuid(user_id))
            except ValueError:
                user = None
            if user is None:
                raise not_found("kit.server.userUnknown")
            return user

        @router.patch("/users/{user_id}")
        def update_user(
            user_id: str, body: UserChangesBody, admin: User = Depends(kit.require_admin), db: Db = db_dep
        ) -> dict:
            user = find_user(db, user_id)
            role = clean_role(body.role)
            # DEV-415: the person's language, when the admin changed it — checked before anything of the person moves.
            language = offered_language(body.language) if body.language is not None else None
            # Nobody demotes, switches off or deletes themselves — so the admin doing it always stays, and the app
            # is never left without an active admin.
            if user.id == admin.id and (role != user.role or not body.is_active):
                raise conflict("kit.server.selfRole", "KIT-SELF")
            # DEV-422 — a person who has no e-mail (made before it was required, or by NEX Manager) is changed
            # without one; an e-mail given is checked as ever, and one the person has is not taken away.
            if body.email.strip() or user.email:
                user.email = clean_email(body.email)
            user.role = role
            user.first_name = clean_name(body.first_name, "kit.server.field.firstName")
            user.last_name = clean_name(body.last_name, "kit.server.field.lastName")
            switched_off = user.is_active and not body.is_active
            user.is_active = body.is_active
            if language is not None:
                user.language = language
            user.updated_at = kit.clock()
            if switched_off:
                kit.sessions.end_all(db, user.id, event=AccountEvent.DEACTIVATED)
            db.commit()
            return user_read(user)

        @router.delete("/users/{user_id}", status_code=204)
        def delete_user(user_id: str, admin: User = Depends(kit.require_admin), db: Db = db_dep) -> Response:
            user = find_user(db, user_id)
            # DEV-439 — the app's admin is never deleted, oneself included; only their details change. A person who is
            # to go is first given another role.
            if user.role == ADMIN_ROLE:
                raise conflict("kit.server.adminDelete", "KIT-ADMIN")
            kit.sessions.end_all(db, user.id, event=AccountEvent.DELETED)
            db.delete(user)
            try:
                db.commit()
            except IntegrityError:
                db.rollback()
                raise conflict("kit.server.userHasRecords", "KIT-USER-IN-USE") from None
            return Response(status_code=204)

        @router.post("/users/{user_id}/password", status_code=204)
        def set_user_password(
            user_id: str,
            body: PasswordBody,
            request: Request,
            admin: User = Depends(kit.require_admin),
            db: Db = db_dep,
        ) -> Response:
            user = find_user(db, user_id)
            check_new_password(body.new_password)
            user.password_hash = hash_password(body.new_password, kit.bcrypt_rounds)
            user.updated_at = kit.clock()
            if user.id == admin.id:
                # DEV-439 — the admin's own password set here is their regular password, as in Moje konto: no change is
                # asked of them, their other browsers sign in again, this one stays.
                user.must_change_password = False
                kit.sessions.end_all(db, user.id, keep=request.state.kit_session, event=AccountEvent.PASSWORD_CHANGED)
            else:
                # Another person's password from the admin is an initial one: they choose their own at the next sign-in.
                user.must_change_password = True
                user.failed_logins = 0
                user.locked_until = None
                kit.sessions.end_all(db, user.id, event=AccountEvent.PASSWORD_SET)
            db.commit()
            return Response(status_code=204)

    else:

        @router.get("/launch")
        def launch_get(request: Request, lt: str = "", db: Db = db_dep) -> Response:
            return launch(request, lt, db)

        @router.post("/launch")
        async def launch_post(request: Request, db: Db = db_dep) -> Response:
            return launch(request, _ticket_from_body(await request.body(), request.headers.get("content-type")), db)

        def launch(request: Request, ticket: str, db: Db) -> Response:
            link = kit.manager
            if link is None:
                return launch_page(request, "kit.server.launch.notLinked", 503)
            now = kit.clock()
            identity = None
            try:
                claims = link.verify_ticket(ticket)
                db.execute(delete(UsedLaunchToken).where(UsedLaunchToken.expires_at < now - timedelta(days=1)))
                db.add(
                    UsedLaunchToken(
                        jti=str(claims["jti"])[:64], login=str(claims["sub"]), expires_at=ticket_expiry(claims)
                    )
                )
                try:
                    db.commit()
                except IntegrityError:
                    db.rollback()
                    raise LaunchRefused("KIT-LAUNCH-USED", "kit.server.launch.used") from None
                try:
                    identity = link.lookup(str(claims["sub"]))
                except ManagerUnavailable:
                    raise LaunchRefused("KIT-MANAGER-UNAVAILABLE", "kit.server.launch.managerDown", 503) from None
                problem = admission_problem(identity)
                if problem is not None:
                    raise problem
            except LaunchRefused as refused:
                return launch_page(request, refused.message, refused.status)
            assert identity is not None
            user = db.scalars(select(User).where(User.username == identity.login)).one_or_none()
            if user is None:
                user = User(
                    username=identity.login,
                    password_hash=None,
                    must_change_password=False,
                    failed_logins=0,
                    source="manager",
                    created_at=now,
                )
                db.add(user)
            mirror_identity(user, identity, now)
            db.flush()
            response = RedirectResponse(kit.after_launch, status_code=303)
            kit.sessions.start(db, user, request, response, manager_token_version=identity.token_version)
            db.commit()
            return response

    # ── sessions ─────────────────────────────────────────────────────────────────────────────────
    @router.get("/sessions")
    def list_sessions(request: Request, user: User = Depends(kit.current_user), db: Db = db_dep) -> list[dict]:
        query = (
            select(Session, User.username).join(User, User.id == Session.user_id).order_by(Session.last_seen_at.desc())
        )
        if user.role != "admin":
            query = query.where(Session.user_id == user.id)
        current = request.state.kit_session
        return [session_read(row, username, current) for row, username in db.execute(query)]

    @router.delete("/sessions/{session_id}", status_code=204)
    def revoke_session(session_id: str, _admin: User = Depends(kit.require_admin), db: Db = db_dep) -> Response:
        try:
            row = db.get(Session, _uuid(session_id))
        except ValueError:
            row = None
        if row is None:
            raise not_found("kit.server.sessionUnknown")
        kit.sessions.revoke(db, row)
        db.commit()
        return Response(status_code=204)

    # ── system settings ──────────────────────────────────────────────────────────────────────────
    @router.get("/system-settings")
    def list_settings(request: Request, _user: User = Depends(kit.current_user), db: Db = db_dep) -> list[dict]:
        language = request_language(request)
        return [settings_said_in(language, row) for row in kit.settings.list(db)]

    @router.patch("/system-settings/{key}")
    def update_setting(
        key: str, body: SettingBody, request: Request, admin: User = Depends(kit.require_admin), db: Db = db_dep
    ) -> dict:
        row = kit.settings.update(db, key, body.value, admin)
        db.commit()
        return settings_said_in(request_language(request), row)

    # ── agents ───────────────────────────────────────────────────────────────────────────────────
    if kit.manifest.ai:
        roles = {r.id for r in kit.manifest.ai_roles}

        def agent_read(role: str, row: AgentSetting | None) -> dict:
            return {
                "role": role,
                "model": (row.model or "") if row else "",
                "effort": (row.effort or "") if row else "",
            }

        @router.get("/agent-settings")
        def list_agents(_admin: User = Depends(kit.require_admin), db: Db = db_dep) -> list[dict]:
            rows = {r.role: r for r in db.scalars(select(AgentSetting))}
            return [agent_read(r.id, rows.get(r.id)) for r in kit.manifest.ai_roles]

        @router.get("/agent-settings/models")
        def list_models(_admin: User = Depends(kit.require_admin)) -> list[dict]:
            return [{"id": family, "label": label} for family, label in MODEL_FAMILIES]

        @router.put("/agent-settings/{role}")
        def save_agent(role: str, body: AgentBody, admin: User = Depends(kit.require_admin), db: Db = db_dep) -> dict:
            if role not in roles:
                raise not_found("kit.server.agentRoleUnknown", {"role": role})
            families = [f for f, _ in MODEL_FAMILIES]
            if body.model and body.model not in families:
                raise invalid(f"Model je jeden z: {', '.join(families)} — nie „{body.model}“.", "KIT-AGENT-MODEL")
            if body.effort and body.effort not in EFFORTS:
                raise invalid(f"Úsilie je jedno z: {', '.join(EFFORTS)} — nie „{body.effort}“.", "KIT-AGENT-EFFORT")
            row = db.get(AgentSetting, role)
            if row is None:
                row = AgentSetting(role=role)
                db.add(row)
            row.model = body.model or None
            row.effort = body.effort or None
            row.updated_by = admin.id
            row.updated_at = kit.clock()
            db.commit()
            return agent_read(role, row)

    # ── layout ───────────────────────────────────────────────────────────────────────────────────
    @router.get("/user-layout")
    def get_layout(user: User = Depends(kit.current_user), db: Db = db_dep) -> dict:
        return layout_read(db.get(UserLayout, user.id))

    @router.put("/user-layout")
    def save_layout(body: LayoutBody, user: User = Depends(kit.current_user), db: Db = db_dep) -> dict:
        row = db.get(UserLayout, user.id)
        if row is None:
            row = UserLayout(user_id=user.id, sidebar_collapsed=False)
            db.add(row)
        sent = body.model_fields_set
        if "sidebar_width" in sent:
            width = body.sidebar_width
            if width is not None and not SIDEBAR_WIDTH.min <= width <= SIDEBAR_WIDTH.max:
                raise invalid(
                    "kit.server.layoutWidth", "KIT-LAYOUT", {"min": SIDEBAR_WIDTH.min, "max": SIDEBAR_WIDTH.max}
                )
            row.sidebar_width = width
        if "sidebar_collapsed" in sent and body.sidebar_collapsed is not None:
            row.sidebar_collapsed = body.sidebar_collapsed
        row.updated_at = kit.clock()
        db.commit()
        return layout_read(row)

    return router


def _uuid(value: str) -> uuid.UUID:
    return uuid.UUID(value)


def _ticket_from_body(body: bytes, content_type: str | None) -> str:
    kind = (content_type or "").split(";")[0].strip().lower()
    try:
        if kind == "application/json":
            data = json.loads(body or b"{}")
            return str(data.get("lt") or "") if isinstance(data, dict) else ""
        values = parse_qs(body.decode("utf-8"))
        return (values.get("lt") or [""])[0]
    except (ValueError, UnicodeDecodeError):
        return ""
