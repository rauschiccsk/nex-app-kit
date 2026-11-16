"""DEV-394 — the scaffold writes the app's own catalogs, one per language the app speaks, and names the languages in
the manifest. The cockpit gives the languages of the project (DEV-395); without them the app speaks Slovak."""

from __future__ import annotations

import json
import sys
from pathlib import Path

SCAFFOLD = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(SCAFFOLD))

import render  # noqa: E402
from test_render import VALUES  # noqa: E402


def test_without_languages_the_app_speaks_slovak_with_its_own_catalog(tmp_path):
    render.render("nsv-standard", VALUES, tmp_path)

    manifest = json.loads((tmp_path / "frontend" / "app.manifest.json").read_text(encoding="utf-8"))
    locales = tmp_path / "frontend" / "src" / "locales"
    assert "languages" not in manifest
    assert sorted(p.name for p in locales.iterdir()) == ["index.ts", "sk.ts"]
    assert '"app.overview.preparing": "Prehľad aplikácie sa pripravuje."' in (locales / "sk.ts").read_text(
        encoding="utf-8"
    )
    assert "export const messages: AppMessages = { sk };" in (locales / "index.ts").read_text(encoding="utf-8")


def test_a_hungarian_app_gets_its_main_catalog_and_the_slovak_one_typed_against_it(tmp_path):
    render.render("nsv-standard", {**VALUES, "languages": ["hu", "sk"]}, tmp_path)

    manifest = json.loads((tmp_path / "frontend" / "app.manifest.json").read_text(encoding="utf-8"))
    locales = tmp_path / "frontend" / "src" / "locales"
    assert manifest["languages"] == ["hu", "sk"]
    assert "export type AppMessageKey = keyof typeof hu;" in (locales / "hu.ts").read_text(encoding="utf-8")
    assert "export const sk: Record<AppMessageKey, Message>" in (locales / "sk.ts").read_text(encoding="utf-8")
    assert "export const messages: AppMessages = { hu, sk };" in (locales / "index.ts").read_text(encoding="utf-8")


def test_a_language_the_template_does_not_know_is_refused():
    problems = render.check({**VALUES, "languages": ["sk", "de"]})

    assert problems == ["Jazyk „de“ šablóna nepozná — pozná tieto: sk, hu, en."]


def test_every_starter_text_is_in_every_language_the_template_speaks():
    assert set(render.STARTER_TEXTS) == set(render.KNOWN_LANGUAGES)
    keys = {frozenset(texts) for texts in render.STARTER_TEXTS.values()}
    assert len(keys) == 1


def test_the_server_gets_one_catalog_of_its_own_sentences_per_language_and_hands_them_to_the_kit(tmp_path):
    """DEV-415 — the app's own server sentences in the person's language: an empty catalog per language to start, the
    kit reads them all."""
    render.render("nsv-standard", {**VALUES, "languages": ["sk", "hu", "en"]}, tmp_path)

    server_locales = tmp_path / "backend" / "app" / "locales"
    assert sorted(p.name for p in server_locales.iterdir()) == ["en.json", "hu.json", "sk.json"]
    assert {json.loads(p.read_text(encoding="utf-8")) == {} for p in server_locales.iterdir()} == {True}
    kit = (tmp_path / "backend" / "app" / "kit.py").read_text(encoding="utf-8")
    assert 'SERVER_MESSAGES = load_server_messages(Path(__file__).resolve().parent / "locales")' in kit
    assert "    server_messages=SERVER_MESSAGES,\n" in kit


def test_an_app_without_languages_gets_the_slovak_server_catalog(tmp_path):
    render.render("nsv-standard", VALUES, tmp_path)

    assert sorted(p.name for p in (tmp_path / "backend" / "app" / "locales").iterdir()) == ["sk.json"]
