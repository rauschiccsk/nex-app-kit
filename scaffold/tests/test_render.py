"""DEV-253 — the scaffold of a template, filled for one project: what the cockpit writes when it founds a project on
the template. The values are checked with a sentence each, nothing stays unfilled, and over a project init.sh founded
the template's frame replaces init.sh's frontend and adds the server, compose, the guide and its settings."""

from __future__ import annotations

import json
import sys
from pathlib import Path

import pytest

SCAFFOLD = Path(__file__).resolve().parents[1]
REPO = SCAFFOLD.parent
sys.path.insert(0, str(SCAFFOLD))

import render  # noqa: E402

VALUES = {
    "app_name": "NEX Skúška",
    "app_initials": "NS",
    "slug": "nex-skuska",
    "auth": "password",
    "ai": True,
    "backend_port": 18000,
    "frontend_port": 18001,
    "db_port": 18002,
    "kit_frontend": "github:rauschiccsk/nex-app-kit#v0.3.0",
    "kit_server": "nex-app-kit @ https://github.com/rauschiccsk/nex-app-kit/archive/refs/tags/v0.3.0.tar.gz#subdirectory=server",
}


def test_every_file_is_filled_and_the_manifest_says_what_was_chosen(tmp_path):
    render.render("nsv-standard", VALUES, tmp_path)

    for path in tmp_path.rglob("*"):
        if path.is_file():
            assert not render.PLACEHOLDER.search(path.read_text("utf-8")), path
    assert json.loads((tmp_path / "frontend" / "app.manifest.json").read_text("utf-8")) == {
        "template": "nsv-standard",
        "name": "NEX Skúška",
        "initials": "NS",
        "auth": "password",
        "ai": {"roles": [{"id": "assistant", "label": "Asistent"}]},
        "nav": [],
        "settings": {"categories": []},
    }
    compose = (tmp_path / "docker-compose.yml").read_text("utf-8")
    assert '"18000:8000"' in compose and '"18001:80"' in compose and '"127.0.0.1:18002:5432"' in compose
    assert "POSTGRES_DB: nex_skuska" in compose
    assert "ADMIN_INITIAL_PASSWORD" in compose and "MANAGER_LAUNCH_SIGNING_KEY" not in compose
    assert '"nex-app-kit": "github:rauschiccsk/nex-app-kit#v0.3.0"' in (tmp_path / "frontend/package.json").read_text(
        "utf-8"
    )
    assert VALUES["kit_server"] in (tmp_path / "backend/pyproject.toml").read_text("utf-8")


def test_an_app_launched_from_nex_manager_gets_its_pairing_and_no_admin_password(tmp_path):
    render.render("nsv-standard", {**VALUES, "auth": "manager", "ai": False}, tmp_path)

    manifest = json.loads((tmp_path / "frontend" / "app.manifest.json").read_text("utf-8"))
    compose = (tmp_path / "docker-compose.yml").read_text("utf-8")
    block = (tmp_path / ".env.example.template-block").read_text("utf-8")
    assert manifest["auth"] == "manager" and "ai" not in manifest
    assert "MANAGER_MODULE_SLUG: ${MANAGER_MODULE_SLUG:-nex-skuska}" in compose
    assert "ADMIN_INITIAL_PASSWORD" not in compose and "ADMIN_INITIAL_PASSWORD" not in block
    assert "MANAGER_MODULE_SLUG=nex-skuska" in block


@pytest.mark.parametrize(
    "changes,problem",
    [
        ({"app_initials": "NEXSK"}, "Iniciály majú 1 až 4 znaky — „NEXSK“ má 5."),
        ({"slug": "Nex_Skuska"}, "Slug „Nex_Skuska“ nemá tvar malé písmená, číslice a pomlčky."),
        ({"auth": "token"}, "Prihlásenie je „password“ alebo „manager“, nie „token“."),
        ({"ai": "áno"}, "AI je true alebo false."),
        ({"db_port": "18002"}, "Port „db_port“ musí byť číslo od 1 do 65535."),
        ({"app_name": " "}, "Názov aplikácie je prázdny."),
        ({"farba": "modrá"}, "Hodnotu „farba“ kostra nepozná."),
    ],
)
def test_a_wrong_value_is_said(tmp_path, changes, problem):
    with pytest.raises(render.ScaffoldError) as caught:
        render.render("nsv-standard", {**VALUES, **changes}, tmp_path)
    assert problem in caught.value.problems


