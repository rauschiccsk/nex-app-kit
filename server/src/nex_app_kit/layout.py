"""The bounds of the person's own layout — one place for the table's CHECK, the server's refusal and the
frontend's handle (sent in every answer as ``limits``)."""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class Limit:
    min: int
    max: int
    default: int


#: The cockpit's bounds (DEV-82): narrow enough for a laptop, wide enough for long names.
SIDEBAR_WIDTH = Limit(min=180, max=360, default=224)
