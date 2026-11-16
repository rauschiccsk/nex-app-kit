"""Release notes and the getting-started guide, read from the app's documents — the convention of every ICC app:

- ``<docs>/specs/versions/v<version>/RELEASE_NOTES.md`` — one file per version; dates in
  ``<docs>/specs/versions/release-dates.json`` (``{"v1.4.2": "2026-10-28"}``), else none;
- ``<docs>/AKO_ZACAT.md`` — the app's guide for a person who never saw it (the template's page Ako začať).

DEV-415: both are written in the app's main language; beside them a file of another language — ``RELEASE_NOTES.hu.md``,
``AKO_ZACAT.en.md`` — is what a person reading in that language gets. Where it is missing, the main file is said: a
translation that lags behind never leaves a version without its notes."""

from __future__ import annotations

import json
import re
from pathlib import Path

VERSION_DIR = re.compile(r"^v(\d+(?:\.\d+)*)$")
#: The file's own version heading — the card of the frontend names the version already.
LEADING_VERSION_HEADING = re.compile(r"^\s*#{1,2}\s+v?\d+(?:\.\d+)*\b[^\n]*\n+")
HTML_COMMENT = re.compile(r"<!--.*?-->\s*", re.DOTALL)
GETTING_STARTED = "AKO_ZACAT.md"
RELEASE_NOTES = "RELEASE_NOTES.md"
#: A language code as it stands in a file name — nothing else may reach a path.
LANGUAGE_CODE = re.compile(r"^[a-z]{2}$")


def in_language(main: Path, language: str | None) -> Path:
    """The file of ``language`` beside ``main`` (``RELEASE_NOTES.md`` → ``RELEASE_NOTES.hu.md``) when it is there, else
    ``main``."""
    if language and LANGUAGE_CODE.match(language):
        translated = main.with_name(f"{main.stem}.{language}{main.suffix}")
        if translated.is_file():
            return translated
    return main


def release_notes(docs_dir: Path | None, language: str | None = None) -> list[dict]:
    if docs_dir is None:
        return []
    root = docs_dir / "specs" / "versions"
    if not root.is_dir():
        return []
    dates = _release_dates(root / "release-dates.json")
    notes = []
    for folder in root.iterdir():
        match = VERSION_DIR.match(folder.name)
        main = folder / RELEASE_NOTES
        if not match or not main.is_file():
            continue
        text = HTML_COMMENT.sub("", in_language(main, language).read_text(encoding="utf-8"))
        text = LEADING_VERSION_HEADING.sub("", text, count=1).strip()
        notes.append(
            (
                tuple(int(p) for p in match.group(1).split(".")),
                {"version": folder.name, "released_at": dates.get(folder.name), "markdown": text},
            )
        )
    return [note for _, note in sorted(notes, key=lambda n: n[0], reverse=True)]


def newest_version(docs_dir: Path | None) -> str | None:
    """The newest version that has release notes (``v1.2.0/RELEASE_NOTES.md`` → ``"1.2.0"``) — what the app is when
    nobody says otherwise: the cockpit passes ``APP_VERSION`` on every deploy, and its notes are the record of what was
    released (a first PROD renames them to 1.0.0). ``None`` without notes."""
    if docs_dir is None:
        return None
    root = docs_dir / "specs" / "versions"
    if not root.is_dir():
        return None
    found = [
        tuple(int(p) for p in match.group(1).split("."))
        for folder in root.iterdir()
        if (match := VERSION_DIR.match(folder.name)) and (folder / "RELEASE_NOTES.md").is_file()
    ]
    return ".".join(str(p) for p in max(found)) if found else None


def _release_dates(file: Path) -> dict[str, str]:
    try:
        data = json.loads(file.read_text(encoding="utf-8"))
    except (FileNotFoundError, json.JSONDecodeError):
        return {}
    return {str(k): str(v) for k, v in data.items()} if isinstance(data, dict) else {}


def getting_started(docs_dir: Path | None, language: str | None = None) -> str:
    if docs_dir is None:
        return ""
    try:
        return in_language(docs_dir / GETTING_STARTED, language).read_text(encoding="utf-8").strip()
    except FileNotFoundError:
        return ""
