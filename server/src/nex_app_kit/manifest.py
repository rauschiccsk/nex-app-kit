"""The app's manifest as the server reads it — the same file the frontend reads (``app.manifest.json``).

The server needs three facts from it: which template, how people sign in (own password or launched from NEX
Manager) and which agent roles the app runs. A wrong value stops the server before it starts, with every problem in
one sentence each — the same sentences the frontend's ``defineApp`` says (the shared cases in
``tests/manifest_cases.json`` are run by both)."""

from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Literal

#: The templates the kit knows — the same list as ``src/templates/ids.ts`` of the frontend.
TEMPLATE_IDS = ("nsv-standard",)
AUTH_MODES = ("password", "manager")

AuthMode = Literal["password", "manager"]


@dataclass(frozen=True)
class AgentRole:
    id: str
    label: str


@dataclass(frozen=True)
class Manifest:
    template: str
    name: str
    auth: AuthMode
    ai_roles: tuple[AgentRole, ...]

    @property
    def ai(self) -> bool:
        return bool(self.ai_roles)


class ManifestError(ValueError):
    def __init__(self, problems: list[str]) -> None:
        super().__init__("Manifest aplikácie nie je v poriadku:\n- " + "\n- ".join(problems))
        self.problems = problems


def _duplicates(values: list[str]) -> list[str]:
    seen: set[str] = set()
    twice: list[str] = []
    for value in values:
        if value in seen and value not in twice:
            twice.append(value)
        seen.add(value)
    return twice


def manifest_from_data(data: Any) -> Manifest:
    if not isinstance(data, dict):
        raise ManifestError(["Manifest musí byť objekt JSON."])
    problems: list[str] = []
    template = data.get("template")
    if template not in TEMPLATE_IDS:
        problems.append(f"Šablóna „{template}“ neexistuje — sú tieto: {', '.join(TEMPLATE_IDS)}.")
    name = data.get("name")
    if not isinstance(name, str) or not name.strip():
        problems.append("Chýba názov aplikácie (name).")
    auth = data.get("auth")
    if auth not in AUTH_MODES:
        problems.append(
            "Spôsob prihlásenia (auth) je „password“ (vlastné heslo) alebo „manager“ (spustenie z NEX Managera), "
            f"nie „{auth}“."
        )
    roles: list[AgentRole] = []
    ai = data.get("ai", False)
    if ai:
        raw = ai.get("roles") if isinstance(ai, dict) else None
        if not raw:
            problems.append("Aplikácia s AI (ai) menuje aspoň jednu rolu agenta.")
        else:
            roles = [AgentRole(id=str(r.get("id", "")), label=str(r.get("label", ""))) for r in raw]
            for role_id in _duplicates([r.id for r in roles]):
                problems.append(f"Rola agenta „{role_id}“ je uvedená dvakrát.")
    if problems:
        raise ManifestError(problems)
    return Manifest(template=template, name=name, auth=auth, ai_roles=tuple(roles))


def load_manifest(path: str | Path) -> Manifest:
    """Read and check ``app.manifest.json``; a missing or broken file is said in a sentence too."""
    file = Path(path)
    try:
        text = file.read_text(encoding="utf-8")
    except FileNotFoundError:
        raise ManifestError([f"Manifest aplikácie {file} neexistuje."]) from None
    try:
        data = json.loads(text)
    except json.JSONDecodeError as exc:
        raise ManifestError([f"Manifest aplikácie {file} nie je platný JSON (riadok {exc.lineno})."]) from None
    return manifest_from_data(data)
