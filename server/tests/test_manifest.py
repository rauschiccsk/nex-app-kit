"""DEV-252 — the server reads the same manifest as the frontend and says the same sentences (shared cases)."""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from nex_app_kit import ManifestError, load_manifest, manifest_from_data

CASES = json.loads((Path(__file__).parent / "manifest_cases.json").read_text(encoding="utf-8"))


@pytest.mark.parametrize("case", CASES, ids=[c["why"] for c in CASES])
def test_shared_cases_say_what_the_frontend_says(case):
    if not case["problems"]:
        manifest = manifest_from_data(case["input"])
        assert manifest.template == case["input"]["template"]
        return
    with pytest.raises(ManifestError) as caught:
        manifest_from_data(case["input"])
    assert caught.value.problems == case["problems"]


def test_the_server_keeps_auth_and_agent_roles():
    manifest = manifest_from_data(
        {
            "template": "nsv-standard",
            "name": "NEX Knowledge",
            "initials": "NK",
            "auth": "manager",
            "ai": {"roles": [{"id": "assistant", "label": "Asistent"}]},
            "nav": [{"label": "Oblasti", "path": "/areas", "icon": "🗂️"}],
        }
    )
    assert manifest.auth == "manager"
    assert [r.id for r in manifest.ai_roles] == ["assistant"]
    assert manifest.ai is True


def test_without_ai_there_are_no_roles():
    manifest = manifest_from_data({"template": "nsv-standard", "name": "A", "initials": "A", "auth": "password"})
    assert manifest.ai is False
    assert manifest.ai_roles == ()


def test_a_missing_file_is_said(tmp_path: Path):
    with pytest.raises(ManifestError) as caught:
        load_manifest(tmp_path / "app.manifest.json")
    assert caught.value.problems == [f"Manifest aplikácie {tmp_path / 'app.manifest.json'} neexistuje."]


def test_a_broken_file_is_said(tmp_path: Path):
    file = tmp_path / "app.manifest.json"
    file.write_text('{"template": "nsv-standard",\n "name": }', encoding="utf-8")
    with pytest.raises(ManifestError) as caught:
        load_manifest(file)
    assert caught.value.problems == [f"Manifest aplikácie {file} nie je platný JSON (riadok 2)."]


def test_a_good_file_is_read(tmp_path: Path):
    file = tmp_path / "app.manifest.json"
    file.write_text(json.dumps(CASES[0]["input"]), encoding="utf-8")
    assert load_manifest(file).name == "NEX Knowledge"
