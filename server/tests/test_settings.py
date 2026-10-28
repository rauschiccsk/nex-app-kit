"""DEV-252 — Systém, Agenti, the person's layout, Aktualizácie, Ako začať and the server's health."""

from __future__ import annotations

import json
from pathlib import Path

import pytest
from sqlalchemy import text

from nex_app_kit import SettingDefinition
from nex_app_kit.system_settings import SystemSettings, check_definitions

LIMIT = SettingDefinition(
    key="search_limit",
    default="20",
    value_type="int",
    label="Počet výsledkov",
    description="Koľko výsledkov ukáže hľadanie.",
    min=1,
    max=100,
)
STRICT = SettingDefinition(
    key="search_strict", default="false", value_type="bool", label="Prísne hľadanie", description=""
)
SCORE = SettingDefinition(
    key="search_score", default="0.35", value_type="float", label="Najnižšia zhoda", description=""
)
TITLE = SettingDefinition(
    key="report_title", default="Správa", value_type="string", label="Nadpis správy", description=""
)


def as_admin(make_app, **kwargs):
    app = make_app(**kwargs)
    app.user("spravca", role="admin")
    app.login("spravca")
    return app


# ── Systém ──────────────────────────────────────────────────────────────────────────────────────────
def test_the_list_has_the_app_s_settings_and_the_kit_s_own(make_app):
    app = as_admin(make_app, settings=(LIMIT,))

    rows = app.client.get("/api/v1/system-settings").json()

    assert [r["key"] for r in rows] == ["auth_session_idle_minutes", "auth_session_max_hours", "search_limit"]
    assert rows[2] == {
        "key": "search_limit",
        "value": "20",
        "value_type": "int",
        "label": "Počet výsledkov",
        "description": "Koľko výsledkov ukáže hľadanie.",
        "unit": None,
        "updated_at": None,
        "updated_by": None,
        "updated_by_username": None,
        "is_default": True,
    }
    assert rows[0]["unit"] == "minút"


def test_an_admin_changes_a_setting_and_the_app_reads_it_at_once(make_app):
    app = as_admin(make_app, settings=(LIMIT,))
    assert app.kit.settings.get_int("search_limit") == 20

    response = app.client.patch("/api/v1/system-settings/search_limit", json={"value": " 50 "})

    assert response.status_code == 200
    body = response.json()
    assert (body["value"], body["is_default"], body["updated_by_username"]) == ("50", False, "spravca")
    assert app.kit.settings.get_int("search_limit") == 50


@pytest.mark.parametrize(
    "definition,value,sentence",
    [
        (LIMIT, "abc", "„Počet výsledkov“ musí byť celé číslo, nie „abc“."),
        (LIMIT, "0", "„Počet výsledkov“ musí byť od 1 do 100."),
        (LIMIT, "101", "„Počet výsledkov“ musí byť od 1 do 100."),
        (LIMIT, "", "„Počet výsledkov“ nesmie byť prázdne."),
        (STRICT, "možno", "„Prísne hľadanie“ je áno alebo nie, nie „možno“."),
        (SCORE, "veľa", "„Najnižšia zhoda“ musí byť číslo, nie „veľa“."),
    ],
)
def test_a_wrong_value_is_said(make_app, definition, value, sentence):
    app = as_admin(make_app, settings=(definition,))

    response = app.client.patch(f"/api/v1/system-settings/{definition.key}", json={"value": value})

    assert response.status_code == 422
    assert response.json()["detail"] == sentence


@pytest.mark.parametrize(
    "definition,value,stored,read",
    [
        (STRICT, "Áno", "true", True),
        (STRICT, "off", "false", False),
        (SCORE, "0,5", "0.5", 0.5),
        (TITLE, "  Mesačná správa ", "Mesačná správa", "Mesačná správa"),
    ],
)
def test_values_are_stored_one_way(make_app, definition, value, stored, read):
    app = as_admin(make_app, settings=(definition,))

    response = app.client.patch(f"/api/v1/system-settings/{definition.key}", json={"value": value})

    assert response.json()["value"] == stored
    getter = {
        "bool": app.kit.settings.get_bool,
        "float": app.kit.settings.get_float,
        "string": app.kit.settings.get_str,
    }
    assert getter[definition.value_type](definition.key) == read


def test_a_user_reads_settings_but_does_not_change_them(make_app):
    app = make_app(settings=(LIMIT,))
    app.user("eva")
    app.login("eva")

    assert app.client.get("/api/v1/system-settings").status_code == 200
    assert app.client.patch("/api/v1/system-settings/search_limit", json={"value": "5"}).status_code == 403


def test_an_unknown_setting_is_said(make_app):
    app = as_admin(make_app)

    response = app.client.patch("/api/v1/system-settings/nieco", json={"value": "1"})

    assert response.status_code == 404
    assert response.json()["detail"] == "Systémové nastavenie „nieco“ aplikácia nemá."


