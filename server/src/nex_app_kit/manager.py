"""Launched from NEX Manager — the protocol of NEX Manager, as NEX Knowledge follows it.

1. NEX Manager signs a launch ticket (HS256, the app's own launch key): ``iss=nex-manager``, ``aud=<module slug>``,
   ``sub=<login>``, ``deploy=<deploy slug>``, ``purpose=module-launch``, ``jti``, ``iat``, ``exp`` (seconds).
2. The browser brings it to ``/launch`` (POST form field or query ``lt``). The ticket works once (its ``jti``).
3. The app asks NEX Manager who the person is (``GET /api/v1/identity/<login>``, headers ``X-Module-Slug`` and
   ``Authorization: Bearer <the app's key>``) and lets them in only when active, allowed to the module and without a
   pending password change. NEX Manager is asked again every 5 minutes while the session lasts.

The settings come from the environment the cockpit writes for a launched app."""

from __future__ import annotations

import os
from collections.abc import Callable, Mapping
from dataclasses import dataclass
from datetime import datetime
from urllib.parse import quote

import httpx
import jwt

ISSUER = "nex-manager"
PURPOSE = "module-launch"
#: A ticket may live at most this long (NEX Manager issues 30 s).
MAX_TICKET_SECONDS = 60
LEEWAY_SECONDS = 10
IDENTITY_TIMEOUT_SECONDS = 5.0

ENV_SIGNING_KEY = "MANAGER_LAUNCH_SIGNING_KEY"
ENV_MODULE_SLUG = "MANAGER_MODULE_SLUG"
ENV_DEPLOY_SLUG = "MANAGER_DEPLOY_SLUG"
ENV_BASE_URL = "NEX_MANAGER_BASE_URL"
ENV_API_KEY = "NEX_MANAGER_API_KEY"


@dataclass(frozen=True)
class Identity:
    login: str
    first_name: str
    last_name: str
    email: str
    role: str
    is_active: bool
    must_change_password: bool
    token_version: int
    #: ``None`` = NEX Manager did not say (an older NEX Manager) — entry is refused then.
    has_module_access: bool | None


class ManagerUnavailable(Exception):
    """NEX Manager could not be asked (down, refused the app's key, answered nonsense)."""


class LaunchRefused(Exception):
    def __init__(self, code: str, message: str, status: int = 401) -> None:
        super().__init__(message)
        self.code = code
        self.message = message
        self.status = status


class ManagerLinkError(ValueError):
    pass


IdentityLookup = Callable[[str], Identity | None]


@dataclass(frozen=True)
class ManagerLink:
    signing_key: str
    module_slug: str
    base_url: str
    api_key: str
    deploy_slug: str | None = None
    #: Who the person is — NEX Manager over HTTP unless a test gives its own.
    identity: IdentityLookup | None = None

    @classmethod
    def from_env(cls, environ: Mapping[str, str] = os.environ) -> ManagerLink:
        missing = [
            name for name in (ENV_SIGNING_KEY, ENV_MODULE_SLUG, ENV_BASE_URL, ENV_API_KEY) if not environ.get(name)
        ]
        if missing:
            raise ManagerLinkError(
                "Aplikácia sa spúšťa z NEX Managera, ale chýba prepojenie s ním — prázdne: " + ", ".join(missing) + "."
            )
        return cls(
            signing_key=environ[ENV_SIGNING_KEY],
            module_slug=environ[ENV_MODULE_SLUG],
            base_url=environ[ENV_BASE_URL].rstrip("/"),
            api_key=environ[ENV_API_KEY],
            deploy_slug=environ.get(ENV_DEPLOY_SLUG) or None,
        )

    def lookup(self, login: str) -> Identity | None:
        if self.identity is not None:
            return self.identity(login)
        return http_identity(self, login)

    def verify_ticket(self, ticket: str) -> dict:
        """The ticket's claims, or :class:`LaunchRefused` with the reason in a sentence."""
        if not ticket:
            raise LaunchRefused("KIT-LAUNCH-MISSING", "Chýba lístok na spustenie. Otvor aplikáciu z NEX Managera.", 400)
        try:
            claims = jwt.decode(
                ticket,
                self.signing_key,
                algorithms=["HS256"],
                audience=self.module_slug,
                issuer=ISSUER,
                leeway=LEEWAY_SECONDS,
                options={"require": ["exp", "iat", "jti", "sub", "iss", "aud"]},
            )
        except jwt.ExpiredSignatureError:
            raise LaunchRefused(
                "KIT-LAUNCH-EXPIRED", "Lístok na spustenie už neplatí. Otvor aplikáciu znova z NEX Managera."
            ) from None
        except jwt.PyJWTError:
            raise LaunchRefused(
                "KIT-LAUNCH-INVALID", "Lístok na spustenie nie je platný. Otvor aplikáciu znova z NEX Managera."
            ) from None
        if claims.get("purpose") != PURPOSE:
            raise LaunchRefused("KIT-LAUNCH-INVALID", "Lístok nie je na spustenie aplikácie.")
        if self.deploy_slug and claims.get("deploy") != self.deploy_slug:
            raise LaunchRefused("KIT-LAUNCH-INVALID", "Lístok vydal NEX Manager iného zákazníka.")
        if int(claims["exp"]) - int(claims["iat"]) > MAX_TICKET_SECONDS:
            raise LaunchRefused(
                "KIT-LAUNCH-INVALID", "Lístok na spustenie platí príliš dlho — taký NEX Manager nevydáva."
            )
        return claims


