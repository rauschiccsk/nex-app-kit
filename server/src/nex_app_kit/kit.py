"""AppKit — the template's server in one object. An app on the template creates it once and mounts it:

    kit = AppKit(
        manifest=load_manifest(BASE_DIR / "app.manifest.json"),
        version=settings.app_version,
        session_factory=SessionLocal,
        settings=[SettingDefinition(key="search_limit", default="20", value_type="int", label="Počet výsledkov",
                                    description="Koľko výsledkov ukáže hľadanie.", min=1, max=100)],
        docs_dir=BASE_DIR / "docs",
        manager=ManagerLink.from_env() if manifest.auth == "manager" else None,
    )
    kit.install(app)                     # the standard interface under /api/v1
    kit.upgrade_database(engine)         # the kit's own tables, before the app's migrations
    kit.bootstrap_admin(os.environ.get("ADMIN_INITIAL_PASSWORD"))   # own password: the first admin

The app's own routes ask for the signed-in person with ``Depends(kit.current_user)`` (or ``kit.require_admin``)
and read its settings with ``kit.settings.get_int("search_limit")``."""

from __future__ import annotations

import logging
from collections.abc import Callable, Iterable, Iterator
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path

from fastapi import Depends, FastAPI, Request
from sqlalchemy import select
from sqlalchemy.engine import Connection, Engine
from sqlalchemy.orm import Session as Db

from .errors import KitError, forbidden, kit_error_handler, not_signed_in
from .manager import ManagerLink
from .manifest import Manifest
from .migrate import upgrade_database
from .models import AgentSetting, User
from .passwords import hash_password
from .sessions import SAFE_METHODS, Sessions, same_origin
from .system_settings import SettingDefinition, SystemSettings, check_definitions

logger = logging.getLogger("nex_app_kit")

ADMIN_USERNAME = "admin"
ADMIN_ROLE = "admin"


@dataclass(frozen=True)
class AgentChoice:
    """What an agent role runs with; ``None`` = the app's own default."""

    model: str | None
    effort: str | None


def _utcnow() -> datetime:
    return datetime.now(UTC)


class AppKit:
    def __init__(
        self,
        *,
        manifest: Manifest,
        version: str,
        session_factory: Callable[[], Db],
        settings: Iterable[SettingDefinition] = (),
        docs_dir: Path | None = None,
        secure_cookies: bool = True,
        manager: ManagerLink | None = None,
        clock: Callable[[], datetime] = _utcnow,
        bcrypt_rounds: int = 12,
        after_launch: str = "/",
    ) -> None:
        definitions = list(settings)
        problems = check_definitions(definitions)
        if manifest.auth == "password" and manager is not None:
            problems.append(
                "Aplikácia má vlastné heslo (auth: password), prepojenie s NEX Managerom (manager) nepatrí k nej."
            )
        if problems:
            raise ValueError("AppKit nie je nastavený správne:\n- " + "\n- ".join(problems))
        if manifest.auth == "manager" and manager is None:
            # The first deploy of a launched app often comes before its NEX Manager is paired (the cockpit says so as
            # a warning). The app starts; the launch says the pairing is missing.
            logger.warning("Launched from NEX Manager, but not paired with it: the launch answers 503")
        self.manifest = manifest
        self.version = version
        self.docs_dir = docs_dir
        self.manager = manager
        self.clock = clock
        self.bcrypt_rounds = bcrypt_rounds
        self.after_launch = after_launch
        self._session_factory = session_factory
        self.settings = SystemSettings(definitions, session_factory, clock)
        self.sessions = Sessions(self.settings, clock, secure_cookies, manager)

        def db() -> Iterator[Db]:
            session = session_factory()
            try:
                yield session
                session.commit()
            except Exception:
                session.rollback()
                raise
            finally:
                session.close()

        def signed_in(request: Request, session: Db = Depends(db)) -> User:
            return self._signed_in(request, session, password_change_allowed=True)

        def current_user(request: Request, session: Db = Depends(db)) -> User:
            return self._signed_in(request, session, password_change_allowed=False)

        def require_admin(user: User = Depends(current_user)) -> User:
            if user.role != ADMIN_ROLE:
                raise forbidden("Toto smie len správca aplikácie.")
            return user

        #: The database session of a request; committed when the request succeeds.
        self.db = db
        #: Signed in — also while a password change is still due (Moje konto, the password form, logout).
        self.signed_in = signed_in
        #: Signed in and nothing due — every other route, the app's own included.
        self.current_user = current_user
        self.require_admin = require_admin

        from .routes import build_router

        self.router = build_router(self)

    # ── who is asking ──────────────────────────────────────────────────────────────────────────────
    def _signed_in(self, request: Request, db: Db, *, password_change_allowed: bool) -> User:
        found = self.sessions.resolve(db, request)
        if found is None:
            if self.manifest.auth == "manager":
                raise not_signed_in("Prihlásenie vypršalo. Aplikáciu otvor znova z NEX Managera.")
            raise not_signed_in("Nie si prihlásený.")
        session, user = found
        if request.method not in SAFE_METHODS and not same_origin(request):
            raise KitError(403, "KIT-ORIGIN", "Požiadavka neprišla z tejto aplikácie — odmietnutá.")
        if user.must_change_password and not password_change_allowed:
            raise KitError(403, "KIT-PASSWORD-CHANGE", "Najprv si zmeň heslo.")
        request.state.kit_session = session
        return user

    # ── mounting and start ─────────────────────────────────────────────────────────────────────────
    def install(self, app: FastAPI, prefix: str = "/api/v1") -> None:
        app.include_router(self.router, prefix=prefix)
        app.add_exception_handler(KitError, kit_error_handler)
        # The same health answer at /health too — the cockpit's probes and the Docker healthcheck ask there.
        health = next(r for r in self.router.routes if getattr(r, "path", None) == "/health")
        app.add_api_route("/health", health.endpoint, methods=["GET"], include_in_schema=False)

    def upgrade_database(self, bind: Engine | Connection) -> None:
        """Create or bring up to date the kit's own tables (its own record ``kit_alembic_version``)."""
        upgrade_database(bind)

    def bootstrap_admin(self, initial_password: str | None) -> bool:
        """Own password: the first admin, ``admin`` with the initial password and a password change due at the first
        sign-in. Nothing happens when the admin exists (the password is never overwritten) or no password is given."""
        if self.manifest.auth != "password":
            return False
        if not initial_password:
            logger.info("Admin bootstrap skipped: no initial password")
            return False
        with self._session_factory() as db:
            if db.scalars(select(User).where(User.username == ADMIN_USERNAME)).first() is not None:
                return False
            now = self.clock()
            db.add(
                User(
                    username=ADMIN_USERNAME,
                    password_hash=hash_password(initial_password, self.bcrypt_rounds),
                    role=ADMIN_ROLE,
                    is_active=True,
                    must_change_password=True,
                    failed_logins=0,
                    source="local",
                    created_at=now,
                    updated_at=now,
                )
            )
            db.commit()
        return True

    # ── for the app's own code ─────────────────────────────────────────────────────────────────────
    def agent_choice(self, role: str) -> AgentChoice:
        if role not in {r.id for r in self.manifest.ai_roles}:
            raise ValueError(f"Rola agenta „{role}“ nie je v manifeste.")
        with self._session_factory() as db:
            row = db.get(AgentSetting, role)
        return AgentChoice(model=(row.model or None) if row else None, effort=(row.effort or None) if row else None)
