"""DEV-460 — an app calls Claude through the subscription (Claude Code, the yearly code), never with an API key.

21.11.2026 Orthodox Hermenia had written its own access with the ``anthropic`` library and an Anthropic API key; the
subscription code on the customer's card was refused (401) and nothing that needs AI worked in PROD. The template now
carries the one access every app uses. The tests run a stand-in ``claude`` that answers as Claude Code does (its
``stream-json`` result line, measured on Claude Code 2.1.325) and records what it was given.
"""

from __future__ import annotations

import json
import os

import pytest

from nex_app_kit import claude

OK = {
    "type": "result",
    "subtype": "success",
    "is_error": False,
    "api_error_status": None,
    "result": '{"city":"Bratislava"}',
    "structured_output": {"city": "Bratislava"},
    "total_cost_usd": 0.0008,
    "duration_ms": 1500,
    "usage": {"input_tokens": 2, "output_tokens": 55, "cache_creation_input_tokens": 10, "cache_read_input_tokens": 0},
    "modelUsage": {"claude-haiku-5-5": {}},
}
REJECTED = {
    "type": "result",
    "subtype": "success",
    "is_error": True,
    "api_error_status": 401,
    "result": "Failed to authenticate. API Error: 401 OAuth access token is invalid.",
}


@pytest.fixture
def fake(monkeypatch):
    """A stand-in for Claude Code: records what it was given and prints the result line Claude Code prints. (The test
    database's ``/tmp`` forbids running files, so the process itself is stood in for, not the binary.)"""
    given: dict = {}
    monkeypatch.setattr(claude.shutil, "which", lambda name: f"/usr/local/bin/{name}")
    monkeypatch.setenv(claude.TOKEN_VARIABLE, "the-yearly-code")
    monkeypatch.setenv("ANTHROPIC_API_KEY", "a-key-that-must-not-be-used")

    def answer(result: dict, exit_code: int = 0) -> dict:
        def run(argv, *, cwd, env, input, capture_output, text, timeout):
            given.update(argv=argv[1:], stdin=input, env=env, cwd=os.listdir(cwd))
            lines = json.dumps({"type": "system", "subtype": "init"}) + "\n" + json.dumps(result) + "\n"
            return claude.subprocess.CompletedProcess(argv, exit_code, lines, "")

        monkeypatch.setattr(claude.subprocess, "run", run)
        return given

    return answer


def test_a_turn_goes_through_the_subscription_with_the_family_the_schema_and_no_tools(fake):
    record = fake(OK)

    answer = claude.ask("Capital?", family="haiku", system="Be brief.", schema={"type": "object"})

    assert (answer.data, answer.model, answer.cost_usd) == ({"city": "Bratislava"}, "claude-haiku-5-5", 0.0008)
    assert answer.usage == {
        "input_tokens": 2,
        "output_tokens": 55,
        "cache_creation_input_tokens": 10,
        "cache_read_input_tokens": 0,
    }
    given = record
    argv = given["argv"]
    assert argv[argv.index("--model") + 1] == "haiku"
    assert argv[argv.index("--tools") + 1] == ""
    assert argv[argv.index("--json-schema") + 1] == '{"type": "object"}'
    assert argv[argv.index("--system-prompt") + 1] == "Be brief."
    assert "--no-session-persistence" in argv and "--strict-mcp-config" in argv
    assert given["env"]["CLAUDE_CODE_OAUTH_TOKEN"] == "the-yearly-code"
    assert "ANTHROPIC_API_KEY" not in given["env"], "never an API key — it would take precedence over the code"
    assert given["env"]["HOME"] == given["env"]["CLAUDE_CONFIG_DIR"]
    assert given["cwd"] == [], "an empty working directory: no project instructions are read"


def test_images_go_on_the_turns_input_beside_the_prompt(fake):
    record = fake(OK)

    claude.ask("What colour?", family="sonnet", images=[claude.Image(b"\x89PNG", "image/png")])

    content = json.loads(record["stdin"])["message"]["content"]
    assert content[0] == {"type": "image", "source": {"type": "base64", "media_type": "image/png", "data": "iVBORw=="}}
    assert content[1] == {"type": "text", "text": "What colour?"}


def test_without_the_code_nothing_runs_and_the_sentence_says_where_it_goes(fake, monkeypatch):
    record = fake(OK)
    monkeypatch.setenv(claude.TOKEN_VARIABLE, " ")

    with pytest.raises(claude.ClaudeFailure) as failure:
        claude.ask("x")

    assert failure.value.code == claude.TOKEN_MISSING
    assert failure.value.sentence() == (
        "Ročný kód predplatného Claude nie je zadaný. Správca ho zadá pri zákazníkovi v kokpite a aplikáciu nasadí "
        "znova."
    )
    assert record == {}, "nothing ran"


def test_a_refused_code_is_said_as_refused_in_the_persons_language(fake):
    fake(REJECTED, exit_code=1)

    with pytest.raises(claude.ClaudeFailure) as failure:
        claude.ask("x")

    assert failure.value.code == claude.TOKEN_REJECTED
    assert failure.value.sentence("en").startswith("Claude refused the yearly subscription code")


@pytest.mark.parametrize(
    ("status", "text", "code"),
    [
        (429, "API Error: 429", claude.LIMIT),
        (None, "Claude AI usage limit reached", claude.LIMIT),
        (None, "Not logged in · Please run /login", claude.TOKEN_REJECTED),
        (500, "API Error: 500 Overloaded", claude.UNAVAILABLE),
    ],
)
def test_each_failure_has_its_code(fake, status, text, code):
    fake({**REJECTED, "api_error_status": status, "result": text}, exit_code=1)

    with pytest.raises(claude.ClaudeFailure) as failure:
        claude.ask("x")

    assert failure.value.code == code


def test_an_answer_without_the_asked_structure_is_a_bad_answer(fake):
    fake({**OK, "structured_output": None})

    with pytest.raises(claude.ClaudeFailure) as failure:
        claude.ask("x", schema={"type": "object"})

    assert failure.value.code == claude.BAD_ANSWER


def test_a_turn_over_its_time_is_stopped_and_said(fake, monkeypatch):
    fake(OK)
    monkeypatch.setattr(claude.subprocess, "run", _too_long)

    with pytest.raises(claude.ClaudeFailure) as failure:
        claude.ask("x", timeout=3)

    assert failure.value.code == claude.TIMEOUT
    assert failure.value.sentence() == "Claude neodpovedal do 3 s. Skúste to znova."


def _too_long(*args, **kwargs):
    raise claude.subprocess.TimeoutExpired(args[0], kwargs["timeout"])


def test_a_family_is_never_a_pinned_version():
    with pytest.raises(ValueError):
        claude.ask("x", family="claude-opus-4-1")


def test_check_says_ok_with_the_model_or_the_sentence(fake):
    fake(OK)
    assert claude.check() == claude.Status("ok", "claude-haiku-5-5", None)

    fake(REJECTED, exit_code=1)
    status = claude.check("hu")
    assert (status.state, status.model) == (claude.TOKEN_REJECTED, None)
    assert status.sentence.startswith("A Claude elutasította")
