"""DEV-415 — what a multilingual app needed and built on its own until 0.16.0.

16.11.2026 the Specification of NEX Manager 1.7.0 planned, in NEX Manager alone: a button, two server routes and a store
so that the admin changes a person's language; a translation of its own server sentences in its screens; and the notes
and the guide only in Slovak. Every app on the template speaks Slovak, Hungarian and English by default, so every one
would have met the same holes. Director: „Súhlasím“.
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest
from fastapi import Depends

from nex_app_kit import KitError, User, load_server_messages, tr
from nex_app_kit.docs import in_language, release_notes

HU = {"Accept-Language": "hu-HU,hu;q=0.9"}
EN = {"Accept-Language": "en-GB,en;q=0.9"}

SENTENCES = {
    "sk": {"app.server.nameTaken": "Oblasť „{name}“ už existuje."},
    "hu": {"app.server.nameTaken": "A(z) „{name}“ terület már létezik."},
    "en": {"app.server.nameTaken": "The area “{name}” exists already."},
}


def with_refusal(app):
    """The app's own route that refuses with its own sentence — as NEX Manager refuses a group name taken."""

    def taken(_user: User = Depends(app.kit.current_user)) -> dict:
        raise KitError(409, "APP-NAME-TAKEN", "app.server.nameTaken", params={"name": "Sklad"})

    app.client.app.add_api_route("/api/v1/taken", taken, methods=["POST"])
    app.user("jan")
    app.login("jan")
    return app


# --- the app's own server sentences ---------------------------------------------------------------------------


def test_an_apps_own_refusal_is_said_in_the_persons_language(make_app):
    app = with_refusal(make_app(languages=["sk", "hu", "en"], server_messages=SENTENCES))

    said = {
        name: app.client.post("/api/v1/taken", headers=headers)
        for name, headers in (("sk", {}), ("hu", HU), ("en", EN))
    }

    assert {name: (r.status_code, r.json()) for name, r in said.items()} == {
        "sk": (409, {"detail": "Oblasť „Sklad“ už existuje.", "code": "APP-NAME-TAKEN"}),
        "hu": (409, {"detail": "A(z) „Sklad“ terület már létezik.", "code": "APP-NAME-TAKEN"}),
        "en": (409, {"detail": "The area “Sklad” exists already.", "code": "APP-NAME-TAKEN"}),
    }


def test_the_log_keeps_the_main_languages_sentence(make_app):
    make_app(languages=["sk", "hu", "en"], server_messages=SENTENCES)

    assert str(KitError(409, "APP-NAME-TAKEN", "app.server.nameTaken", params={"name": "Sklad"})) == (
        "Oblasť „Sklad“ už existuje."
    )


def test_an_app_whose_main_language_is_hungarian_falls_back_to_it(make_app):
    hu_first = {"hu": SENTENCES["hu"], "en": SENTENCES["en"]}
    app = with_refusal(make_app(languages=["hu", "en"], server_messages=hu_first))

    asked_german = app.client.post("/api/v1/taken", headers={"Accept-Language": "de"})

    assert asked_german.json()["detail"] == "A(z) „Sklad“ terület már létezik."
    # the log keeps Slovak where the app has it; an app without Slovak keeps its main language there
    assert str(KitError(409, "APP-NAME-TAKEN", "app.server.nameTaken", params={"name": "X"})) == (
        "A(z) „X“ terület már létezik."
    )


def test_without_catalogs_an_apps_sentence_is_said_as_written_and_no_earlier_apps_catalog_lingers(make_app):
    make_app(languages=["sk", "hu"], server_messages={"sk": SENTENCES["sk"], "hu": SENTENCES["hu"]})
    app = make_app(languages=["sk", "hu"])

    def plain(_user: User = Depends(app.kit.current_user)) -> dict:
        raise KitError(409, "APP-PLAIN", "Táto veta nie je kľúč.")

    app.client.app.add_api_route("/api/v1/plain", plain, methods=["POST"])
    app.user("jan")
    app.login("jan")

    assert app.client.post("/api/v1/plain", headers=HU).json()["detail"] == "Táto veta nie je kľúč."
    assert tr("hu", "app.server.nameTaken") == "app.server.nameTaken"


