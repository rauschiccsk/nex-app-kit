"""DEV-394 — the server says its sentences in the person's language, and keeps the language each person chose.

15.11.2026 the Director wanted Orthodox Hermenia in Hungarian: „v NEX Genesis máme urobené tak, že každý užívateľ
môže nastaviť pre seba jazyk aplikácie … tá istá aplikácia sa dá používať súčasne vo viacerých jazykoch“. On the four
tickets: „Áno založ všetky štyri a začni ich implementovať.“
"""

from __future__ import annotations

import json
import re
from pathlib import Path

from sqlalchemy import inspect, text

from nex_app_kit.i18n import CATALOGS, language_of, tr
from nex_app_kit.manifest import ManifestError, manifest_from_data

from .test_launch import launch, ticket

PACKAGE = Path(__file__).resolve().parents[1] / "src" / "nex_app_kit"
HU = {"Accept-Language": "hu-HU,hu;q=0.9,sk;q=0.5"}


def test_a_person_keeps_the_language_they_chose(make_app):
    app = make_app(languages=["sk", "hu"])
    app.user("jan")
    app.login("jan")

    chosen = app.client.put("/api/v1/auth/language", json={"language": "hu"})

    assert chosen.status_code == 200 and chosen.json()["language"] == "hu"
    assert app.client.get("/api/v1/auth/me").json()["language"] == "hu"


def test_only_a_language_of_the_app_is_taken_and_the_refusal_is_said_in_the_asked_one(make_app):
    app = make_app(languages=["sk", "hu"])
    app.user("jan")
    app.login("jan")

    refused = app.client.put("/api/v1/auth/language", json={"language": "en"}, headers=HU)

    assert refused.status_code == 422
    assert refused.json() == {
        "detail": "Az alkalmazásnak nincs „en“ nyelve — ezek vannak: sk, hu.",
        "code": "KIT-LANGUAGE",
    }


def test_a_failed_sign_in_is_said_in_the_language_the_browser_asks_for(make_app):
    app = make_app(languages=["sk", "hu"])
    app.user("jan")

    hu = app.client.post("/api/v1/auth/login", json={"username": "jan", "password": "zle"}, headers=HU)
    sk = app.client.post("/api/v1/auth/login", json={"username": "jan", "password": "zle"})

    assert (hu.status_code, hu.json()["detail"]) == (401, "Hibás felhasználónév vagy jelszó.")
    assert sk.json()["detail"] == "Nesprávne meno alebo heslo."


def test_an_app_that_speaks_only_slovak_answers_in_slovak_whatever_is_asked(make_app):
    app = make_app()
    app.user("jan")

    answer = app.client.post("/api/v1/auth/login", json={"username": "jan", "password": "zle"}, headers=HU)

    assert answer.json()["detail"] == "Nesprávne meno alebo heslo."


def test_the_installation_says_its_language_and_the_apps(make_app, monkeypatch):
    monkeypatch.setenv("NEX_LANGUAGE", "hu")
    hungarian = make_app(languages=["sk", "hu"]).client.get("/api/v1/installation").json()
    slovak_only = make_app().client.get("/api/v1/installation").json()

    assert (hungarian["language"], hungarian["languages"]) == ("hu", ["sk", "hu"])
    assert (slovak_only["language"], slovak_only["languages"]) == ("sk", ["sk"])  # a language the app lacks: its first


def test_a_failed_launch_page_speaks_the_browsers_language(make_app):
    app = make_app(auth="manager", languages=["sk", "hu"])

    page = app.client.get("/api/v1/launch", params={"lt": "zly"}, headers=HU, follow_redirects=False)

    assert page.status_code == 401
    body = page.text
    assert '<html lang="hu">' in body and "Az alkalmazást nem sikerült megnyitni" in body
    assert "Az indítójegy nem érvényes." in body


def test_the_language_set_in_nex_manager_comes_with_the_launch(make_app):
    app = make_app(auth="manager", languages=["sk", "hu"])
    app.manager.add("eva", language="hu")

    assert launch(app, ticket("eva")).status_code == 303
    assert app.client.get("/api/v1/auth/me").json()["language"] == "hu"


