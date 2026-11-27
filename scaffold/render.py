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

#: DEV-394 — values the cockpit may give: the languages the app speaks, its main one first (none: Slovak only).
#: DEV-523 — ``web`` (true: the app has a web, ``web/``, beside its administration) and its ``web_port``.
OPTIONAL_KEYS = ("languages", "web", "web_port")
#: The languages the template speaks (nex-shared's ``LANGUAGES``, the server's ``i18n.LANGUAGES``).
KNOWN_LANGUAGES = ("sk", "hu", "en")
#: DEV-523 — the web's own texts — its first page — in every language the template speaks.
WEB_STARTER_TEXTS = {
    "sk": {"app.web.home.title": "Vitajte", "app.web.home.preparing": "Ste prihlásený ako {email}. Web sa pripravuje."},
    "hu": {"app.web.home.title": "Üdvözöljük", "app.web.home.preparing": "Bejelentkezve mint {email}. A web készül."},
    "en": {
        "app.web.home.title": "Welcome",
        "app.web.home.preparing": "You are signed in as {email}. The web is being prepared.",
    },
}
#: DEV-523 — the folder the web is built from: the filled frontend, minus .remove, with these files over it.
WEB_OVERLAY = "web-overlay"
#: DEV-523 — the web's service; the cockpit routes it to the app's main address and the administration to „-admin“.
WEB_SERVICE = """
  web:
    build:
      context: ./web
      dockerfile: Dockerfile
      args:
        VITE_APP_VERSION: ${VITE_APP_VERSION:-0.0.0-dev}
    restart: unless-stopped
    ports:
      - "{port}:80"
    depends_on:
      - backend
"""

#: The scaffold's own texts — its overview — in every language the template speaks; the app's catalogs start with them.
STARTER_TEXTS = {
    "sk": {"app.overview.preparing": "Prehľad aplikácie sa pripravuje."},
    "hu": {"app.overview.preparing": "Az alkalmazás áttekintése készül."},
    "en": {"app.overview.preparing": "The app's overview is being prepared."},
}

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
    problems += [f"Hodnotu „{k}“ kostra nepozná." for k in values if k not in KEYS + OPTIONAL_KEYS]
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
    web = values.get("web", False)
    if not isinstance(web, bool):
        problems.append("Web (web) je true alebo false.")
    elif web:
        if values["auth"] != "password":
            problems.append("Web má len aplikácia s vlastným heslom (auth „password“) — web sa prihlasuje e-mailom.")
        if not isinstance(values.get("web_port"), int) or not 1 <= values["web_port"] <= 65535:
            problems.append("Port webu „web_port“ musí byť číslo od 1 do 65535.")
    languages = values.get("languages", ["sk"])
    if not isinstance(languages, list) or not languages:
        problems.append("Jazyky (languages) sú neprázdny zoznam, hlavný prvý.")
    else:
        problems += [
            f"Jazyk „{c}“ šablóna nepozná — pozná tieto: {', '.join(KNOWN_LANGUAGES)}."
            for c in languages
            if c not in KNOWN_LANGUAGES
        ]
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
    if values.get("languages", ["sk"]) != ["sk"]:
        data["languages"] = list(values["languages"])
    if values.get("web"):
        data["web"] = True
    return data


def catalogs(values: dict, texts: dict[str, dict[str, str]] | None = None) -> dict[str, str]:
    """DEV-394 — the app's own catalogs (``frontend/src/locales``): one per language, typed against the main one, and
    the index the manifest takes them from."""
    languages = list(values.get("languages", ["sk"]))
    main = languages[0]
    files: dict[str, str] = {}
    for code in languages:
        entries = "".join(
            f'  "{key}": {json.dumps(text, ensure_ascii=False)},\n'
            for key, text in (texts or STARTER_TEXTS)[code].items()
        )
        if code == main:
            files[f"{code}.ts"] = (
                "// The app's own texts in its main language — the source of every key; every other catalog is typed\n"
                "// against it, so a missing translation does not compile (DEV-394).\n"
                'import type { Message } from "nex-shared";\n\n'
                f"export const {code} = {{\n{entries}}} satisfies Record<string, Message>;\n\n"
                f"export type AppMessageKey = keyof typeof {code};\n"
            )
        else:
            files[f"{code}.ts"] = (
                f"// The app's own texts — typed against the main catalog ({main}.ts).\n"
                'import type { Message } from "nex-shared";\n\n'
                f'import type {{ AppMessageKey }} from "./{main}";\n\n'
                f"export const {code}: Record<AppMessageKey, Message> = {{\n{entries}}};\n"
            )
    imports = "".join(f'import {{ {code} }} from "./{code}";\n' for code in languages)
    files["index.ts"] = (
        "// The app's own texts per language — the manifest takes them (app.ts); the frame says them in the person's\n"
        "// language (DEV-394).\n"
        'import type { AppMessages } from "nex-shared";\n\n'
        f"{imports}\n"
        f"export const messages: AppMessages = {{ {', '.join(languages)} }};\n"
    )
    return files


