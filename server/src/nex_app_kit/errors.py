"""Errors of the template's server: a sentence for the person, in their language, and a code for the logs (KIT-…).

Every refusal of the standard interface is a :class:`KitError`, raised with the key of its sentence (DEV-394;
``locales/``) and its values; :func:`kit_error_handler` turns it into the FastAPI shape the frontend reads
(``{"detail": "<sentence>", "code": "KIT-…"}``), the sentence in the language the request asks for
(``Accept-Language``). The exception's own message is the Slovak sentence — what the logs read. A sentence that is no
key (an app's own refusal written as a sentence) is said as it is.
"""

from __future__ import annotations

from fastapi import Request
from fastapi.responses import JSONResponse

from .i18n import DEFAULT_LANGUAGE, LANGUAGES, Params, language_of, tr


class KitError(Exception):
    def __init__(
        self,
        status: int,
        code: str,
        message: str,
        headers: dict[str, str] | None = None,
        params: Params | None = None,
    ) -> None:
        super().__init__(tr(DEFAULT_LANGUAGE, message, params))
        self.status = status
        self.code = code
        self.key = message
        self.params = dict(params or {})
        self.message = tr(DEFAULT_LANGUAGE, message, params)
        self.headers = headers

    def said_in(self, language: str) -> str:
        return tr(language, self.key, self.params)


def not_signed_in(message: str = "kit.server.notSignedIn") -> KitError:
    return KitError(401, "KIT-AUTH-REQUIRED", message)


def forbidden(message: str = "kit.server.forbidden") -> KitError:
    return KitError(403, "KIT-FORBIDDEN", message)


def not_found(message: str, params: Params | None = None) -> KitError:
    return KitError(404, "KIT-NOT-FOUND", message, params=params)


def invalid(message: str, code: str = "KIT-INVALID", params: Params | None = None) -> KitError:
    return KitError(422, code, message, params=params)


def conflict(message: str, code: str = "KIT-CONFLICT", params: Params | None = None) -> KitError:
    return KitError(409, code, message, params=params)


def unavailable(message: str, code: str = "KIT-UNAVAILABLE", params: Params | None = None) -> KitError:
    return KitError(503, code, message, params=params)


def request_language(request: Request) -> str:
    """The language the request asks for, among the app's (``AppKit.install`` keeps them on the app)."""
    state = request.app.state
    offered = getattr(state, "nex_languages", LANGUAGES)
    return language_of(request.headers.get("accept-language"), offered, getattr(state, "nex_language", None))


async def kit_error_handler(request: Request, exc: Exception) -> JSONResponse:
    assert isinstance(exc, KitError)
    return JSONResponse(
        {"detail": exc.said_in(request_language(request)), "code": exc.code},
        status_code=exc.status,
        headers=exc.headers,
    )
