"""System settings of the app: the app describes them in its code (key, default, type, label, description, unit,
bounds); the database holds only a value someone changed. Reads go through a 30-second cache — the panel Systém says
„Zmena platí najneskôr do 30 sekúnd“, and a change made here empties the cache at once."""

from __future__ import annotations

import json
import time
from collections.abc import Callable, Iterable
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Literal

from sqlalchemy import select
from sqlalchemy.orm import Session

from .errors import invalid, not_found
from .models import SystemSetting, User

ValueType = Literal["string", "int", "float", "bool"]
VALUE_TYPES = ("string", "int", "float", "bool")
TRUE = ("true", "1", "yes", "on", "áno")
FALSE = ("false", "0", "no", "off", "nie")
CACHE_SECONDS = 30.0

#: The kit's own settings start with this; an app's key may not.
KIT_PREFIX = "auth_"


@dataclass(frozen=True)
class SettingDefinition:
    key: str
    default: str
    value_type: ValueType
    label: str
    description: str
    unit: str = ""
    min: float | None = None
    max: float | None = None
    allow_empty: bool = False


#: The kit's own settings — one file, read here and by the frontend's preview answers (src/preview.ts).
KIT_SETTINGS = tuple(
    SettingDefinition(**d) for d in json.loads((Path(__file__).parent / "kit_settings.json").read_text("utf-8"))
)


def check_definitions(definitions: Iterable[SettingDefinition], *, kit: bool = False) -> list[str]:
    problems = []
    seen: set[str] = set()
    for d in definitions:
        if d.key in seen:
            problems.append(f"Systémové nastavenie „{d.key}“ je opísané dvakrát.")
        seen.add(d.key)
        if not kit and d.key.startswith(KIT_PREFIX):
            problems.append(f"Kľúč „{d.key}“ začína „{KIT_PREFIX}“ — tie patria šablóne.")
        if d.value_type not in VALUE_TYPES:
            problems.append(f"Systémové nastavenie „{d.key}“ má neznámy typ „{d.value_type}“.")
            continue
        try:
            normalize(d, d.default)
        except Exception as exc:  # noqa: BLE001 — the sentence is the point
            problems.append(f"Predvolená hodnota „{d.key}“ neprejde vlastnou kontrolou: {exc}")
    return problems


def normalize(definition: SettingDefinition, value: str) -> str:
    """The value as stored, or a sentence why not."""
    text = value.strip()
    if text == "":
        if definition.allow_empty:
            return ""
        raise invalid(f"„{definition.label}“ nesmie byť prázdne.")
    if definition.value_type == "string":
        return text
    if definition.value_type == "bool":
        low = text.lower()
        if low in TRUE:
            return "true"
        if low in FALSE:
            return "false"
        raise invalid(f"„{definition.label}“ je áno alebo nie, nie „{text}“.")
    try:
        number = int(text) if definition.value_type == "int" else float(text.replace(",", "."))
    except ValueError:
        kind = "celé číslo" if definition.value_type == "int" else "číslo"
        raise invalid(f"„{definition.label}“ musí byť {kind}, nie „{text}“.") from None
    if definition.min is not None and number < definition.min or definition.max is not None and number > definition.max:
        raise invalid(f"„{definition.label}“ musí byť od {_num(definition.min)} do {_num(definition.max)}.")
    return str(number)


def _num(value: float | None) -> str:
    if value is None:
        return "…"
    return str(int(value)) if float(value).is_integer() else str(value).replace(".", ",")


class SystemSettings:
    """The app's settings — read them through :meth:`get_int`, :meth:`get_bool`, … anywhere in the app."""

    def __init__(
        self,
        definitions: Iterable[SettingDefinition],
        session_factory: Callable[[], Session],
        clock: Callable[[], datetime],
        monotonic: Callable[[], float] = time.monotonic,
    ) -> None:
        self.definitions = {d.key: d for d in (*KIT_SETTINGS, *definitions)}
        self._session_factory = session_factory
        self._clock = clock
        self._monotonic = monotonic
        self._cache: dict[str, tuple[str, float]] = {}

    def definition(self, key: str) -> SettingDefinition:
        try:
            return self.definitions[key]
        except KeyError:
            raise not_found(f"Systémové nastavenie „{key}“ aplikácia nemá.") from None

    # ── reading, cached ──────────────────────────────────────────────────────────────────────────────
    def raw(self, key: str) -> str:
        definition = self.definition(key)
        now = self._monotonic()
        cached = self._cache.get(key)
        if cached and cached[1] > now:
            return cached[0]
        with self._session_factory() as db:
            row = db.get(SystemSetting, key)
            value = row.value if row else definition.default
        self._cache[key] = (value, now + CACHE_SECONDS)
        return value

    def get_str(self, key: str) -> str:
        return self.raw(key)

    def get_int(self, key: str) -> int:
        return int(self.raw(key))

    def get_float(self, key: str) -> float:
        return float(self.raw(key))

    def get_bool(self, key: str) -> bool:
        return self.raw(key) == "true"

    def invalidate(self, key: str | None = None) -> None:
        if key is None:
            self._cache.clear()
        else:
            self._cache.pop(key, None)

    # ── the panel Systém ───────────────────────────────────────────────────────────────────────────
    def list(self, db: Session) -> list[dict]:
        rows = {r.key: r for r in db.scalars(select(SystemSetting))}
        names = _usernames(db, [r.updated_by for r in rows.values()])
        return [self._read(d, rows.get(d.key), names) for d in sorted(self.definitions.values(), key=lambda d: d.key)]

    def update(self, db: Session, key: str, value: str, user: User) -> dict:
        definition = self.definition(key)
        stored = normalize(definition, value)
        row = db.get(SystemSetting, key)
        if row is None:
            row = SystemSetting(key=key, value=stored)
            db.add(row)
        row.value = stored
        row.updated_by = user.id
        row.updated_at = self._clock()
        db.flush()
        self.invalidate(key)
        return self._read(definition, row, {user.id: user.username})

    @staticmethod
    def _read(definition: SettingDefinition, row: SystemSetting | None, names: dict) -> dict:
        return {
            "key": definition.key,
            "value": row.value if row else definition.default,
            "value_type": definition.value_type,
            "label": definition.label,
            "description": definition.description,
            "unit": definition.unit or None,
            "updated_at": row.updated_at.isoformat() if row else None,
            "updated_by": str(row.updated_by) if row and row.updated_by else None,
            "updated_by_username": names.get(row.updated_by) if row and row.updated_by else None,
            "is_default": row is None,
        }


def _usernames(db: Session, ids: list) -> dict:
    wanted = {i for i in ids if i}
    if not wanted:
        return {}
    return {u.id: u.username for u in db.scalars(select(User).where(User.id.in_(wanted)))}