@pytest.mark.parametrize(
    "catalogs, sentence",
    [
        (
            {"sk": SENTENCES["sk"], "hu": SENTENCES["hu"]},
            "Hlášky servera aplikácie nemajú katalóg jazyka „en“ (jazyky aplikácie: sk, hu, en).",
        ),
        (
            {**SENTENCES, "de": {"app.server.nameTaken": "Bereich „{name}“ existiert."}},
            "Hlášky servera aplikácie majú katalóg jazyka „de“, ktorým aplikácia nehovorí.",
        ),
        ({**SENTENCES, "hu": {}}, "V katalógu „hu“ chýba hláška „app.server.nameTaken“."),
        (
            {**SENTENCES, "en": {**SENTENCES["en"], "app.server.extra": "Extra."}},
            "Katalóg „en“ má hlášku „app.server.extra“, ktorú hlavný jazyk „sk“ nemá.",
        ),
        (
            {**SENTENCES, "hu": {"app.server.nameTaken": " "}},
            "Hláška „app.server.nameTaken“ v katalógu „hu“ je prázdna.",
        ),
        (
            {**SENTENCES, "en": {"app.server.nameTaken": "The area {area} exists already."}},
            "Hláška „app.server.nameTaken“ v katalógu „en“ má iné hodnoty v {…} než hlavný jazyk „sk“.",
        ),
        (
            {lang: {"kit.server.forbidden": "x"} for lang in ("sk", "hu", "en")},
            "Kľúč hlášky servera „kit.server.forbidden“ nezačína „app.“ — kľúče „kit.“ patria šablóne.",
        ),
    ],
)
def test_an_app_whose_server_catalogs_do_not_match_does_not_start(make_app, catalogs, sentence):
    with pytest.raises(ValueError) as refused:
        make_app(languages=["sk", "hu", "en"], server_messages=catalogs)

    assert str(refused.value).splitlines() == ["AppKit nie je nastavený správne:", f"- {sentence}"]


def test_the_catalogs_are_read_from_the_apps_folder(tmp_path):
    for language, catalog in SENTENCES.items():
        (tmp_path / f"{language}.json").write_text(json.dumps(catalog, ensure_ascii=False), encoding="utf-8")

    assert load_server_messages(tmp_path) == SENTENCES
    assert load_server_messages(tmp_path / "missing") == {}


# --- the admin sets a person's language --------------------------------------------------------------------------


def signed_in_admin(make_app):
    app = make_app(languages=["sk", "hu", "en"])
    app.user("spravca", role="admin")
    app.login("spravca")
    return app


def changes(**extra):
    return {"email": "eva@firma.sk", "role": "user", "first_name": "", "last_name": "", "is_active": True, **extra}


def test_the_admin_changes_a_persons_language(make_app):
    app = signed_in_admin(make_app)
    eva = app.user("eva")

    changed = app.client.patch(f"/api/v1/users/{eva.id}", json=changes(language="hu"))
    kept = app.client.patch(f"/api/v1/users/{eva.id}", json=changes(first_name="Eva"))

    assert (changed.status_code, changed.json()["language"]) == (200, "hu")
    assert (kept.status_code, kept.json()["language"], kept.json()["first_name"]) == (200, "hu", "Eva")


def test_a_language_the_app_does_not_speak_is_refused_and_nothing_of_the_person_moves(make_app):
    app = signed_in_admin(make_app)
    eva = app.user("eva", language="en")

    refused = app.client.patch(f"/api/v1/users/{eva.id}", json=changes(language="de", email="ina@firma.sk"), headers=HU)

    assert (refused.status_code, refused.json()) == (
        422,
        {"detail": "Az alkalmazásnak nincs „de“ nyelve — ezek vannak: sk, hu, en.", "code": "KIT-LANGUAGE"},
    )
    person = next(u for u in app.client.get("/api/v1/users").json() if u["username"] == "eva")
    assert (person["language"], person["email"]) == ("en", "eva@firma.sk")