def test_a_change_made_elsewhere_shows_within_30_seconds(factory):
    clock_s = [0.0]
    settings = SystemSettings((LIMIT,), factory, clock=lambda: None, monotonic=lambda: clock_s[0])
    assert settings.get_int("search_limit") == 20
    with factory() as db:
        db.execute(text("INSERT INTO kit_system_settings (key, value) VALUES ('search_limit', '70')"))
        db.commit()

    clock_s[0] = 29.9
    assert settings.get_int("search_limit") == 20
    clock_s[0] = 30.1
    assert settings.get_int("search_limit") == 70


def test_the_app_s_descriptions_are_checked():
    assert check_definitions(
        [
            SettingDefinition(key="auth_vlastne", default="1", value_type="int", label="A", description=""),
            SettingDefinition(key="x", default="1", value_type="int", label="X", description=""),
            SettingDefinition(key="x", default="1", value_type="int", label="X", description=""),
            SettingDefinition(key="y", default="200", value_type="int", label="Y", description="", max=100),
            SettingDefinition(key="z", default="1", value_type="date", label="Z", description=""),  # type: ignore[arg-type]
        ]
    ) == [
        "Kľúč „auth_vlastne“ začína „auth_“ — tie patria šablóne.",
        "Systémové nastavenie „x“ je opísané dvakrát.",
        "Predvolená hodnota „y“ neprejde vlastnou kontrolou: „Y“ musí byť od … do 100.",
        "Systémové nastavenie „z“ má neznámy typ „date“.",
    ]


def test_an_app_with_wrong_descriptions_does_not_start(factory):
    from nex_app_kit import AppKit

    from .conftest import manifest

    bad = SettingDefinition(key="auth_x", default="1", value_type="int", label="X", description="")
    with pytest.raises(ValueError) as caught:
        AppKit(manifest=manifest(), version="1", session_factory=factory, settings=[bad])
    assert "Kľúč „auth_x“ začína „auth_“ — tie patria šablóne." in str(caught.value)


# ── Agenti ──────────────────────────────────────────────────────────────────────────────────────────
def test_each_role_of_the_manifest_has_a_row_empty_until_chosen(make_app):
    app = as_admin(make_app, ai=True)

    rows = app.client.get("/api/v1/agent-settings").json()
    models = app.client.get("/api/v1/agent-settings/models").json()

    assert rows == [
        {"role": "assistant", "model": "", "effort": ""},
        {"role": "reviewer", "model": "", "effort": ""},
    ]
    assert [m["id"] for m in models] == ["opus", "sonnet", "haiku"]


def test_an_admin_chooses_model_and_effort_and_the_app_reads_them(make_app):
    app = as_admin(make_app, ai=True)
    assert app.kit.agent_choice("assistant").model is None

    response = app.client.put("/api/v1/agent-settings/assistant", json={"model": "opus", "effort": "high"})

    assert response.json() == {"role": "assistant", "model": "opus", "effort": "high"}
    choice = app.kit.agent_choice("assistant")
    assert (choice.model, choice.effort) == ("opus", "high")
    app.client.put("/api/v1/agent-settings/assistant", json={"model": "", "effort": ""})
    assert app.kit.agent_choice("assistant").model is None


@pytest.mark.parametrize(
    "role,body,status,sentence",
    [
        ("assistant", {"model": "claude-opus-4"}, 422, "Model je jeden z: opus, sonnet, haiku — nie „claude-opus-4“."),
        (
            "assistant",
            {"effort": "ultracode"},
            422,
            "Úsilie je jedno z: low, medium, high, xhigh, max — nie „ultracode“.",
        ),
        ("tlmocnik", {"model": "opus"}, 404, "Rolu agenta „tlmocnik“ aplikácia nemá."),
    ],
)
def test_a_wrong_agent_choice_is_said(make_app, role, body, status, sentence):
    app = as_admin(make_app, ai=True)

    response = app.client.put(f"/api/v1/agent-settings/{role}", json=body)

    assert response.status_code == status
    assert response.json()["detail"] == sentence


def test_agents_are_the_admin_s(make_app):
    app = make_app(ai=True)
    app.user("eva")
    app.login("eva")

    assert app.client.get("/api/v1/agent-settings").status_code == 403
    assert app.client.put("/api/v1/agent-settings/assistant", json={"model": "opus"}).status_code == 403


def test_an_app_without_ai_has_no_agents(make_app):
    app = as_admin(make_app)

    assert app.client.get("/api/v1/agent-settings").status_code == 404
    with pytest.raises(ValueError):
        app.kit.agent_choice("assistant")


# ── the person's layout ─────────────────────────────────────────────────────────────────────────────
LIMITS = {"sidebar_width": {"min": 180, "max": 360, "default": 224}}


