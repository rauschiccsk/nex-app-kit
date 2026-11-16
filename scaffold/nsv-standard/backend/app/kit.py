"""The template's server (nex-app-kit) for this app: sign-in, „Moje konto“, users, sessions, system settings, agents,
„Aktualizácie“, „Ako začať“, the person's layout. The app adds its own system settings below and reads them with
kit.settings.get_int("…"); its own routes ask for the signed-in person with Depends(kit.current_user)."""

from __future__ import annotations

from pathlib import Path

from nex_app_kit import AppKit, ManagerLink, ManagerLinkError, SettingDefinition, load_manifest, load_server_messages

from app import config
from app.db import SessionLocal

manifest = load_manifest(config.MANIFEST_PATH)

#: The app's own system settings („Nastavenia → Systém“) — key, default, type, label, description, unit, bounds.
SETTINGS: list[SettingDefinition] = []

#: The app's own server sentences, one catalog per language (``locales/<language>.json``, keys ``app.…``): a refusal
#: raised as ``KitError(409, "APP-…", "app.server.…")`` is said in the person's language. The main language is the
#: source of keys; a catalog that does not match it stops the app at its start.
SERVER_MESSAGES = load_server_messages(Path(__file__).resolve().parent / "locales")


def _manager_link() -> ManagerLink | None:
    if manifest.auth != "manager":
        return None
    try:
        return ManagerLink.from_env()
    except ManagerLinkError:
        # Not paired with NEX Manager yet (the cockpit pairs it at deploy) — the app starts, the launch says so.
        return None


kit = AppKit(
    manifest=manifest,
    version=config.APP_VERSION,
    session_factory=SessionLocal,
    settings=SETTINGS,
    docs_dir=config.DOCS_DIR,
    secure_cookies=config.PUBLIC_URL.startswith("https://"),
    manager=_manager_link(),
    server_messages=SERVER_MESSAGES,
)
