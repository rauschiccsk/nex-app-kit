"""DEV-523 — the scaffold of an app with a web: ``web/`` beside the administration — the filled frontend, minus what
belongs to the administration, with the web's own frame (WebApp), its own manifest (the same app, with a web) and
catalogs, and the web's service in docker-compose.yml. A project already on the template gets its web the same way
(``--add-web``) — nothing else of it changes. 26.11.2026 orthodox-register: the Director — „Spravme to tak, aby kopit
aj do budúcna mal takú funkciu - pridať webový frontend.“"""

from __future__ import annotations

import json
import shutil
import sys
from pathlib import Path

import pytest

SCAFFOLD = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(SCAFFOLD))

import render  # noqa: E402

VALUES = {
    "app_name": "Orthodox Register",
    "app_initials": "OR",
    "slug": "orthodox-register",
    "auth": "password",
    "ai": False,
    "backend_port": 10240,
    "frontend_port": 10241,
    "db_port": 10242,
    "kit_frontend": "github:rauschiccsk/nex-app-kit#v0.23.0",
    "kit_server": "nex-app-kit @ https://github.com/rauschiccsk/nex-app-kit/archive/refs/tags/v0.23.0.tar.gz#subdirectory=server",
}
WEB = {**VALUES, "web": True, "web_port": 10245}


def read_json(path: Path) -> dict:
    return json.loads(path.read_text("utf-8"))


def test_an_app_with_a_web_gets_web_beside_its_administration(tmp_path):
    render.render("nsv-standard", WEB, tmp_path)

    web = tmp_path / "web"
    for path in web.rglob("*"):
        if path.is_file():
            assert not render.PLACEHOLDER.search(path.read_text("utf-8")), path
    assert (web / "src" / "pages" / "HomePage.tsx").is_file()
    assert not (web / "src" / "pages" / "OverviewPage.tsx").exists()
    assert "WebApp" in (web / "src" / "App.tsx").read_text("utf-8")
    assert (web / "Dockerfile").read_text("utf-8") == (tmp_path / "frontend" / "Dockerfile").read_text("utf-8")
    assert read_json(web / "app.manifest.json")["web"] is True
    assert read_json(tmp_path / "frontend" / "app.manifest.json")["web"] is True
    assert {k: v for k, v in read_json(web / "app.manifest.json").items() if k in ("name", "initials", "auth")} == {
        "name": "Orthodox Register",
        "initials": "OR",
        "auth": "password",
    }
    assert '"app.web.home.title": "Vitajte"' in (web / "src" / "locales" / "sk.ts").read_text("utf-8")
    assert "app.overview.preparing" not in (web / "src" / "locales" / "sk.ts").read_text("utf-8")
    compose = (tmp_path / "docker-compose.yml").read_text("utf-8")
    assert "\n  web:\n    build:\n      context: ./web\n" in compose and '- "10245:80"' in compose


def test_an_app_without_a_web_has_no_web_and_no_web_service(tmp_path):
    render.render("nsv-standard", VALUES, tmp_path)

    assert not (tmp_path / "web").exists()
    assert "web" not in read_json(tmp_path / "frontend" / "app.manifest.json")
    assert "\n  web:\n" not in (tmp_path / "docker-compose.yml").read_text("utf-8")


@pytest.mark.parametrize(
    ("changes", "problem"),
    [
        ({"auth": "manager"}, "Web má len aplikácia s vlastným heslom (auth „password“) — web sa prihlasuje e-mailom."),
        ({"web_port": "10245"}, "Port webu „web_port“ musí byť číslo od 1 do 65535."),
        ({"web": "áno"}, "Web (web) je true alebo false."),
    ],
)
def test_a_web_that_cannot_be_is_refused_with_its_reason(changes, problem):
    assert problem in render.check({**WEB, **changes})


def test_a_project_on_the_template_gets_its_web_and_nothing_else_changes(tmp_path):
    render.render("nsv-standard", VALUES, tmp_path)
    (tmp_path / "frontend" / "src" / "pages" / "MinePage.tsx").write_text("// the app's own page\n", "utf-8")
    manifest = read_json(tmp_path / "frontend" / "app.manifest.json")
    manifest["nav"] = [{"label": "Matriky", "path": "/books", "icon": "📖"}]
    (tmp_path / "frontend" / "app.manifest.json").write_text(json.dumps(manifest), "utf-8")
    backend_before = {p.relative_to(tmp_path): p.read_bytes() for p in (tmp_path / "backend").rglob("*") if p.is_file()}

    render.add_web("nsv-standard", {**VALUES, "web_port": 10245}, tmp_path)

    assert (tmp_path / "web" / "src" / "App.tsx").is_file()
    assert (tmp_path / "frontend" / "src" / "pages" / "MinePage.tsx").read_text("utf-8") == "// the app's own page\n"
    after = read_json(tmp_path / "frontend" / "app.manifest.json")
    assert after["web"] is True and after["nav"] == manifest["nav"]
    assert {
        p.relative_to(tmp_path): p.read_bytes() for p in (tmp_path / "backend").rglob("*") if p.is_file()
    } == backend_before
    compose = (tmp_path / "docker-compose.yml").read_text("utf-8")
    assert compose.count("\n  web:\n") == 1 and '- "10245:80"' in compose
    assert compose.index("\n  web:\n") < compose.index("\n  test:\n")
    assert not (tmp_path / ".nex-app-kit-scaffold").exists()


def test_a_project_that_has_a_web_is_not_given_a_second(tmp_path):
    render.render("nsv-standard", VALUES, tmp_path)
    render.add_web("nsv-standard", {**VALUES, "web_port": 10245}, tmp_path)
    kept = (tmp_path / "web" / "src" / "App.tsx").read_text("utf-8")

    with pytest.raises(render.ScaffoldError) as refused:
        render.add_web("nsv-standard", {**VALUES, "web_port": 10245}, tmp_path)

    assert refused.value.problems == ["Projekt už má priečinok web/ — webový frontend sa nepridá druhý raz."]
    assert (tmp_path / "web" / "src" / "App.tsx").read_text("utf-8") == kept


def test_the_command_line_adds_the_web_to_a_project(tmp_path):
    render.render("nsv-standard", VALUES, tmp_path / "app")
    values = tmp_path / "values.json"
    values.write_text(json.dumps({**VALUES, "web_port": 10245}), "utf-8")

    assert render.main(["nsv-standard", "--values", str(values), "--into", str(tmp_path / "app"), "--add-web"]) == 0
    assert (tmp_path / "app" / "web" / "app.manifest.json").is_file()
    shutil.rmtree(tmp_path / "app")
