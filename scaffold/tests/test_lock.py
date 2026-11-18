"""DEV-428 — the scaffold carries the frontend lock its checks pass with, and a filled app keeps every version of it.

18.11.2026 a filled app resolved its packages on the day it was founded and got Rollup 4.68.6, published that morning,
which cannot read react-dom/client.js in node:22-alpine — the frontend of every new app failed to build. Director
18.11.2026: „Súhlasím“."""

from __future__ import annotations

import json
import sys
from pathlib import Path

SCAFFOLD = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(SCAFFOLD))

import check_lock  # noqa: E402

LOCK = SCAFFOLD / "nsv-standard" / "frontend" / "package-lock.json"


def test_the_scaffold_carries_its_lock_without_the_kit_whose_version_the_project_pins():
    packages = json.loads(LOCK.read_text(encoding="utf-8"))["packages"]

    assert "node_modules/nex-app-kit" not in packages
    assert "nex-app-kit" not in packages[""].get("dependencies", {})
    assert packages["node_modules/rollup"]["version"]


def test_the_lock_is_made_for_the_scaffolds_own_packages():
    assert check_lock.out_of_step(LOCK) == []


def _lock(tmp_path: Path, name: str, versions: dict[str, str], root: dict | None = None) -> Path:
    packages = {"": root or {}} | {f"node_modules/{n}": {"version": v} for n, v in versions.items()}
    path = tmp_path / name
    path.write_text(json.dumps({"packages": packages}), encoding="utf-8")
    return path


def test_a_version_the_fill_moved_or_dropped_is_said(tmp_path):
    shipped = _lock(tmp_path, "shipped.json", {"rollup": "4.68.5", "vite": "6.4.6"})
    filled = _lock(tmp_path, "filled.json", {"rollup": "4.68.6", "nex-app-kit": "0.16.4"})

    assert check_lock.moved(shipped, filled) == ["rollup: 4.68.5 → 4.68.6", "vite: 6.4.6 → chýba"]
    assert check_lock.main([str(shipped), str(filled)]) == 1


def test_a_fill_that_only_adds_the_kit_passes(tmp_path):
    shipped = _lock(tmp_path, "shipped.json", {"rollup": "4.68.5"})
    filled = _lock(tmp_path, "filled.json", {"rollup": "4.68.5", "nex-app-kit": "0.16.4", "marked": "1.0.0"})

    assert check_lock.moved(shipped, filled) == []
    assert check_lock.main([str(shipped), str(filled)]) == 0


def test_a_package_added_to_the_scaffold_without_a_new_lock_is_said(tmp_path):
    (tmp_path / "package.json").write_text(
        json.dumps({"dependencies": {"react": "^19.0.0", "zustand": "^5.0.0", "nex-app-kit": "{{KIT_FRONTEND}}"}}),
        encoding="utf-8",
    )
    lock = _lock(tmp_path, "package-lock.json", {}, root={"dependencies": {"react": "^19.0.0"}})

    assert check_lock.out_of_step(lock) == ["zustand: ^5.0.0"]
