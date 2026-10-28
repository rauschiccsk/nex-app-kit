"""The template's server (nex-app-kit) for this app: sign-in, Moje konto, users, sessions, system settings, agents,
Aktualizácie, Ako začať, the person's layout. The app adds its own system settings below and reads them with
kit.settings.get_int("…"); its own routes ask for the signed-in person with Depends(kit.current_user)."""

from __future__ import annotations

from nex_app_kit import AppKit, ManagerLink, ManagerLinkError, SettingDefinition, load_manifest

from app import config
from app.db import SessionLocal

manifest = load_manifest(config.MANIFEST_PATH)

#: The app's own system settings (Nastavenia → Systém) — key, default, type, label, description, unit, bounds.
SETTINGS: list[SettingDefinition] = []


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
)
