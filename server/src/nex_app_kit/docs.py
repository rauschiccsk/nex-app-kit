"""Release notes and the getting-started guide, read from the app's documents — the convention of every ICC app:

- ``<docs>/specs/versions/v<version>/RELEASE_NOTES.md`` — one file per version; dates in
  ``<docs>/specs/versions/release-dates.json`` (``{"v1.4.2": "2026-10-28"}``), else none;
- ``<docs>/AKO_ZACAT.md`` — the app's guide for a person who never saw it (the template's page Ako začať)."""

from __future__ import annotations

import json
import re
from pathlib import Path

VERSION_DIR = re.compile(r"^v(\d+(?:\.\d+)*)$")
#: The file's own version heading — the card of the frontend names the version already.
LEADING_VERSION_HEADING = re.compile(r"^\s*#{1,2}\s+v?\d+(?:\.\d+)*\b[^\n]*\n+")
HTML_COMMENT = re.compile(r"<!--.*?-->\s*", re.DOTALL)
GETTING_STARTED = "AKO_ZACAT.md"


def release_notes(docs_dir: Path | None) -> list[dict]:
    if docs_dir is None:
        return []
    root = docs_dir / "specs" / "versions"
    if not root.is_dir():
        return []
    dates = _release_dates(root / "release-dates.json")
    notes = []
    for folder in root.iterdir():
        match = VERSION_DIR.match(folder.name)
        file = folder / "RELEASE_NOTES.md"
        if not match or not file.is_file():
            continue
        text = HTML_COMMENT.sub("", file.read_text(encoding="utf-8"))
        text = LEADING_VERSION_HEADING.sub("", text, count=1).strip()
        notes.append(
            (
                tuple(int(p) for p in match.group(1).split(".")),
                {"version": folder.name, "released_at": dates.get(folder.name), "markdown": text},
            )
        )
    return [note for _, note in sorted(notes, key=lambda n: n[0], reverse=True)]


def _release_dates(file: Path) -> dict[str, str]:
    try:
        data = json.loads(file.read_text(encoding="utf-8"))
    except (FileNotFoundError, json.JSONDecodeError):
        return {}
    return {str(k): str(v) for k, v in data.items()} if isinstance(data, dict) else {}


def getting_started(docs_dir: Path | None) -> str:
    if docs_dir is None:
        return ""
    try:
        return (docs_dir / GETTING_STARTED).read_text(encoding="utf-8").strip()
    except FileNotFoundError:
        return ""
