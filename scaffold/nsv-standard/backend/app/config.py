"""The app's settings — from its environment (the .env the cockpit renders from .env.example)."""

from __future__ import annotations

import os
from pathlib import Path

from nex_app_kit.docs import newest_version

#: backend/ in the repository, /app in the image.
BASE_DIR = Path(__file__).resolve().parents[1]

DATABASE_URL = os.environ.get("DATABASE_URL", "")
#: The address the browser opens; https:// keeps the session cookie on https only.
PUBLIC_URL = os.environ.get("PUBLIC_URL", "")
#: The manifest the frontend reads too (frontend/app.manifest.json); the image copies it next to the app.
MANIFEST_PATH = Path(os.environ.get("APP_MANIFEST_PATH", str(BASE_DIR.parent / "frontend" / "app.manifest.json")))
#: docs/ of the repository — Aktualizácie (specs/versions) and Ako začať (AKO_ZACAT.md).
DOCS_DIR = Path(os.environ.get("APP_DOCS_DIR", str(BASE_DIR.parent / "docs")))
#: The version the server reports: the one the cockpit deploys (APP_VERSION), else the newest release notes — never a
#: number written in the code, which a release would have to find and change (a first PROD renames the notes to 1.0.0).
APP_VERSION = os.environ.get("APP_VERSION") or newest_version(DOCS_DIR) or "0.0.0"
