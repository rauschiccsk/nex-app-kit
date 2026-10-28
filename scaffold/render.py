#!/usr/bin/env python3
"""Fill a template's scaffold for one project — the one tool the cockpit and the kit's CI both use (DEV-253).

    python3 render.py nsv-standard --values values.json --into <project>     # over a project init.sh founded
    python3 render.py nsv-standard --values values.json --out <empty dir>    # a fresh tree (the kit's CI)

values.json (every key required, nothing else allowed):
    app_name      "NEX Knowledge"
    app_initials  "NK"                 1–4 characters
    slug          "nex-knowledge"      the project's slug
    auth          "password" | "manager"
    ai            true | false         an agent role „assistant“ to start with; the app renames or adds roles later
    backend_port, frontend_port, db_port   integers
    kit_frontend  npm spec of nex-app-kit, e.g. "github:rauschiccsk/nex-app-kit#v0.3.0"
    kit_server    pip requirement of its server, e.g.
                  "nex-app-kit @ https://github.com/rauschiccsk/nex-app-kit/archive/refs/tags/v0.3.0.tar.gz#subdirectory=server"

--into replaces frontend/ (init.sh's skeleton), writes backend/, docker-compose.yml, docs/AKO_ZACAT.md and appends the
template's block to .env.example. It refuses when a value is wrong or a placeholder would stay unfilled — a sentence
for each. Standard library only: the cockpit runs it with its own Python."""

from __future__ import annotations

import argparse
import json
import re
import shutil
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
PLACEHOLDER = re.compile(r"\{\{[A-Z_]+\}\}")
SLUG = re.compile(r"^[a-z][a-z0-9-]*[a-z0-9]$")
KEYS = (
    "app_name",
    "app_initials",
    "slug",
    "auth",
    "ai",
    "backend_port",
    "frontend_port",
    "db_port",
    "kit_frontend",
    "kit_server",
)
#: Files copied as they are (binary or meant to keep their braces).
VERBATIM: tuple[str, ...] = ()

AUTH_ENV = {
    "password": "  ADMIN_INITIAL_PASSWORD: ${ADMIN_INITIAL_PASSWORD:-}",
    "manager": "\n".join(
        [
            "  NEX_MANAGER_BASE_URL: ${NEX_MANAGER_BASE_URL:-}",
            "  NEX_MANAGER_API_KEY: ${NEX_MANAGER_API_KEY:-}",
            "  MANAGER_LAUNCH_SIGNING_KEY: ${MANAGER_LAUNCH_SIGNING_KEY:-}",
            "  MANAGER_MODULE_SLUG: ${MANAGER_MODULE_SLUG:-{{SLUG}}}",
            "  MANAGER_DEPLOY_SLUG: ${MANAGER_DEPLOY_SLUG:-}",
        ]
    ),
}


class ScaffoldError(ValueError):
    def __init__(self, problems: list[str]) -> None:
        super().__init__("Kostru šablóny nejde vyplniť:\n- " + "\n- ".join(problems))
        self.problems = problems


def check(values: dict) -> list[str]:
    problems = [f"Chýba hodnota „{k}“." for k in KEYS if k not in values]
    problems += [f"Hodnotu „{k}“ kostra nepozná." for k in values if k not in KEYS]
    if problems:
        return problems
    if not str(values["app_name"]).strip():
        problems.append("Názov aplikácie je prázdny.")
    if not 1 <= len(str(values["app_initials"])) <= 4:
        problems.append(
            f"Iniciály majú 1 až 4 znaky — „{values['app_initials']}“ má {len(str(values['app_initials']))}."
        )
    if not SLUG.match(str(values["slug"])):
        problems.append(f"Slug „{values['slug']}“ nemá tvar malé písmená, číslice a pomlčky.")
    if values["auth"] not in AUTH_ENV:
        problems.append(f"Prihlásenie je „password“ alebo „manager“, nie „{values['auth']}“.")
    if not isinstance(values["ai"], bool):
        problems.append("AI je true alebo false.")
    for key in ("backend_port", "frontend_port", "db_port"):
        if not isinstance(values[key], int) or not 1 <= values[key] <= 65535:
            problems.append(f"Port „{key}“ musí byť číslo od 1 do 65535.")
    return problems


def manifest(values: dict) -> dict:
    data: dict = {
        "template": "nsv-standard",
        "name": values["app_name"],
        "initials": values["app_initials"],
        "auth": values["auth"],
    }
    if values["ai"]:
        data["ai"] = {"roles": [{"id": "assistant", "label": "Asistent"}]}
    data["nav"] = []
    data["settings"] = {"categories": []}
    return data