#: DEV-460: an app with AI calls Claude through the subscription — Claude Code in its server image
#: (``nex_app_kit.claude``). Node.js comes first: it seldom changes and its layer stays.
CLAUDE_CODE_INSTALL = """# DEV-460: Claude through the subscription (Claude Code, the yearly code), never an API key.
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates curl \\
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \\
    && apt-get install -y --no-install-recommends nodejs \\
    && rm -rf /var/lib/apt/lists/*
"""
#: DEV-490: Claude Code itself after the app's code and documents — a new version of the app (or any change of its
#: code) builds this layer again and takes the newest Claude Code. Installed first, its layer stayed in the build
#: cache: 22.11.2026 Orthodox Hermenia, built the day before, still ran Claude Code 2.1.197 from early November —
#: „opus“ was Opus 4.8 and „fable“ unknown. The families resolve to the newest models only with a current Claude Code.
CLAUDE_CODE_LATEST = """# DEV-490: the newest Claude Code with every new version of the app.
RUN npm install -g @anthropic-ai/claude-code@latest && claude --version
"""


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
        "{{CLAUDE_CODE_INSTALL}}": CLAUDE_CODE_INSTALL if values["ai"] else "",
        "{{CLAUDE_CODE_LATEST}}": CLAUDE_CODE_LATEST if values["ai"] else "",
        "{{WEB_SERVICE}}": WEB_SERVICE.replace("{port}", str(values["web_port"])) if values.get("web") else "",
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
        if relative.parts[0] in ("env", WEB_OVERLAY):
            continue
        out = target / relative
        out.parent.mkdir(parents=True, exist_ok=True)
        text = fill(path.read_text(encoding="utf-8"), subs)
        left += [f"{relative}: {m}" for m in PLACEHOLDER.findall(text)]
        out.write_text(text, encoding="utf-8")
        written.append(out)
    block = fill((source / "env" / f"{values['auth']}.env").read_text(encoding="utf-8"), subs)
    if values["ai"]:  # DEV-460: the yearly code of the Claude subscription — the customer secret of an app with AI
        block += fill((source / "env" / "ai.env").read_text(encoding="utf-8"), subs)
    left += [f"env/{values['auth']}.env: {m}" for m in PLACEHOLDER.findall(block)]
    if left:
        raise ScaffoldError([f"Nevyplnené miesto v kostre — {x}" for x in left])
    (target / "frontend").mkdir(parents=True, exist_ok=True)
    (target / "frontend" / "app.manifest.json").write_text(
        json.dumps(manifest(values), ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    locales = target / "frontend" / "src" / "locales"
    locales.mkdir(parents=True, exist_ok=True)
    for name, text in catalogs(values).items():
        (locales / name).write_text(text, encoding="utf-8")
        written.append(locales / name)
    # DEV-415: the server's own sentences — one catalog per language, empty until the app says something of its own.
    server_locales = target / "backend" / "app" / "locales"
    server_locales.mkdir(parents=True, exist_ok=True)
    for code in values.get("languages", ["sk"]):
        (server_locales / f"{code}.json").write_text("{}\n", encoding="utf-8")
        written.append(server_locales / f"{code}.json")
    if values.get("web"):
        written += render_web(source, values, subs, target)
    (target / ".env.example.template-block").write_text(block, encoding="utf-8")
    return written


def render_web(source: Path, values: dict, subs: dict[str, str], target: Path) -> list[Path]:
    """DEV-523 — the web (``web/``): the filled frontend, minus the files ``web-overlay/.remove`` lists, with the web's
    own files over it; its manifest (the same app, with a web) and its own catalogs."""
    overlay = source / WEB_OVERLAY
    web = target / "web"
    if web.exists():
        shutil.rmtree(web)
    shutil.copytree(target / "frontend", web, ignore=shutil.ignore_patterns("node_modules", "dist"))
    for line in (overlay / ".remove").read_text(encoding="utf-8").splitlines():
        if line.strip():
            (web / line.strip()).unlink(missing_ok=True)
    written: list[Path] = []
    left: list[str] = []
    for path in sorted(p for p in overlay.rglob("*") if p.is_file() and p.name != ".remove"):
        out = web / path.relative_to(overlay)
        out.parent.mkdir(parents=True, exist_ok=True)
        text = fill(path.read_text(encoding="utf-8"), subs)
        left += [f"{WEB_OVERLAY}/{path.relative_to(overlay)}: {m}" for m in PLACEHOLDER.findall(text)]
        out.write_text(text, encoding="utf-8")
        written.append(out)
    if left:
        raise ScaffoldError([f"Nevyplnené miesto v kostre — {x}" for x in left])
    (web / "app.manifest.json").write_text(
        json.dumps(manifest(values), ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    locales = web / "src" / "locales"
    shutil.rmtree(locales, ignore_errors=True)
    locales.mkdir(parents=True)
    for name, text in catalogs(values, WEB_STARTER_TEXTS).items():
        (locales / name).write_text(text, encoding="utf-8")
        written.append(locales / name)
    return written + [web / "app.manifest.json"]


def apply(template: str, values: dict, project: Path) -> None:
    """Over a project init.sh founded: its frontend skeleton goes, the template's frame comes."""
    staging = project / ".nex-app-kit-scaffold"
    if staging.exists():
        shutil.rmtree(staging)
    try:
        render(template, values, staging)
        if (project / "frontend").exists():
            shutil.rmtree(project / "frontend")
        for item in (
            "frontend",
            "backend",
            "docker-compose.yml",
            "docs/AKO_ZACAT.md",
            *(("web",) if values.get("web") else ()),
        ):
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


def add_web(template: str, values: dict, project: Path) -> None:
    """DEV-523 — give a project already on the template its web (``web/``): the web as a new app would have it, the
    manifest of the administration says the app has a web, docker-compose.yml gets the web's service. Nothing else of
    the project changes — its frontend, backend and documents stay as they are."""
    if (project / "web").exists():
        raise ScaffoldError(["Projekt už má priečinok web/ — webový frontend sa nepridá druhý raz."])
    staging = project / ".nex-app-kit-scaffold"
    if staging.exists():
        shutil.rmtree(staging)
    try:
        render(template, {**values, "web": True}, staging)
        shutil.move(str(staging / "web"), str(project / "web"))
        manifest_path = project / "frontend" / "app.manifest.json"
        data = json.loads(manifest_path.read_text(encoding="utf-8"))
        data["web"] = True
        manifest_path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        compose = project / "docker-compose.yml"
        text = compose.read_text(encoding="utf-8")
        if "\n  web:\n" not in text:
            block = WEB_SERVICE.replace("{port}", str(values["web_port"]))
            for anchor in ("\n  test:\n", "\nvolumes:\n"):
                if anchor in text:
                    text = text.replace(anchor, block + anchor, 1)
                    break
            else:
                text = text.rstrip("\n") + "\n" + block
            compose.write_text(text, encoding="utf-8")
    finally:
        shutil.rmtree(staging, ignore_errors=True)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Fill a template's scaffold for one project.")
    parser.add_argument("template")
    parser.add_argument("--values", required=True, type=Path)
    where = parser.add_mutually_exclusive_group(required=True)
    where.add_argument("--into", type=Path, help="a project init.sh founded")
    where.add_argument("--out", type=Path, help="an empty directory")
    parser.add_argument("--add-web", action="store_true", help="with --into: give a project on the template its web")
    args = parser.parse_args(argv)
    values = json.loads(args.values.read_text(encoding="utf-8"))
    try:
        if args.into and args.add_web:
            add_web(args.template, values, args.into)
        elif args.into:
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
