"""DEV-394 — the server's sentences in the person's language.

Every sentence the server says to a person has a key; per language its catalog entry (``locales/<language>.json``;
Slovak is the source of keys, every other catalog has the same keys — a test compares them). The frame's client
(nex-shared ≥ 0.37) tells the server the person's language with ``Accept-Language`` on every request, also before
anyone is signed in; a browser coming from NEX Manager sends its own. A refusal is raised with its key
(:class:`errors.KitError`) and said in that language when the answer is written — the log keeps the Slovak sentence.

DEV-415: the app's own sentences too. An app gives its catalogs to the kit (``AppKit(server_messages=…)``, read with
:func:`load_server_messages` from ``backend/app/locales/<language>.json``); their keys start ``app.``, the app's main
language is the source of keys, and a catalog that does not match it stops the app at its start — as the frame does
with the texts of the screens. A refusal the app raises with such a key is said in the person's language like the
template's own. Until 0.16.0 an app's sentence stayed in its main language and NEX Manager 1.7.0 planned a translation
of its own in its screens.
"""

from __future__ import annotations

import json
import string
from collections.abc import Mapping, Sequence
from pathlib import Path

#: The languages the template speaks — the same codes as nex-shared's ``LANGUAGES``.
LANGUAGES: tuple[str, ...] = ("sk", "hu", "en")
DEFAULT_LANGUAGE = "sk"
_LOCALES = Path(__file__).resolve().parent / "locales"
CATALOGS: dict[str, dict[str, str]] = {
    language: json.loads((_LOCALES / f"{language}.json").read_text(encoding="utf-8")) for language in LANGUAGES
}

#: DEV-415 — the app's own sentences per language (:func:`use_app_messages`), and the app's main language.
APP_CATALOGS: dict[str, dict[str, str]] = {}
APP_PREFIX = "app."
_app_main: list[str] = []

#: A value of a parameter may itself be a key (the label of a setting, the name of a field) — said in the language too.
Params = Mapping[str, object]


def use_app_messages(catalogs: Mapping[str, Mapping[str, str]], main_language: str) -> None:
    """The app's sentences the server says from now on (one app per process; a new kit replaces the previous ones)."""
    APP_CATALOGS.clear()
    APP_CATALOGS.update({language: dict(catalog) for language, catalog in catalogs.items()})
    _app_main[:] = [main_language]


def _sentence(language: str, key: str) -> str | None:
    main = _app_main[0] if _app_main else DEFAULT_LANGUAGE
    return (
        APP_CATALOGS.get(language, {}).get(key)
        or CATALOGS.get(language, {}).get(key)
        or APP_CATALOGS.get(main, {}).get(key)
        or CATALOGS[DEFAULT_LANGUAGE].get(key)
    )


def tr(language: str, key: str, params: Params | None = None) -> str:
    """The sentence of ``key`` in ``language`` (else the app's main language, else Slovak, else the key itself), its
    ``{name}`` filled in."""
    text = _sentence(language, key) or key
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
    return value in CATALOGS[DEFAULT_LANGUAGE] or any(value in catalog for catalog in APP_CATALOGS.values())


def load_server_messages(folder: Path) -> dict[str, dict[str, str]]:
    """The app's server catalogs: ``<folder>/<language>.json`` for every language that has one (none → empty)."""
    catalogs: dict[str, dict[str, str]] = {}
    if not folder.is_dir():
        return catalogs
    for file in sorted(folder.glob("*.json")):
        catalogs[file.stem] = json.loads(file.read_text(encoding="utf-8"))
    return catalogs


def _fields(text: str) -> set[str]:
    try:
        return {name for _, name, _, _ in string.Formatter().parse(text) if name}
    except ValueError:
        return {"(neplatný zápis {…})"}


def check_server_messages(catalogs: Mapping[str, Mapping[str, object]], languages: Sequence[str]) -> list[str]:
    """What is wrong with the app's server catalogs, each said in a sentence — empty when nothing is."""
    if not catalogs:
        return []
    problems: list[str] = []
    main = languages[0] if languages else DEFAULT_LANGUAGE
    for language in languages:
        if language not in catalogs:
            problems.append(
                f"Hlášky servera aplikácie nemajú katalóg jazyka „{language}“ "
                f"(jazyky aplikácie: {', '.join(languages)}).",
            )
    for language in catalogs:
        if language not in languages:
            problems.append(f"Hlášky servera aplikácie majú katalóg jazyka „{language}“, ktorým aplikácia nehovorí.")
    source = catalogs.get(main) or {}
    for key in source:
        if not str(key).startswith(APP_PREFIX):
            problems.append(f"Kľúč hlášky servera „{key}“ nezačína „{APP_PREFIX}“ — kľúče „kit.“ patria šablóne.")
    for language, catalog in catalogs.items():
        if language not in languages:
            continue
        for key in source:
            if key not in catalog:
                problems.append(f"V katalógu „{language}“ chýba hláška „{key}“.")
        for key, value in catalog.items():
            if key not in source:
                problems.append(f"Katalóg „{language}“ má hlášku „{key}“, ktorú hlavný jazyk „{main}“ nemá.")
            elif not isinstance(value, str) or not value.strip():
                problems.append(f"Hláška „{key}“ v katalógu „{language}“ je prázdna.")
            elif isinstance(source[key], str) and _fields(value) != _fields(source[key]):
                problems.append(
                    f"Hláška „{key}“ v katalógu „{language}“ má iné hodnoty v {{…}} než hlavný jazyk „{main}“."
                )
    return problems


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
