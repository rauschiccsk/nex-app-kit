"""Claude for an app of the template — through the Claude subscription only (DEV-460).

ICC calls Claude through its Claude subscription, never through a paid Anthropic API key (Knowledge Base
``icc/DECISIONS.md`` D-001, ``icc/ICC_STANDARDS.md`` „Claude MAX Only“). An app reaches it through Claude Code with the
installation's yearly subscription code (``claude setup-token``) in ``CLAUDE_CODE_OAUTH_TOKEN`` — the customer secret
the cockpit asks for. 21.11.2026 Orthodox Hermenia had written its own access with the ``anthropic`` library and an
API key; the subscription code was refused (401) and nothing that needs AI worked in PROD. Every app now calls Claude
here and writes no access of its own.

:func:`ask` runs one turn: a family of models (never a pinned version — Claude Code takes the newest), an optional
system prompt, an optional JSON schema the answer must follow, optional images, a time cap. No tools, no MCP, no
session kept, an empty working directory (no project instructions are read). :func:`check` tells whether the
subscription answers — what the app's screen shows. A failure is a :class:`ClaudeFailure` with a code and a sentence
for the person in their language.
"""

from __future__ import annotations

import base64
import json
import os
import shutil
import subprocess
import tempfile
from collections.abc import Mapping, Sequence
from dataclasses import dataclass, field
from typing import Any

from .i18n import DEFAULT_LANGUAGE, Params, tr

#: The families an app offers; Claude Code resolves each to its newest model.
FAMILIES: tuple[str, ...] = ("fable", "opus", "sonnet", "haiku")
#: Where the subscription code comes from (the cockpit writes it from the customer's card).
TOKEN_VARIABLE = "CLAUDE_CODE_OAUTH_TOKEN"
#: The binary; an image of the template installs it (scaffold ``backend/Dockerfile``).
CLAUDE_BIN = os.environ.get("CLAUDE_BIN", "claude")
#: How long one turn may take unless the caller says otherwise.
DEFAULT_TIMEOUT_SECONDS = 600
#: The turn :func:`check` asks — short, on the cheapest family.
CHECK_PROMPT = "Reply with the single word OK."
CHECK_TIMEOUT_SECONDS = 90

# The failure codes — the app may branch on them; the person reads the sentence.
TOKEN_MISSING = "token_missing"
TOKEN_REJECTED = "token_rejected"
LIMIT = "limit"
TIMEOUT = "timeout"
UNAVAILABLE = "unavailable"
BAD_ANSWER = "bad_answer"
#: DEV-490: Claude Code answered with another model than the asked family — it does not know the family (an older
#: Claude Code runs its own default instead: 22.11.2026 Orthodox Hermenia's „fable“ ran on Opus 4.8).
MODEL_UNAVAILABLE = "model_unavailable"

_SENTENCES = {
    TOKEN_MISSING: "kit.server.claudeTokenMissing",
    TOKEN_REJECTED: "kit.server.claudeTokenRejected",
    LIMIT: "kit.server.claudeLimit",
    TIMEOUT: "kit.server.claudeTimeout",
    UNAVAILABLE: "kit.server.claudeUnavailable",
    BAD_ANSWER: "kit.server.claudeBadAnswer",
    MODEL_UNAVAILABLE: "kit.server.claudeModelUnavailable",
}


class ClaudeFailure(Exception):
    """A turn that gave no usable answer: :attr:`code` (one of the codes above), :attr:`detail` for the log."""

    def __init__(self, code: str, detail: str = "", params: Params | None = None) -> None:
        self.code = code
        self.detail = detail[:500]
        self.params = params or {}
        super().__init__(f"{code}: {self.detail}" if self.detail else code)

    def sentence(self, language: str = DEFAULT_LANGUAGE) -> str:
        """What the person reads, in their language."""
        return tr(language, _SENTENCES[self.code], self.params)

    @property
    def key(self) -> str:
        """DEV-535 — the key of that sentence, for a refusal said in the language of the request (``KitError``)."""
        return _SENTENCES[self.code]


@dataclass(frozen=True)
class Image:
    """A picture on the turn's input — PNG, JPEG, GIF or WebP bytes."""

    data: bytes
    media_type: str = "image/png"


@dataclass(frozen=True)
class Answer:
    """One turn's answer: its text, the structured output when a schema was given, the exact model that answered and
    what the turn used (tokens and the subscription's own cost figure, for the app's record of AI use)."""

    text: str
    data: Any = None
    model: str | None = None
    usage: Mapping[str, int] = field(default_factory=dict)
    cost_usd: float = 0.0
    duration_ms: int | None = None


@dataclass(frozen=True)
class Status:
    """Whether the subscription answers: ``ok`` or a failure code, the model that answered, the sentence to show."""

    state: str
    model: str | None
    sentence: str | None


def token_present() -> bool:
    return bool(os.environ.get(TOKEN_VARIABLE, "").strip())