def substitutions(values: dict) -> dict[str, str]:
    return {
        "{{BACKEND_AUTH_ENV}}": AUTH_ENV[values["auth"]],
        "{{APP_NAME}}": values["app_name"],
        "{{APP_INITIALS}}": values["app_initials"],
        "{{SLUG}}": values["slug"],
        "{{DB_NAME}}": values["slug"].replace("-", "_"),
        "{{BACKEND_PORT}}": str(values["backend_port"]),
        "{{FRONTEND_PORT}}": str(values["frontend_port"]),
        "{{DB_PORT}}": str(values["db_port"]),
        "{{KIT_FRONTEND}}": values["kit_frontend"],
        "{{KIT_SERVER}}": values["kit_server"],
    }


def fill(text: str, subs: dict[str, str]) -> str:
    for key, value in subs.items():  # BACKEND_AUTH_ENV first: it carries {{SLUG}} itself
        text = text.replace(key, value)
    return text


def render(template: str, values: dict, target: Path) -> list[Path]:
    """Write the filled scaffold into target (frontend/, backend/, docker-compose.yml, docs/AKO_ZACAT.md) and return
    the path of the .env.example block, written as target/.env.example.template-block."""
    source = HERE / template
    if not source.is_dir():
        raise ScaffoldError([f"Šablóna „{template}“ nemá kostru (scaffold/{template})."])
    problems = check(values)
    if problems:
        raise ScaffoldError(problems)
    subs = substitutions(values)
    written: list[Path] = []
    left: list[str] = []
    for path in sorted(p for p in source.rglob("*") if p.is_file()):
        relative = path.relative_to(source)
        if relative.parts[0] == "env":
            continue
        out = target / relative
        out.parent.mkdir(parents=True, exist_ok=True)
        text = fill(path.read_text(encoding="utf-8"), subs)
        left += [f"{relative}: {m}" for m in PLACEHOLDER.findall(text)]
        out.write_text(text, encoding="utf-8")
        written.append(out)
    block = fill((source / "env" / f"{values['auth']}.env").read_text(encoding="utf-8"), subs)
    left += [f"env/{values['auth']}.env: {m}" for m in PLACEHOLDER.findall(block)]
    if left:
        raise ScaffoldError([f"Nevyplnené miesto v kostre — {x}" for x in left])
    (target / "frontend").mkdir(parents=True, exist_ok=True)
    (target / "frontend" / "app.manifest.json").write_text(
        json.dumps(manifest(values), ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    (target / ".env.example.template-block").write_text(block, encoding="utf-8")
    return written


def apply(template: str, values: dict, project: Path) -> None:
    """Over a project init.sh founded: its frontend skeleton goes, the template's frame comes."""
    staging = project / ".nex-app-kit-scaffold"
    if staging.exists():
        shutil.rmtree(staging)
    try:
        render(template, values, staging)
        if (project / "frontend").exists():
            shutil.rmtree(project / "frontend")
        for item in ("frontend", "backend", "docker-compose.yml", "docs/AKO_ZACAT.md"):
            src = staging / item
            dst = project / item
            dst.parent.mkdir(parents=True, exist_ok=True)
            if dst.exists() and dst.is_dir():
                shutil.rmtree(dst)
            shutil.move(str(src), str(dst))
        block = (staging / ".env.example.template-block").read_text(encoding="utf-8")
        env_example = project / ".env.example"
        current = env_example.read_text(encoding="utf-8") if env_example.exists() else ""
        env_example.write_text(current.rstrip("\n") + "\n" + block, encoding="utf-8")
    finally:
        shutil.rmtree(staging, ignore_errors=True)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Fill a template's scaffold for one project.")
    parser.add_argument("template")
    parser.add_argument("--values", required=True, type=Path)
    where = parser.add_mutually_exclusive_group(required=True)
    where.add_argument("--into", type=Path, help="a project init.sh founded")
    where.add_argument("--out", type=Path, help="an empty directory")
    args = parser.parse_args(argv)
    values = json.loads(args.values.read_text(encoding="utf-8"))
    try:
        if args.into:
            apply(args.template, values, args.into)
        else:
            args.out.mkdir(parents=True, exist_ok=True)
            render(args.template, values, args.out)
    except ScaffoldError as exc:
        print(str(exc), file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
