"""The template's server answers in this app: health with the database, Aktualizácie, and the sign-in the manifest
names — own password (the first admin from ADMIN_INITIAL_PASSWORD) or launched from NEX Manager."""

from __future__ import annotations

import os

import pytest

from app.kit import kit, manifest


def test_health_says_the_database_answers(client):
    response = client.get("/health")

    assert response.status_code == 200
    assert response.json()["checks"] == {"database": "ok"}


def test_release_notes_are_public(client):
    assert client.get("/api/v1/release-notes").status_code == 200


def test_without_signing_in_nothing_else_is_open(client):
    assert client.get("/api/v1/system-settings").status_code == 401


@pytest.mark.skipif(manifest.auth != "password", reason="the app is launched from NEX Manager")
def test_the_first_admin_signs_in_and_must_change_the_password(client):
    os.environ["ADMIN_INITIAL_PASSWORD"] = "pociatocne-heslo"
    kit.bootstrap_admin(os.environ["ADMIN_INITIAL_PASSWORD"])

    response = client.post("/api/v1/auth/login", json={"username": "admin", "password": "pociatocne-heslo"})

    assert response.status_code == 200
    assert response.json()["must_change_password"] is True


@pytest.mark.skipif(manifest.auth != "manager", reason="the app has its own password")
def test_a_launch_without_the_pairing_says_so(client):
    response = client.get("/api/v1/launch", params={"lt": "x"}, follow_redirects=False)

    assert response.status_code == 503
    assert "Aplikácia ešte nie je prepojená s NEX Managerom" in response.text
