"""The server of the app. The template's standard interface comes from app.kit; the app's own routers go below."""

from __future__ import annotations

import os
from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.kit import kit, manifest


@asynccontextmanager
async def lifespan(_app: FastAPI):
    # Own password: the first admin „admin“ from ADMIN_INITIAL_PASSWORD, with a password change due.
    kit.bootstrap_admin(os.environ.get("ADMIN_INITIAL_PASSWORD"))
    yield


app = FastAPI(title=manifest.name, lifespan=lifespan)
kit.install(app)

# The app's own routes:
#   from app.routes import areas
#   app.include_router(areas.router, prefix="/api/v1")
