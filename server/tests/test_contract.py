"""DEV-252 — the server answers exactly the routes KONTRAKT.md names, each only where its column „kedy“ says:
„vždy“ in every app, „heslo“ with its own password, „NEX Manager“ when launched from it, „AI“ with agents."""

from __future__ import annotations

import re
from pathlib import Path

import pytest

from nex_app_kit import AppKit, ManagerLink

from .conftest import build_app, manifest

CONTRACT = Path(__file__).resolve().parents[2] / "KONTRAKT.md"
ROW = re.compile(r"^\| `(GET|POST|PUT|PATCH|DELETE) (/[^`]*)` \| ([^|]+) \|", re.MULTILINE)
PARAM = re.compile(r"\{[^}]+\}")


def contract() -> dict[str, str]:
    rows = {f"{m} {PARAM.sub('{}', p)}": when.strip() for m, p, when in ROW.findall(CONTRACT.read_text("utf-8"))}
    assert len(rows) >= 20
    return rows


def routes(kit: AppKit) -> set[str]:
    """What the mounted app answers, as FastAPI describes it (OpenAPI) — the app's own routes left out."""
    found = set()
    for path, operations in build_app(kit).openapi()["paths"].items():
        if not path.startswith("/api/v1/") or path.startswith("/api/v1/areas"):
            continue
        for method in operations:
            found.add(f"{method.upper()} {PARAM.sub('{}', path.removeprefix('/api/v1'))}")
    return found


LINK = ManagerLink(signing_key="k", module_slug="m", base_url="https://manager.invalid", api_key="a")


@pytest.mark.parametrize("auth", ["password", "manager"])
@pytest.mark.parametrize("ai", [False, True])
def test_the_server_answers_what_the_contract_names_and_nothing_else(factory, auth, ai):
    kit = AppKit(
        manifest=manifest(auth, ai),
        version="1",
        session_factory=factory,
        manager=LINK if auth == "manager" else None,
    )
    wanted = {"vždy"} | ({"heslo"} if auth == "password" else {"NEX Manager"}) | ({"AI"} if ai else set())

    assert routes(kit) == {route for route, when in contract().items() if when in wanted}


def test_every_row_says_when_in_a_known_word():
    assert set(contract().values()) <= {"vždy", "heslo", "NEX Manager", "AI"}
