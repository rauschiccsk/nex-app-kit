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