def test_the_admin_gives_a_new_person_a_language_or_none(make_app):
    app = signed_in_admin(make_app)
    new = {"email": "x@firma.sk", "password": "heslo-123", "role": "user"}

    with_language = app.client.post("/api/v1/users", json={**new, "username": "ina", "language": "en"})
    without = app.client.post("/api/v1/users", json={**new, "username": "ota", "email": "o@firma.sk"})
    refused = app.client.post("/api/v1/users", json={**new, "username": "pia", "email": "p@firma.sk", "language": "de"})

    assert (with_language.status_code, with_language.json()["language"]) == (201, "en")
    assert (without.status_code, without.json()["language"]) == (201, None)
    assert refused.status_code == 422
    assert "pia" not in {u["username"] for u in app.client.get("/api/v1/users").json()}


def test_a_regular_person_cannot_change_anyones_language(make_app):
    app = make_app(languages=["sk", "hu", "en"])
    eva = app.user("eva")
    app.user("jan")
    app.login("jan")

    assert app.client.patch(f"/api/v1/users/{eva.id}", json=changes(language="hu")).status_code == 403


# --- the notes and the guide in the person's language ------------------------------------------------------------


@pytest.fixture
def docs(tmp_path) -> Path:
    versions = tmp_path / "specs" / "versions"
    (versions / "v1.0.0").mkdir(parents=True)
    (versions / "v0.9.0").mkdir(parents=True)
    (versions / "v1.0.0" / "RELEASE_NOTES.md").write_text("# v1.0.0\n\nNová verzia.", encoding="utf-8")
    (versions / "v1.0.0" / "RELEASE_NOTES.hu.md").write_text("# v1.0.0\n\nÚj verzió.", encoding="utf-8")
    (versions / "v0.9.0" / "RELEASE_NOTES.md").write_text("Prvá verzia.", encoding="utf-8")
    (tmp_path / "AKO_ZACAT.md").write_text("Ako začať.", encoding="utf-8")
    (tmp_path / "AKO_ZACAT.en.md").write_text("Getting started.", encoding="utf-8")
    return tmp_path


def test_the_notes_are_said_in_the_persons_language_and_a_missing_translation_falls_back(make_app, docs):
    app = make_app(languages=["sk", "hu", "en"], docs_dir=docs)

    def said(headers):
        return [n["markdown"] for n in app.client.get("/api/v1/release-notes", headers=headers).json()]

    assert said(HU) == ["Új verzió.", "Prvá verzia."]
    assert said(EN) == ["Nová verzia.", "Prvá verzia."]
    assert said({}) == ["Nová verzia.", "Prvá verzia."]


def test_the_guide_is_said_in_the_persons_language(make_app, docs):
    app = make_app(languages=["sk", "hu", "en"], docs_dir=docs)
    app.user("jan")
    app.login("jan")

    guide = {
        name: app.client.get("/api/v1/getting-started", headers=h).json()["markdown"]
        for name, h in (("en", EN), ("hu", HU))
    }

    assert guide == {"en": "Getting started.", "hu": "Ako začať."}


@pytest.mark.parametrize("language", ["../hu", "hu/../x", "HU", "", None, "hun"])
def test_only_a_language_code_reaches_a_file_name(docs, language):
    main = docs / "AKO_ZACAT.md"
    (docs / "AKO_ZACAT.HU.md").write_text("x", encoding="utf-8")

    assert in_language(main, language) == main


def test_the_notes_of_a_version_without_its_main_file_are_not_listed(docs):
    lonely = docs / "specs" / "versions" / "v2.0.0"
    lonely.mkdir()
    (lonely / "RELEASE_NOTES.hu.md").write_text("Csak magyarul.", encoding="utf-8")

    assert [n["version"] for n in release_notes(docs, "hu")] == ["v1.0.0", "v0.9.0"]
