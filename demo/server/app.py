"""The demo app's server — an app on the template exactly as an ICC app mounts it (DEV-252): the kit's standard
interface, one route of its own that asks the kit who is signed in, and the built frontend from the same address."""

from __future__ import annotations

import os
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import Depends, FastAPI
from fastapi.staticfiles import StaticFiles
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from nex_app_kit import AppKit, SettingDefinition, User, load_manifest

HERE = Path(__file__).resolve().parent
DEMO = HERE.parent

engine = create_engine(os.environ["DATABASE_URL"])
Session = sessionmaker(engine, expire_on_commit=False)

kit = AppKit(
    manifest=load_manifest(DEMO / "app.manifest.json"),
    version="0.2.0",
    session_factory=Session,
    settings=[
        SettingDefinition(
            key="search_limit",
            default="20",
            value_type="int",
            label="Počet výsledkov",
            description="Koľko výsledkov ukáže hľadanie na jednej stránke.",
            min=1,
            max=100,
        ),
        SettingDefinition(
            key="search_min_score",
            default="0.35",
            value_type="float",
            label="Najnižšia zhoda",
            description="Výsledok s menšou zhodou sa neukáže.",
            min=0,
            max=1,
        ),
        SettingDefinition(
            key="retention_days",
            default="365",
            value_type="int",
            label="Doba uchovania",
            description="Po tejto dobe sa záznam presunie do archívu.",
            unit="dní",
            min=30,
            max=3650,
        ),
    ],
    docs_dir=DEMO / "docs",
    # The demo is opened over plain http inside its own network; a real app keeps the default (https only).
    secure_cookies=os.environ.get("SECURE_COOKIES", "1") == "1",
)


@asynccontextmanager
async def lifespan(_app: FastAPI):
    kit.upgrade_database(engine)
    kit.bootstrap_admin(os.environ.get("ADMIN_INITIAL_PASSWORD"))
    if os.environ.get("DEMO_SEED") == "1":
        from seed import seed

        seed(Session)
    yield


app = FastAPI(title="NEX Ukážka", lifespan=lifespan)
kit.install(app)


@app.get("/api/v1/areas")
def areas(user: User = Depends(kit.current_user)) -> dict:
    return {"areas": ["Stavebné povolenia", "Zmluvy so subdodávateľmi", f"Osobné poznámky — {user.username}"]}


app.mount("/", StaticFiles(directory=DEMO / "dist", html=True), name="frontend")