def test_a_new_person_has_the_default_layout_and_its_bounds(make_app):
    app = as_admin(make_app)

    assert app.client.get("/api/v1/user-layout").json() == {
        "sidebar_width": None,
        "sidebar_collapsed": False,
        "limits": LIMITS,
    }


def test_only_what_is_sent_changes(make_app):
    app = as_admin(make_app)
    app.client.put("/api/v1/user-layout", json={"sidebar_width": 300})

    response = app.client.put("/api/v1/user-layout", json={"sidebar_collapsed": True})

    assert response.json() == {"sidebar_width": 300, "sidebar_collapsed": True, "limits": LIMITS}
    assert app.client.put("/api/v1/user-layout", json={"sidebar_width": None}).json()["sidebar_width"] is None


@pytest.mark.parametrize("width", [179, 361])
def test_a_width_out_of_bounds_is_refused(make_app, width):
    app = as_admin(make_app)

    response = app.client.put("/api/v1/user-layout", json={"sidebar_width": width})

    assert response.status_code == 422
    assert response.json()["detail"] == "Šírka ľavého panela musí byť od 180 do 360 px."


def test_every_person_has_their_own_layout(make_app):
    app = as_admin(make_app)
    app.client.put("/api/v1/user-layout", json={"sidebar_width": 300})
    app.user("eva")
    eva = app.other_browser()
    app.login("eva", client=eva)

    assert eva.get("/api/v1/user-layout").json()["sidebar_width"] is None


# ── Aktualizácie, Ako začať, health ─────────────────────────────────────────────────────────────────
def write_docs(root: Path) -> Path:
    versions = root / "specs" / "versions"
    for version, body in {
        "v0.9.0": "# v0.9.0 — NEX Skúška\n\nPrvá verzia.",
        "v0.10.0": "<!-- interné: CR-12 -->\n## v0.10.0\n\n## Nové\n\n- Hľadanie.",
        "v0.10.1": "Oprava dátumov.",
    }.items():
        (versions / version).mkdir(parents=True)
        (versions / version / "RELEASE_NOTES.md").write_text(body, encoding="utf-8")
    (versions / "v1.0.0-draft").mkdir()
    (versions / "v1.0.0-draft" / "RELEASE_NOTES.md").write_text("Nie.", encoding="utf-8")
    (versions / "v2.0.0").mkdir()
    (versions / "release-dates.json").write_text(json.dumps({"v0.10.0": "2026-10-20"}), encoding="utf-8")
    (root / "AKO_ZACAT.md").write_text("## Prvé kroky\n\nOtvor Oblasti.\n", encoding="utf-8")
    return root


def test_release_notes_newest_first_with_dates_and_without_their_own_heading(make_app, tmp_path):
    app = make_app(docs_dir=write_docs(tmp_path))

    notes = app.client.get("/api/v1/release-notes").json()

    assert notes == [
        {"version": "v0.10.1", "released_at": None, "markdown": "Oprava dátumov."},
        {"version": "v0.10.0", "released_at": "2026-10-20", "markdown": "## Nové\n\n- Hľadanie."},
        {"version": "v0.9.0", "released_at": None, "markdown": "Prvá verzia."},
    ]


def test_without_documents_there_is_nothing_new(make_app, tmp_path):
    assert make_app(docs_dir=tmp_path).client.get("/api/v1/release-notes").json() == []
    assert make_app().client.get("/api/v1/release-notes").json() == []


def test_getting_started_is_the_app_s_guide_for_the_signed_in(make_app, tmp_path):
    app = make_app(docs_dir=write_docs(tmp_path))
    assert app.client.get("/api/v1/getting-started").status_code == 401
    app.user("eva")
    app.login("eva")

    assert app.client.get("/api/v1/getting-started").json() == {"markdown": "## Prvé kroky\n\nOtvor Oblasti."}


def test_without_a_guide_getting_started_is_empty(make_app, tmp_path):
    app = make_app(docs_dir=tmp_path)
    app.user("eva")
    app.login("eva")

    assert app.client.get("/api/v1/getting-started").json() == {"markdown": ""}


def test_health_says_the_version_and_the_database(make_app):
    response = make_app().client.get("/api/v1/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok", "version": "1.2.3", "checks": {"database": "ok"}}


def test_health_without_the_database_is_503(make_app):
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker

    from nex_app_kit import AppKit

    from .conftest import build_app, manifest

    dead = sessionmaker(create_engine("postgresql+psycopg://kit:kit@127.0.0.1:1/kit"))
    kit = AppKit(manifest=manifest(), version="1.2.3", session_factory=dead)
    from fastapi.testclient import TestClient

    response = TestClient(build_app(kit), base_url="https://testserver").get("/api/v1/health")

    assert response.status_code == 503
    assert response.json()["checks"] == {"database": "error"}


def test_health_answers_at_the_root_too_for_probes(make_app):
    client = make_app().client

    assert client.get("/health").json() == client.get("/api/v1/health").json()
    assert "/health" not in client.app.openapi()["paths"]