def test_a_missing_value_is_named(tmp_path):
    values = dict(VALUES)
    del values["kit_server"]
    with pytest.raises(render.ScaffoldError) as caught:
        render.render("nsv-standard", values, tmp_path)
    assert caught.value.problems == ["Chýba hodnota „kit_server“."]


def test_an_unknown_template_is_said(tmp_path):
    with pytest.raises(render.ScaffoldError) as caught:
        render.render("iny-vzhlad", VALUES, tmp_path)
    assert caught.value.problems == ["Šablóna „iny-vzhlad“ nemá kostru (scaffold/iny-vzhlad)."]


def test_a_placeholder_the_renderer_does_not_know_is_refused(tmp_path, monkeypatch):
    source = tmp_path / "scaffold"
    (source / "x" / "env").mkdir(parents=True)
    (source / "x" / "a.txt").write_text("{{NEZNAME}}", encoding="utf-8")
    (source / "x" / "env" / "password.env").write_text("", encoding="utf-8")
    (source / "x" / "env" / "ai.env").write_text("", encoding="utf-8")  # DEV-460: the block of an app with AI
    monkeypatch.setattr(render, "HERE", source)

    with pytest.raises(render.ScaffoldError) as caught:
        render.render("x", VALUES, tmp_path / "out")
    assert caught.value.problems == ["Nevyplnené miesto v kostre — a.txt: {{NEZNAME}}"]


def init_sh_project(root: Path) -> Path:
    """What init.sh leaves: its frontend skeleton, docs, scripts and .env.example."""
    (root / "frontend" / "src" / "components").mkdir(parents=True)
    (root / "frontend" / "src" / "components" / "Sidebar.tsx").write_text("old", encoding="utf-8")
    (root / "docs" / "specs" / "versions" / "v0.1.0").mkdir(parents=True)
    (root / "docs" / "specs" / "versions" / "v0.1.0" / "RELEASE_NOTES.md").write_text("notes", encoding="utf-8")
    (root / "scripts").mkdir()
    (root / "scripts" / "rag_query.py").write_text("x", encoding="utf-8")
    (root / ".env.example").write_text("VITE_APP_VERSION=0.1.0\nTELEGRAM_NOTIFY_CHAT_ID=\n", encoding="utf-8")
    return root


def test_over_a_founded_project_the_frame_replaces_init_sh_s_frontend(tmp_path):
    project = init_sh_project(tmp_path)

    render.apply("nsv-standard", VALUES, project)

    assert not (project / "frontend" / "src" / "components" / "Sidebar.tsx").exists()
    assert (project / "frontend" / "src" / "App.tsx").exists()
    assert (project / "backend" / "app" / "kit.py").exists()
    assert (project / "docker-compose.yml").exists()
    assert (project / "docs" / "AKO_ZACAT.md").read_text("utf-8").startswith("## Čo aplikácia robí")
    assert (project / "docs" / "specs" / "versions" / "v0.1.0" / "RELEASE_NOTES.md").read_text("utf-8") == "notes"
    assert (project / "scripts" / "rag_query.py").exists()
    env = (project / ".env.example").read_text("utf-8")
    assert env.startswith("VITE_APP_VERSION=0.1.0\nTELEGRAM_NOTIFY_CHAT_ID=\n")
    assert (
        "ADMIN_INITIAL_PASSWORD=" in env
        and "DATABASE_URL=postgresql+pg8000://nex_skuska:CHANGE_ME@db:5432/nex_skuska" in env
    )
    assert not (project / ".nex-app-kit-scaffold").exists()


def test_a_refused_fill_leaves_the_project_as_it_was(tmp_path):
    project = init_sh_project(tmp_path)

    with pytest.raises(render.ScaffoldError):
        render.apply("nsv-standard", {**VALUES, "auth": "token"}, project)

    assert (project / "frontend" / "src" / "components" / "Sidebar.tsx").read_text("utf-8") == "old"
    assert not (project / "backend").exists()
    assert (project / ".env.example").read_text("utf-8") == "VITE_APP_VERSION=0.1.0\nTELEGRAM_NOTIFY_CHAT_ID=\n"


def test_the_scaffold_pins_the_nex_shared_the_kit_is_built_with():
    kit = json.loads((REPO / "package.json").read_text("utf-8"))
    scaffold = json.loads((SCAFFOLD / "nsv-standard" / "frontend" / "package.json").read_text("utf-8"))

    assert scaffold["dependencies"]["nex-shared"] == kit["devDependencies"]["nex-shared"]


