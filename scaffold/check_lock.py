#!/usr/bin/env python3
"""A filled app keeps every version of the scaffold's lock (DEV-428).

    python3 scaffold/check_lock.py <scaffold>/frontend/package-lock.json <app>/frontend/package-lock.json

The scaffold's lock carries the versions the template's checks pass with; filling adds nex-app-kit and what it brings,
and must not move anything the scaffold locked — an app founded on the morning a package broke would get it anyway.
Prints every package that moved and exits 1, or nothing and 0."""

from __future__ import annotations

import json
import sys
from pathlib import Path


def versions(path: Path) -> dict[str, str]:
    packages = json.loads(path.read_text(encoding="utf-8")).get("packages") or {}
    return {name: str(info.get("version")) for name, info in packages.items() if name and info.get("version")}


def out_of_step(lock: Path) -> list[str]:
    """The scaffold's packages (its package.json beside the lock, nex-app-kit aside) the lock does not have as stated —
    a package added or a range changed without making the lock again (``python3 scaffold/lock.py <template>``)."""
    package = json.loads((lock.parent / "package.json").read_text(encoding="utf-8"))
    root = (json.loads(lock.read_text(encoding="utf-8")).get("packages") or {}).get("") or {}
    wanted = {**package.get("dependencies", {}), **package.get("devDependencies", {})}
    wanted.pop("nex-app-kit", None)
    has = {**root.get("dependencies", {}), **root.get("devDependencies", {})}
    return sorted(f"{name}: {spec}" for name, spec in wanted.items() if has.get(name) != spec)


def moved(scaffold: Path, app: Path) -> list[str]:
    locked, filled = versions(scaffold), versions(app)
    return [
        f"{name.removeprefix('node_modules/')}: {version} → {filled.get(name, 'chýba')}"
        for name, version in sorted(locked.items())
        if filled.get(name) != version
    ]


def main(argv: list[str] | None = None) -> int:
    scaffold, app = (Path(a) for a in (argv if argv is not None else sys.argv[1:]))
    changes = moved(scaffold, app)
    for change in changes:
        print(f"Zámok kostry sa pri vyplnení zmenil — {change}")
    return 1 if changes else 0


if __name__ == "__main__":
    sys.exit(main())
