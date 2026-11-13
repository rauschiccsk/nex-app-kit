"""Whom this installation serves and whether it is the test or the live one (DEV-377).

The cockpit that deploys the app writes both into the backend's environment on every deploy — ``NEX_CUSTOMER_NAME``
(the customer's name as the cockpit has it) and ``NEX_ENVIRONMENT`` (``uat`` or ``prod``). The frame shows them — in
the left panel, in the window's title, as the band of a UAT — and the installed app is named by them, so of many alike
windows each says whose it is. Without them (an app run outside the cockpit) the app looks as before.
"""

from __future__ import annotations

import os
from collections.abc import Mapping
from dataclasses import dataclass
from typing import Literal

CUSTOMER_KEY = "NEX_CUSTOMER_NAME"
ENVIRONMENT_KEY = "NEX_ENVIRONMENT"
Environment = Literal["uat", "prod"]
ENVIRONMENTS: tuple[Environment, ...] = ("uat", "prod")

#: The template's own icon — every app on the template has it (scaffold ``frontend/public/icon.svg``).
ICON = "/icon.svg"
#: The template's colours of the installed app's window (scaffold ``manifest.webmanifest``).
WINDOW_COLOUR = "#0f172a"


@dataclass(frozen=True)
class Installation:
    customer: str | None
    environment: Environment | None

    @classmethod
    def from_env(cls, environ: Mapping[str, str] = os.environ) -> Installation:
        customer = " ".join((environ.get(CUSTOMER_KEY) or "").split()) or None
        environment = (environ.get(ENVIRONMENT_KEY) or "").strip().lower()
        return cls(customer, environment if environment in ENVIRONMENTS else None)  # type: ignore[arg-type]

    def as_dict(self) -> dict[str, str | None]:
        return {"customer": self.customer, "environment": self.environment}

    def title(self, app_name: str) -> str:
        """„NEX Manager — MÁGERSTAV s.r.o. (UAT)“ — the same words the frame puts into the window's title."""
        title = f"{app_name} — {self.customer}" if self.customer else app_name
        return f"{title} (UAT)" if self.environment == "uat" else title

    def web_manifest(self, app_name: str) -> dict:
        """The installed app's description for this installation: named by its customer and environment, so the icon on
        the desktop, the task bar and Alt+Tab say whose it is. Its identity (``id``) stays the app's own."""
        name = self.title(app_name)
        return {
            "name": name,
            "short_name": name,
            "description": name,
            "id": "/",
            "start_url": "/",
            "scope": "/",
            "display": "standalone",
            "background_color": WINDOW_COLOUR,
            "theme_color": WINDOW_COLOUR,
            "lang": "sk",
            "icons": [
                {"src": ICON, "sizes": "any", "type": "image/svg+xml", "purpose": "any"},
                {"src": ICON, "sizes": "any", "type": "image/svg+xml", "purpose": "maskable"},
            ],
        }
