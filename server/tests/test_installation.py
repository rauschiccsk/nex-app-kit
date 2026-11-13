"""DEV-377 — an installation says whom it serves and whether it is the test or the live one.

13.11.2026 the Director ran NEX Manager 1.5.4 and could not tell for whom: the window, its header and the icon on the
task bar all read „NEX Manager“, and ICC s.r.o. and MÁGERSTAV s.r.o. each have one on UAT and on PROD. The cockpit now
writes ``NEX_CUSTOMER_NAME`` and ``NEX_ENVIRONMENT`` into the backend of every installation it deploys; the server hands
them to the frame and names the installed app by them. Director (translated): "I agree, I will try it and we will
see." These run without a database — the two routes need none."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import sessionmaker

from nex_app_kit import AppKit
from nex_app_kit.installation import Installation

from .conftest import build_app, manifest

MAGER_UAT = {"NEX_CUSTOMER_NAME": "  MÁGERSTAV   s.r.o. ", "NEX_ENVIRONMENT": "UAT"}


def test_the_identity_is_read_from_the_environment_the_cockpit_wrote():
    assert Installation.from_env(MAGER_UAT) == Installation("MÁGERSTAV s.r.o.", "uat")
    assert Installation.from_env({"NEX_ENVIRONMENT": "prod"}) == Installation(None, "prod")
    assert Installation.from_env({"NEX_CUSTOMER_NAME": " ", "NEX_ENVIRONMENT": "staging"}) == Installation(None, None)


@pytest.mark.parametrize(
    ("installation", "title"),
    [
        (Installation("MÁGERSTAV s.r.o.", "uat"), "NEX Manager — MÁGERSTAV s.r.o. (UAT)"),
        (Installation("ICC s.r.o.", "prod"), "NEX Manager — ICC s.r.o."),
        (Installation(None, "uat"), "NEX Manager (UAT)"),
        (Installation(None, None), "NEX Manager"),
    ],
)
def test_the_title_names_the_customer_and_marks_a_uat(installation, title):
    assert installation.title("NEX Manager") == title


def _client(monkeypatch, environ: dict) -> TestClient:
    for key in ("NEX_CUSTOMER_NAME", "NEX_ENVIRONMENT"):
        monkeypatch.delenv(key, raising=False)
    for key, value in environ.items():
        monkeypatch.setenv(key, value)
    kit = AppKit(manifest=manifest("password"), version="1", session_factory=sessionmaker())
    return TestClient(build_app(kit))


def test_the_frame_reads_whom_the_installation_serves_without_a_sign_in(monkeypatch):
    answer = _client(monkeypatch, MAGER_UAT).get("/api/v1/installation")

    assert answer.status_code == 200
    assert answer.json() == {"customer": "MÁGERSTAV s.r.o.", "environment": "uat"}


def test_the_installed_app_is_named_by_its_customer(monkeypatch):
    answer = _client(monkeypatch, MAGER_UAT).get("/api/v1/installation/manifest.webmanifest")

    assert answer.status_code == 200
    assert answer.headers["content-type"].startswith("application/manifest+json")
    body = answer.json()
    assert body["name"] == body["short_name"] == "NEX Skúška — MÁGERSTAV s.r.o. (UAT)"
    assert (body["id"], body["start_url"], body["scope"], body["display"]) == ("/", "/", "/", "standalone")
    assert {icon["src"] for icon in body["icons"]} == {"/icon.svg"}


def test_an_app_outside_the_cockpit_looks_as_before(monkeypatch):
    client = _client(monkeypatch, {})

    assert client.get("/api/v1/installation").json() == {"customer": None, "environment": None}
    assert client.get("/api/v1/installation/manifest.webmanifest").json()["name"] == "NEX Skúška"
