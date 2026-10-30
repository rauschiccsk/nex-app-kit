"""Errors of the template's server: a Slovak sentence for the person and a code for the logs (KIT-…).

Every refusal of the standard interface is a :class:`KitError`; :func:`kit_error_handler` turns it into the
FastAPI shape the frontend reads (``{"detail": "<sentence>", "code": "KIT-…"}``)."""

from __future__ import annotations

from fastapi import Request
from fastapi.responses import JSONResponse


class KitError(Exception):
    def __init__(self, status: int, code: str, message: str, headers: dict[str, str] | None = None) -> None:
        super().__init__(message)
        self.status = status
        self.code = code
        self.message = message
        self.headers = headers


def not_signed_in(message: str = "Nie si prihlásený.") -> KitError:
    return KitError(401, "KIT-AUTH-REQUIRED", message)


def forbidden(message: str = "Na túto akciu nemáš oprávnenie.") -> KitError:
    return KitError(403, "KIT-FORBIDDEN", message)


def not_found(message: str) -> KitError:
    return KitError(404, "KIT-NOT-FOUND", message)


def invalid(message: str, code: str = "KIT-INVALID") -> KitError:
    return KitError(422, code, message)


def conflict(message: str, code: str = "KIT-CONFLICT") -> KitError:
    return KitError(409, code, message)


def unavailable(message: str, code: str = "KIT-UNAVAILABLE") -> KitError:
    return KitError(503, code, message)


async def kit_error_handler(_request: Request, exc: Exception) -> JSONResponse:
    assert isinstance(exc, KitError)
    return JSONResponse({"detail": exc.message, "code": exc.code}, status_code=exc.status, headers=exc.headers)
