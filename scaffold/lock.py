#!/usr/bin/env python3
"""The scaffold's frontend lock — the versions the template's checks pass with, made once per release (DEV-428).

    python3 scaffold/lock.py nsv-standard [--before 2026-11-18T08:00:00Z]

18.11.2026 a filled app resolved its packages on the day it was founded and got Rollup 4.68.6, published that morning,
which cannot read react-dom/client.js in node:22-alpine — the frontend of every new app failed to build. The scaffold
now carries frontend/package-lock.json: the scaffold's packages as of ``--before`` (npm's own option — only versions
published before that moment), without nex-app-kit itself, whose version the project pins when it is filled. Filling
keeps every locked version and adds nex-app-kit only (``npm install --package-lock-only`` over the lock, as the cockpit
does); the kit's CI checks that with check_lock.py. Standard library and npm only."""

from __future__ import annotations

import argparse
import json
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

from render import render  # noqa: E402 — the one fill the cockpit and the CI use

KIT = "nex-app-kit"
#: A project to fill the scaffold with — the lock does not depend on it (the app's name is not in the lock's packages).
SAMPLE = {
    "app_name": "NEX Zámok",
    "app_initials": "NZ",
    "slug": "nex-zamok",
    "auth": "password",
    "ai": True,
    "backend_port": 18000,
    "frontend_port": 18001,
    "db_port": 18002,
    "languages": ["sk"],
    "kit_frontend": "github:rauschiccsk/nex-app-kit#v0.0.0",
    "kit_server": "nex-app-kit @ https://github.com/rauschiccsk/nex-app-kit/archive/refs/tags/v0.0.0.tar.gz#subdirectory=server",
}


def lock(template: str, before: str | None) -> Path:
    """Write scaffold/<template>/frontend/package-lock.json and return its path."""
    with tempfile.TemporaryDirectory(prefix="nex-app-kit-lock-") as tmp:
        filled = Path(tmp) / "app"
        render(template, SAMPLE, filled)
        frontend = filled / "frontend"
        (frontend / "package-lock.json").unlink(missing_ok=True)
        package = json.loads((frontend / "package.json").read_text(encoding="utf-8"))
        package["dependencies"].pop(KIT, None)
        (frontend / "package.json").write_text(json.dumps(package, indent=2, ensure_ascii=False) + "\n", "utf-8")
        command = ["npm", "install", "--package-lock-only", "--no-audit", "--no-fund"]
        if before:
            command.append(f"--before={before}")
        subprocess.run(command, cwd=frontend, check=True)
        target = HERE / template / "frontend" / "package-lock.json"
        shutil.copyfile(frontend / "package-lock.json", target)
        return target


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("template")
    parser.add_argument("--before", help="only versions published before this moment (npm --before)")
    args = parser.parse_args(argv)
    print(lock(args.template, args.before))
    return 0


if __name__ == "__main__":
    sys.exit(main())