def test_the_command_line_says_the_problems_and_ends_with_1(tmp_path, capsys):
    values = tmp_path / "values.json"
    values.write_text(json.dumps({**VALUES, "auth": "token"}), encoding="utf-8")

    assert render.main(["nsv-standard", "--values", str(values), "--out", str(tmp_path / "out")]) == 1
    assert "Prihlásenie je „password“ alebo „manager“, nie „token“." in capsys.readouterr().err


def test_an_app_with_ai_gets_claude_code_and_the_yearly_code_never_an_api_key(tmp_path):
    """DEV-460 — 21.11.2026 Orthodox Hermenia called Claude with an Anthropic API key and nothing with AI worked in
    PROD; an app with AI reaches Claude through the subscription: Claude Code in its image, the yearly code as its
    secret."""
    render.render("nsv-standard", VALUES, tmp_path)

    dockerfile = (tmp_path / "backend" / "Dockerfile").read_text("utf-8")
    block = (tmp_path / ".env.example.template-block").read_text("utf-8")
    assert "npm install -g @anthropic-ai/claude-code" in dockerfile and "claude --version" in dockerfile
    assert (
        "# @customer-secret required: „Ročný kód predplatného Claude (claude setup-token)“\nCLAUDE_CODE_OAUTH_TOKEN="
        in block
    )
    assert "ANTHROPIC_API_KEY" not in block + dockerfile


def test_claude_code_is_installed_after_the_apps_code_so_a_new_version_takes_the_newest(tmp_path):
    """DEV-490 — installed first, the layer of Claude Code stayed in the build cache: 22.11.2026 Orthodox Hermenia,
    built the day before, ran Claude Code 2.1.197 from early November („opus“ was Opus 4.8, „fable“ unknown). Node.js
    stays in front (it seldom changes); Claude Code comes after the app's code and documents, before the app's user."""
    render.render("nsv-standard", VALUES, tmp_path)

    lines = (tmp_path / "backend" / "Dockerfile").read_text("utf-8").splitlines()
    at = {
        key: next(i for i, line in enumerate(lines) if key in line)
        for key in (
            "nodesource.com/setup_20.x",
            "COPY pyproject.toml",
            "COPY app ./app",
            "COPY --from=docs specs/versions",
            "npm install -g @anthropic-ai/claude-code@latest",
            "USER 1000",
        )
    }

    assert at["nodesource.com/setup_20.x"] < at["COPY pyproject.toml"], "Node.js in front, where its layer stays"
    assert at["COPY app ./app"] < at["npm install -g @anthropic-ai/claude-code@latest"]
    assert (
        at["COPY --from=docs specs/versions"] < at["npm install -g @anthropic-ai/claude-code@latest"] < at["USER 1000"]
    )
    assert sum("@anthropic-ai/claude-code" in line for line in lines) == 1, "installed once, after the code"


def test_an_app_without_ai_gets_neither(tmp_path):
    render.render("nsv-standard", {**VALUES, "ai": False}, tmp_path)

    assert "claude-code" not in (tmp_path / "backend" / "Dockerfile").read_text("utf-8")
    assert "CLAUDE_CODE_OAUTH_TOKEN" not in (tmp_path / ".env.example.template-block").read_text("utf-8")


def _directive(conf: str, name: str) -> list[str]:
    """The values of an nginx directive in the order they stand (``name value;``)."""
    return [line.split(None, 1)[1].rstrip(";").strip() for line in conf.splitlines() if line.strip().startswith(name)]


def test_the_apps_web_server_takes_a_file_as_large_as_an_app_may_allow(tmp_path):
    """DEV-495 — 22.11.2026 Orthodox Hermenia could not take a single etalon PDF (11–347 MiB): its nginx, filled from
    this scaffold, set no size and refused everything over 1 MB (nginx's default) with a bare 413. The scaffold allows
    up to 2000 MB, so the app's own setting decides the limit; a large upload gets time to reach the backend. (The CI
    sends 2 MB through the filled app's real nginx — this test only keeps the lines from going missing.)"""
    render.render("nsv-standard", VALUES, tmp_path)

    conf = (tmp_path / "frontend" / "nginx.conf").read_text("utf-8")

    assert _directive(conf, "client_max_body_size") == ["2000m"]
    assert _directive(conf, "proxy_read_timeout") == ["300s"]
    assert _directive(conf, "proxy_send_timeout") == ["300s"]