def test_the_templates_settings_are_named_in_the_persons_language(make_app):
    app = make_app(languages=["sk", "hu"])
    app.user("jan", role="admin")
    app.login("jan")

    rows = {r["key"]: r for r in app.client.get("/api/v1/system-settings", headers=HU).json()}
    idle = rows["auth_session_idle_minutes"]

    assert (idle["label"], idle["unit"]) == ("Kijelentkezés tétlenség után", "perc")
    refused = app.client.patch("/api/v1/system-settings/auth_session_idle_minutes", json={"value": "abc"}, headers=HU)
    assert refused.json()["detail"] == "„Kijelentkezés tétlenség után“ egész szám kell legyen, nem „abc“."


def test_a_database_from_before_gets_the_persons_language(migrated, factory):
    from .conftest import password_kit

    with migrated.begin() as connection:
        connection.execute(text("ALTER TABLE kit_users DROP COLUMN language"))
        connection.execute(text("UPDATE kit_alembic_version SET version_num = 'kit_0002'"))

    password_kit(factory).upgrade_database(migrated)

    assert "language" in {c["name"] for c in inspect(migrated).get_columns("kit_users")}


def test_both_catalogs_have_every_key_and_every_key_the_code_says_is_in_them():
    assert set(CATALOGS["sk"]) == set(CATALOGS["hu"])
    assert all(value.strip() for catalog in CATALOGS.values() for value in catalog.values())
    said = set()
    for source in PACKAGE.rglob("*.py"):
        said |= set(re.findall(r'"(kit\.(?:server|setting)\.[A-Za-z.]+)"', source.read_text(encoding="utf-8")))
    said |= set(
        re.findall(r'"(kit\.setting\.[A-Za-z.]+)"', (PACKAGE / "kit_settings.json").read_text(encoding="utf-8"))
    )
    assert said and said <= set(CATALOGS["sk"]), sorted(said - set(CATALOGS["sk"]))


def test_no_sentence_for_a_person_is_written_into_the_server_code():
    """Every refusal is raised with its key: a Slovak sentence handed to a refusal is a sentence no other language
    gets. The manifest's and AppKit's own sentences are for the agent who builds the app — they stay Slovak."""
    refusal = re.compile(
        r"(?:invalid|conflict|not_found|forbidden|not_signed_in|unavailable|KitError|LaunchRefused|launch_page)\("
    )
    slovak = re.compile(r"[áäčďéíĺľňóôŕšťúýž]")
    found = []
    for source in sorted(PACKAGE.glob("*.py")):
        if source.name in ("manifest.py",):
            continue
        lines = source.read_text(encoding="utf-8").splitlines()
        for number, line in enumerate(lines, 1):
            window = " ".join(lines[number - 1 : number + 3])
            if refusal.search(line) and slovak.search(window.split("#")[0]):
                found.append(f"{source.name}:{number}: {line.strip()[:90]}")
    assert found == []


def test_the_language_asked_for_is_read_by_its_weight():
    assert language_of("en-US,hu;q=0.8,sk;q=0.9", ("sk", "hu")) == "sk"
    assert language_of("hu", ("sk",), "sk") == "sk"
    assert language_of(None, ("hu", "sk"), "sk") == "sk"
    assert language_of("", ("hu", "sk")) == "hu"
    assert tr("hu", "kit.server.locked", {"minutes": 3}) == "Túl sok sikertelen próbálkozás. Próbáld újra 3 perc múlva."


def test_the_manifest_names_its_languages():
    base = {"template": "nsv-standard", "name": "NEX Skúška", "initials": "NS", "auth": "password"}
    assert manifest_from_data({**base, "languages": ["hu", "sk"]}).languages == ("hu", "sk")
    assert manifest_from_data(base).languages == ("sk",)
    try:
        manifest_from_data({**base, "languages": ["sk", "en", "sk"]})
    except ManifestError as error:
        assert error.problems == ["Jazyk „en“ šablóna nepozná — pozná tieto: sk, hu.", "Jazyk „sk“ je uvedený dvakrát."]
    else:
        raise AssertionError("a language the template does not know passed")
    assert json.loads((PACKAGE / "locales" / "hu.json").read_text(encoding="utf-8"))
