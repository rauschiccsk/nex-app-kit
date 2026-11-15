"""DEV-394 — the server's sentences in the person's language.

Every sentence the server says to a person has a key; per language its catalog entry (``locales/<language>.json``;
Slovak is the source of keys, every other catalog has the same keys — a test compares them). The frame's client
(nex-shared ≥ 0.37) tells the server the person's language with ``Accept-Language`` on every request, also before
anyone is signed in; a browser coming from NEX Manager sends its own. A refusal is raised with its key
(:class:`errors.KitError`) and said in that language when the answer is written — the log keeps the Slovak sentence.
"""

from __future__ import annotations

import json
from collections.abc import Mapping, Sequence
from pathlib import Path

#: The languages the template speaks — the same codes as nex-shared's ``LANGUAGES``.
LANGUAGES: tuple[str, ...] = ("sk", "hu")
DEFAULT_LANGUAGE = "sk"
_LOCALES = Path(__file__).resolve().parent / "locales"
CATALOGS: dict[str, dict[str, str]] = {
    language: json.loads((_LOCALES / f"{language}.json").read_text(encoding="utf-8")) for language in LANGUAGES
}

#: A value of a parameter may itself be a key (the label of a setting, the name of a field) — said in the language too.
Params = Mapping[str, object]


def tr(language: str, key: str, params: Params | None = None) -> str:
    """The sentence of ``key`` in ``language`` (else Slovak, else the key itself), its ``{name}`` filled in."""
    text = CATALOGS.get(language, {}).get(key) or CATALOGS[DEFAULT_LANGUAGE].get(key) or key
    if not params:
        return text
    values = {
        name: tr(language, value) if isinstance(value, str) and _is_key(value) else value
        for name, value in params.items()
    }
    try:
        return text.format(**values)
    except (KeyError, IndexError, ValueError):
        return text


def _is_key(value: str) -> bool:
    return value in CATALOGS[DEFAULT_LANGUAGE]


def language_of(accept_language: str | None, offered: Sequence[str], fallback: str | None = None) -> str:
    """The first language of ``Accept-Language`` (by its weight) the app speaks; else ``fallback`` when the app speaks
    it; else the app's first language."""
    wanted: list[tuple[float, int, str]] = []
    for position, part in enumerate((accept_language or "").split(",")):
        piece = part.strip()
        if not piece:
            continue
        code, _, rest = piece.partition(";")
        weight = 1.0
        if rest.strip().startswith("q="):
            try:
                weight = float(rest.strip()[2:])
            except ValueError:
                weight = 0.0
        wanted.append((-weight, position, code.strip().lower().split("-")[0]))
    for _weight, _position, code in sorted(wanted):
        if code in offered:
            return code
    if fallback in offered:
        return str(fallback)
    return offered[0] if offered else DEFAULT_LANGUAGE