def ticket_expiry(claims: dict) -> datetime:
    from datetime import UTC

    return datetime.fromtimestamp(int(claims["exp"]), UTC)


def http_identity(link: ManagerLink, login: str) -> Identity | None:
    url = f"{link.base_url}/api/v1/identity/{quote(login, safe='')}"
    headers = {"X-Module-Slug": link.module_slug, "Authorization": f"Bearer {link.api_key}"}
    try:
        response = httpx.get(url, headers=headers, timeout=IDENTITY_TIMEOUT_SECONDS)
    except httpx.HTTPError as exc:
        raise ManagerUnavailable(f"NEX Manager neodpovedá ({type(exc).__name__}).") from None
    if response.status_code == 404:
        return None
    if response.status_code != 200:
        raise ManagerUnavailable(f"NEX Manager odpovedal {response.status_code}.")
    try:
        data = response.json()
        return Identity(
            login=str(data["login"]),
            first_name=str(data.get("first_name") or ""),
            last_name=str(data.get("last_name") or ""),
            email=str(data.get("email") or ""),
            role=str(data.get("role") or "user"),
            is_active=bool(data.get("is_active")),
            must_change_password=bool(data.get("must_change_password")),
            token_version=int(data.get("token_version") or 0),
            has_module_access=data.get("has_module_access"),
        )
    except (ValueError, KeyError, TypeError):
        raise ManagerUnavailable("NEX Manager poslal odpoveď, ktorej aplikácia nerozumie.") from None


def admission_problem(identity: Identity | None) -> LaunchRefused | None:
    """Why NEX Manager's person may not in — ``None`` when they may."""
    if identity is None:
        return LaunchRefused("KIT-LAUNCH-UNKNOWN", "NEX Manager túto osobu nepozná.", 403)
    if not identity.is_active:
        return LaunchRefused("KIT-LAUNCH-INACTIVE", "Tvoj účet v NEX Manageri je vypnutý.", 403)
    if identity.has_module_access is None:
        return LaunchRefused(
            "KIT-MANAGER-OUTDATED",
            "NEX Manager nepovedal, či máš k tejto aplikácii prístup — treba novšiu verziu NEX Managera.",
            503,
        )
    if not identity.has_module_access:
        return LaunchRefused("KIT-LAUNCH-NO-ACCESS", "K tejto aplikácii nemáš v NEX Manageri prístup.", 403)
    if identity.must_change_password:
        return LaunchRefused("KIT-LAUNCH-PASSWORD", "Najprv si zmeň heslo v NEX Manageri.", 403)
    return None