def ask(
    prompt: str,
    *,
    family: str = "sonnet",
    system: str | None = None,
    schema: Mapping[str, Any] | None = None,
    images: Sequence[Image] = (),
    timeout: float = DEFAULT_TIMEOUT_SECONDS,
) -> Answer:
    """One turn with Claude through the subscription. Raises :class:`ClaudeFailure`; ``ValueError`` for an unknown
    family (a programming error, not the person's)."""
    if family not in FAMILIES:
        raise ValueError(f"unknown Claude family {family!r}; one of {', '.join(FAMILIES)}")
    token = os.environ.get(TOKEN_VARIABLE, "").strip()
    if not token:
        raise ClaudeFailure(TOKEN_MISSING, f"{TOKEN_VARIABLE} is empty")
    binary = shutil.which(CLAUDE_BIN)
    if binary is None:
        raise ClaudeFailure(UNAVAILABLE, f"{CLAUDE_BIN} is not installed in the image")
    argv = [
        binary,
        "-p",
        "--input-format",
        "stream-json",
        "--output-format",
        "stream-json",
        "--verbose",
        "--no-session-persistence",
        "--tools",
        "",
        "--strict-mcp-config",
        "--mcp-config",
        '{"mcpServers":{}}',
        "--model",
        family,
    ]
    if system:
        argv += ["--system-prompt", system]
    if schema is not None:
        argv += ["--json-schema", json.dumps(schema)]
    content: list[dict[str, Any]] = [
        {
            "type": "image",
            "source": {"type": "base64", "media_type": img.media_type, "data": base64.b64encode(img.data).decode()},
        }
        for img in images
    ]
    content.append({"type": "text", "text": prompt})
    message = json.dumps({"type": "user", "message": {"role": "user", "content": content}})
    # An empty working directory and configuration of its own: no project instructions are read and nothing of the
    # turn stays behind.
    with (
        tempfile.TemporaryDirectory(prefix="kit-claude-") as cwd,
        tempfile.TemporaryDirectory(prefix="kit-claude-config-") as config,
    ):
        env = {
            **os.environ,
            "HOME": config,
            "CLAUDE_CONFIG_DIR": config,
            TOKEN_VARIABLE: token,
        }
        env.pop("ANTHROPIC_API_KEY", None)  # the subscription only — never a key that would take precedence
        try:
            done = subprocess.run(
                argv, cwd=cwd, env=env, input=message + "\n", capture_output=True, text=True, timeout=timeout
            )
        except subprocess.TimeoutExpired:
            raise ClaudeFailure(TIMEOUT, f"no answer in {timeout:.0f} s", {"seconds": int(timeout)}) from None
        except OSError as exc:
            raise ClaudeFailure(UNAVAILABLE, str(exc)) from exc
    return _answer(done, schema is not None, family)


def _result_event(stdout: str) -> dict[str, Any] | None:
    for line in reversed(stdout.strip().splitlines()):
        try:
            event = json.loads(line)
        except json.JSONDecodeError:
            continue
        if isinstance(event, dict) and event.get("type") == "result":
            return event
    return None


def _served(model_usage: dict[str, Any], family: str) -> str | None:
    """The model of the asked family among those that worked on the turn — Claude Code lists a helper model too
    (``claude-haiku-…`` beside ``claude-sonnet-5``); the first one listed is not the one that answered (DEV-490)."""
    return next((model for model in model_usage if family in model.lower()), None)


def _answer(done: subprocess.CompletedProcess, structured: bool, family: str) -> Answer:
    result = _result_event(done.stdout)
    if result is None:
        raise ClaudeFailure(UNAVAILABLE, f"exit {done.returncode}: {(done.stderr or done.stdout).strip()}")
    text = str(result.get("result") or "")
    if result.get("is_error") or done.returncode != 0:
        raise ClaudeFailure(_failure_code(result.get("api_error_status"), text), text)
    usage = result.get("usage") or {}
    model_usage = result.get("modelUsage") or {}
    model = _served(model_usage, family)
    if model_usage and model is None:
        # DEV-490: never a quiet substitute — the app runs the model it is set to, or says it cannot.
        raise ClaudeFailure(
            MODEL_UNAVAILABLE,
            f"asked for {family}, answered by {', '.join(model_usage)}",
            {"family": family.capitalize()},
        )
    answer = Answer(
        text=text,
        data=result.get("structured_output"),
        model=model,
        usage={
            key: int(usage.get(key) or 0)
            for key in ("input_tokens", "output_tokens", "cache_creation_input_tokens", "cache_read_input_tokens")
        },
        cost_usd=float(result.get("total_cost_usd") or 0.0),
        duration_ms=result.get("duration_ms"),
    )
    if structured and answer.data is None:
        raise ClaudeFailure(BAD_ANSWER, f"no structured output: {text}")
    return answer


def _failure_code(status: Any, text: str) -> str:
    lowered = text.lower()
    if status in (401, 403) or "not logged in" in lowered or "authenticate" in lowered:
        return TOKEN_REJECTED
    if status == 429 or "usage limit" in lowered or "rate limit" in lowered:
        return LIMIT
    return UNAVAILABLE


def check(language: str = DEFAULT_LANGUAGE, *, timeout: float = CHECK_TIMEOUT_SECONDS) -> Status:
    """Whether the subscription answers — one short turn on the cheapest family. Never raises."""
    try:
        answer = ask(CHECK_PROMPT, family="haiku", timeout=timeout)
    except ClaudeFailure as failure:
        return Status(failure.code, None, failure.sentence(language))
    return Status("ok", answer.model, None)
