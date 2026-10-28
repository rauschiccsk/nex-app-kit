"""Fixtures of the server's tests — a real Postgres (docker-compose.test.yml), the kit's migrations run once, every
table emptied after each test, and an app built around the kit the way an ICC app builds it."""

from __future__ import annotations

import os
import uuid
from collections.abc import Callable, Iterator
from dataclasses import dataclass, field
from datetime import UTC, datetime, timedelta
from pathlib import Path

import pytest
from fastapi import Depends, FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session, sessionmaker

from nex_app_kit import AppKit, Identity, ManagerLink, SettingDefinition, User, manifest_from_data
from nex_app_kit.passwords import hash_password

TEST_ROUNDS = 4
KIT_TABLES = (
    "kit_user_layouts",
    "kit_agent_settings",
    "kit_system_settings",
    "kit_used_launch_tokens",
    "kit_sessions",
    "kit_users",
)
SIGNING_KEY = "test-launch-signing-key-not-a-secret"
MODULE = "nex-skuska"
DEPLOY = "zakaznik"


@pytest.fixture(scope="session")
def engine() -> Iterator[Engine]:
    url = os.environ.get("KIT_TEST_DATABASE_URL")
    if not url:
        pytest.fail(
            "KIT_TEST_DATABASE_URL chýba — skúšky servera bežia na Postgrese: "
            "docker compose -f server/docker-compose.test.yml run --rm --build test"
        )
    eng = create_engine(url)
    with eng.begin() as connection:
        connection.execute(text("DROP SCHEMA public CASCADE"))
        connection.execute(text("CREATE SCHEMA public"))
    yield eng
    eng.dispose()


@pytest.fixture(scope="session")
def migrated(engine: Engine) -> Engine:
    password_kit(sessionmaker(engine)).upgrade_database(engine)
    return engine


@pytest.fixture(autouse=True)
def _clean(migrated: Engine) -> Iterator[None]:
    yield
    with migrated.begin() as connection:
        connection.execute(text(f"TRUNCATE {', '.join(KIT_TABLES)} CASCADE"))


@pytest.fixture
def factory(migrated: Engine) -> sessionmaker:
    return sessionmaker(migrated, expire_on_commit=False)


class Clock:
    def __init__(self) -> None:
        self.now = datetime(2026, 10, 28, 12, 0, tzinfo=UTC)

    def __call__(self) -> datetime:
        return self.now

    def advance(self, **delta: float) -> None:
        self.now += timedelta(**delta)


def manifest(auth: str = "password", ai: bool = False):
    data = {"template": "nsv-standard", "name": "NEX Skúška", "initials": "NS", "auth": auth}
    if ai:
        data["ai"] = {"roles": [{"id": "assistant", "label": "Asistent"}, {"id": "reviewer", "label": "Kontrolór"}]}
    return manifest_from_data(data)


def password_kit(factory, **kwargs) -> AppKit:
    return AppKit(
        manifest=manifest("password", kwargs.pop("ai", False)),
        version="1.2.3",
        session_factory=factory,
        bcrypt_rounds=TEST_ROUNDS,
        **kwargs,
    )


@dataclass
class FakeManager:
    """NEX Manager as the app sees it: who is a person, and whether it answers at all."""

    people: dict[str, Identity] = field(default_factory=dict)
    down: bool = False
    asked: list[str] = field(default_factory=list)

    def __call__(self, login: str) -> Identity | None:
        from nex_app_kit import ManagerUnavailable

        self.asked.append(login)
        if self.down:
            raise ManagerUnavailable("NEX Manager neodpovedá.")
        return self.people.get(login)

    def add(self, login: str, **changes) -> Identity:
        values = dict(
            login=login,
            first_name="Ján",
            last_name="Novák",
            email=f"{login}@firma.sk",
            role="user",
            is_active=True,
            must_change_password=False,
            token_version=1,
            has_module_access=True,
        )
        values.update(changes)
        self.people[login] = Identity(**values)
        return self.people[login]


@dataclass
class App:
    client: TestClient
    kit: AppKit
    clock: Clock
    factory: sessionmaker
    manager: FakeManager | None = None

    def user(self, username: str, password: str = "heslo-123", **changes) -> User:
        values = dict(
            username=username,
            email=f"{username}@firma.sk",
            password_hash=hash_password(password, TEST_ROUNDS),
            role="user",
            is_active=True,
            must_change_password=False,
            failed_logins=0,
            source="local",
            created_at=self.clock.now,
            updated_at=self.clock.now,
        )
        values.update(changes)
        with self.factory() as db:
            user = User(**values)
            db.add(user)
            db.commit()
            return user

    def login(self, username: str, password: str = "heslo-123", client: TestClient | None = None):
        return (client or self.client).post("/api/v1/auth/login", json={"username": username, "password": password})

    def other_browser(self) -> TestClient:
        return TestClient(self.client.app, base_url="https://testserver")

    def db(self) -> Session:
        return self.factory()


def build_app(kit: AppKit) -> FastAPI:
    app = FastAPI()
    kit.install(app)

    # The app's own route — it asks the kit who is signed in, as every app on the template does.
    @app.get("/api/v1/areas")
    def areas(user: User = Depends(kit.current_user)) -> dict:
        return {"for": user.username}

    @app.delete("/api/v1/areas/{area_id}")
    def remove_area(area_id: str, _admin: User = Depends(kit.require_admin)) -> dict:
        return {"removed": area_id}

    return app


@pytest.fixture
def make_app(factory: sessionmaker) -> Callable[..., App]:
    def make(
        auth: str = "password",
        ai: bool = False,
        settings: tuple[SettingDefinition, ...] = (),
        docs_dir: Path | None = None,
        deploy: str | None = DEPLOY,
    ) -> App:
        clock = Clock()
        fake = FakeManager() if auth == "manager" else None
        link = (
            ManagerLink(
                signing_key=SIGNING_KEY,
                module_slug=MODULE,
                base_url="https://manager.invalid",
                api_key="test-api-key",
                deploy_slug=deploy,
                identity=fake,
            )
            if fake is not None
            else None
        )
        kit = AppKit(
            manifest=manifest(auth, ai),
            version="1.2.3",
            session_factory=factory,
            settings=settings,
            docs_dir=docs_dir,
            manager=link,
            clock=clock,
            bcrypt_rounds=TEST_ROUNDS,
        )
        client = TestClient(build_app(kit), base_url="https://testserver")
        return App(client=client, kit=kit, clock=clock, factory=factory, manager=fake)

    return make


def new_id() -> str:
    return str(uuid.uuid4())
