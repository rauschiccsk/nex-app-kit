"""DEV-535 — Sprievodca: a path to the person's goal composed only from the app's catalog of steps, and the feedback
that tells how well it works. The Director 28.11.2026: „…aby človek ktorý nikdy nevidel a ani nevie načo slúži sadol
si k naším aplikáciám a začal používať.“ — and a layer that reports „ak Sprievodca napríklad nemá v katalógu všetko čo
potrebuje, alebo iný problém alebo nápad čo by sa dalo vylepšiť“."""

from __future__ import annotations

import pytest
from sqlalchemy import select

from nex_app_kit import claude
from nex_app_kit.manifest import ManifestError, manifest_from_data
from nex_app_kit.models import GuideEvent, GuideSession

COLLECTION = {"id": "c1", "label": "PSALTIRION"}


def catalog(upload_done: bool = False) -> list[dict]:
    """Three steps of an etalon collection, as the screen measures them for the collection c1."""
    return [
        {
            "id": "etalon.upload",
            "title": "Nahrať súbory",
            "hint": "Nahrajte preklad a predlohu.",
            "screen": "Etalón → celok → Súbory",
            "subject_kind": "collection",
            "state": {"c1": {"available": True, "done": upload_done}},
        },
        {
            "id": "etalon.confirm",
            "title": "Potvrdiť priradenie",
            "subject_kind": "collection",
            "requires": ["etalon.upload"],
            "state": {"c1": {"available": upload_done, "done": False}},
        },
        {
            "id": "etalon.import",
            "title": "Spustiť import",
            "subject_kind": "collection",
            "requires": ["etalon.confirm"],
            "state": {"c1": {"available": False, "done": False}},
        },
    ]


PATH = [
    {"id": "etalon.upload", "subject": "c1"},
    {"id": "etalon.confirm", "subject": "c1"},
    {"id": "etalon.import", "subject": "c1"},
]


class FakeClaude:
    """Claude through the subscription, answering in turn what the test gives it; every prompt is kept."""

    def __init__(self, *answers):
        self.answers = list(answers)
        self.calls: list[dict] = []

    def __call__(self, prompt, *, family="sonnet", system=None, schema=None, images=(), timeout=600):
        self.calls.append({"prompt": prompt, "family": family, "system": system, "schema": schema})
        answer = self.answers.pop(0)
        if isinstance(answer, Exception):
            raise answer
        return claude.Answer(
            text=answer if isinstance(answer, str) else "", data=answer if isinstance(answer, dict) else None
        )


@pytest.fixture
def signed_in(make_app):
    app = make_app()
    app.user("peter")
    assert app.login("peter").status_code == 200
    return app


def ask(app, message="Chcem nahrať maďarský žaltár a spustiť import.", session_id=None, steps=None, language=None):
    body = {
        "message": message,
        "catalog": catalog() if steps is None else steps,
        "subjects": {"collection": [COLLECTION]},
    }
    if session_id:
        body["session_id"] = session_id
    if language:
        body["language"] = language
    return app.client.post("/api/v1/guide/plan", json=body)


def events(app) -> list[tuple[str, str | None, str | None]]:
    """The events, sorted — the test clock stands still, so their time does not order them."""
    with app.db() as db:
        return sorted(
            ((e.kind, e.step_id, e.detail) for e in db.scalars(select(GuideEvent))),
            key=lambda e: (e[0], str(e[1]), str(e[2])),
        )


def test_an_app_that_switched_sprievodca_off_has_none(make_app):
    app = make_app(guide=False)
    app.user("peter")
    app.login("peter")
    assert ask(app).status_code == 404


def test_sprievodca_is_on_unless_the_manifest_says_false():
    base = {"template": "nsv-standard", "name": "N", "initials": "N", "auth": "password"}
    assert manifest_from_data(base).guide is True
    assert manifest_from_data({**base, "guide": False}).guide is False
    with pytest.raises(ManifestError, match="Sprievodca"):
        manifest_from_data({**base, "guide": "áno"})


def test_the_path_is_composed_from_the_catalog_and_kept(signed_in, monkeypatch):
    fake = FakeClaude({"kind": "plan", "text": "Nahráte súbory, potvrdíte ich a spustíte import.", "steps": PATH})
    monkeypatch.setattr(claude, "ask", fake)

    r = ask(signed_in)

    assert r.status_code == 200, r.text
    body = r.json()
    assert (body["kind"], body["text"]) == ("plan", "Nahráte súbory, potvrdíte ich a spustíte import.")
    assert [(s["id"], s["subject"], s["title"]) for s in body["steps"]] == [
        ("etalon.upload", "c1", "Nahrať súbory"),
        ("etalon.confirm", "c1", "Potvrdiť priradenie"),
        ("etalon.import", "c1", "Spustiť import"),
    ]
    assert '"etalon.upload"' in fake.calls[0]["prompt"] and "PSALTIRION" in fake.calls[0]["prompt"]
    assert fake.calls[0]["family"] == "sonnet" and fake.calls[0]["schema"]["required"] == ["kind", "text"]
    with signed_in.db() as db:
        session = db.scalars(select(GuideSession)).one()
        assert (session.status, session.goal, len(session.steps)) == (
            "planned",
            "Chcem nahrať maďarský žaltár a spustiť import.",
            3,
        )


@pytest.mark.parametrize(
    ("bad", "reason"),
    [
        ([{"id": "etalon.delete_all", "subject": "c1"}], "step 'etalon.delete_all' is not in the catalog"),
        ([{"id": "etalon.upload", "subject": "c9"}], "needs an existing collection"),
        (
            [{"id": "etalon.upload", "subject": "c1"}, {"id": "etalon.import", "subject": "c1"}],
            "needs 'etalon.confirm' done first",
        ),
    ],
)
def test_a_path_outside_the_catalog_is_refused_and_composed_again(signed_in, monkeypatch, bad, reason):
    fake = FakeClaude({"kind": "plan", "text": "zle", "steps": bad}, {"kind": "plan", "text": "dobre", "steps": PATH})
    monkeypatch.setattr(claude, "ask", fake)

    body = ask(signed_in).json()

    assert (body["kind"], body["text"], len(body["steps"])) == ("plan", "dobre", 3)
    assert reason in fake.calls[1]["prompt"]
    assert events(signed_in) == []


def test_a_path_refused_twice_is_not_guided_and_is_said(signed_in, monkeypatch):
    wrong = {"kind": "plan", "text": "zle", "steps": [{"id": "etalon.delete_all", "subject": "c1"}]}
    monkeypatch.setattr(claude, "ask", FakeClaude(wrong, wrong))

    body = ask(signed_in).json()

    assert (body["kind"], body["steps"], body["invalid"]) == ("question", [], True)
    assert events(signed_in) == [("invalid_plan", None, "step 'etalon.delete_all' is not in the catalog")]


def test_steps_already_done_are_left_out(signed_in, monkeypatch):
    monkeypatch.setattr(claude, "ask", FakeClaude({"kind": "plan", "text": "ok", "steps": PATH}))
    body = ask(signed_in, steps=catalog(upload_done=True)).json()
    assert [s["id"] for s in body["steps"]] == ["etalon.confirm", "etalon.import"]


def test_a_goal_the_catalog_has_no_step_for_is_reported(signed_in, monkeypatch):
    missing = {"kind": "missing", "text": "Chýba krok na export slovníka do XLSX."}
    monkeypatch.setattr(claude, "ask", FakeClaude(missing))

    body = ask(signed_in, message="Chcem slovník v XLSX.").json()

    assert (body["kind"], body["text"]) == ("missing", "Chýba krok na export slovníka do XLSX.")
    assert events(signed_in) == [("missing_step", None, "Chýba krok na export slovníka do XLSX.")]


def test_an_app_without_a_catalog_reports_it_and_asks_nobody(signed_in, monkeypatch):
    fake = FakeClaude()
    monkeypatch.setattr(claude, "ask", fake)
    body = ask(signed_in, steps=[]).json()
    assert (body["kind"], body["empty_catalog"]) == ("missing", True)
    assert fake.calls == [] and events(signed_in) == [("missing_step", None, "the catalog is empty")]


def test_sprievodca_asks_back_and_the_answer_continues_the_same_conversation(signed_in, monkeypatch):
    fake = FakeClaude(
        {"kind": "question", "text": "Do ktorého celku?"},
        {"kind": "plan", "text": "ok", "steps": PATH},
    )
    monkeypatch.setattr(claude, "ask", fake)

    first = ask(signed_in, message="Chcem nahrať žaltár.").json()
    second = ask(signed_in, message="PSALTIRION", session_id=first["session_id"]).json()

    assert (first["kind"], second["kind"], second["session_id"]) == ("question", "plan", first["session_id"])
    assert "person: Chcem nahrať žaltár.\nguide: Do ktorého celku?\nperson: PSALTIRION" in fake.calls[1]["prompt"]


def test_the_path_is_said_in_the_language_asked(make_app, monkeypatch):
    app = make_app(languages=["sk", "hu"])
    app.user("peter")
    app.login("peter")
    fake = FakeClaude({"kind": "question", "text": "?"})
    monkeypatch.setattr(claude, "ask", fake)
    ask(app, language="hu")
    assert "the code hu" in fake.calls[0]["system"]


def test_claude_out_of_reach_is_said_not_crashed(signed_in, monkeypatch):
    monkeypatch.setattr(claude, "ask", FakeClaude(claude.ClaudeFailure(claude.LIMIT, "limit")))
    r = ask(signed_in)
    assert (r.status_code, r.json()["code"]) == (503, "KIT-GUIDE-CLAUDE")


def planned(app, monkeypatch, *more) -> str:
    monkeypatch.setattr(claude, "ask", FakeClaude({"kind": "plan", "text": "ok", "steps": PATH}, *more))
    return ask(app).json()["session_id"]


def test_a_finished_guiding_is_recorded(signed_in, monkeypatch):
    session = planned(signed_in, monkeypatch)
    url = f"/api/v1/guide/sessions/{session}/progress"
    assert signed_in.client.post(url, json={"status": "guiding", "current_step": 1}).status_code == 200
    assert signed_in.client.post(url, json={"status": "done", "current_step": 3}).json()["status"] == "done"
    assert events(signed_in) == [("finished", None, "3 steps")]


def test_a_stopped_guiding_says_where_and_why_and_sprievodca_notes_what_would_have_helped(signed_in, monkeypatch):
    session = planned(signed_in, monkeypatch, "Tlačidlo Potvrdiť priradenie je sivé, kým nie sú súbory nahraté.")
    url = f"/api/v1/guide/sessions/{session}/progress"

    assert signed_in.client.post(url, json={"status": "stopped", "current_step": 1}).status_code == 422
    r = signed_in.client.post(url, json={"status": "stopped", "current_step": 1, "reason": "unclear"})

    assert r.json()["stop_reason"] == "unclear"
    assert events(signed_in) == [
        ("note", "etalon.confirm", "Tlačidlo Potvrdiť priradenie je sivé, kým nie sú súbory nahraté."),
        ("stopped", "etalon.confirm", "unclear"),
    ]


def test_the_screen_reports_a_stuck_step_a_missing_button_and_an_idea(signed_in, monkeypatch):
    session = planned(
        signed_in, monkeypatch, "Krok potrebuje jasnejšiu vetu.", "V katalógu chýba tlačidlo na obrazovke."
    )
    post = signed_in.client.post

    assert (
        post(
            "/api/v1/guide/events", json={"kind": "stuck", "session_id": session, "step_id": "etalon.upload"}
        ).status_code
        == 201
    )
    assert post("/api/v1/guide/events", json={"kind": "idea", "detail": "Nech ukáže aj odhad času."}).status_code == 201
    assert (
        post(
            "/api/v1/guide/events", json={"kind": "no_target", "session_id": session, "step_id": "etalon.confirm"}
        ).status_code
        == 201
    )
    assert post("/api/v1/guide/events", json={"kind": "idea", "detail": "  "}).status_code == 422
    assert post("/api/v1/guide/events", json={"kind": "finished", "session_id": session}).status_code == 422

    assert events(signed_in) == [
        ("idea", None, "Nech ukáže aj odhad času."),
        ("no_target", "etalon.confirm", None),
        ("note", "etalon.confirm", "V katalógu chýba tlačidlo na obrazovke."),
        ("note", "etalon.upload", "Krok potrebuje jasnejšiu vetu."),
        ("stuck", "etalon.upload", None),
    ]


def test_a_person_reaches_only_their_own_conversations(signed_in, monkeypatch):
    session = planned(signed_in, monkeypatch)
    signed_in.user("anna")
    other = signed_in.other_browser()
    signed_in.login("anna", client=other)
    assert other.post(f"/api/v1/guide/sessions/{session}/rating", json={"rating": "up"}).status_code == 404
    assert other.post("/api/v1/guide/events", json={"kind": "stuck", "session_id": session}).status_code == 404


def test_the_rating_and_the_admin_s_overview(signed_in, monkeypatch):
    session = planned(signed_in, monkeypatch, "Krok potrebuje jasnejšiu vetu.")
    rated = signed_in.client.post(
        f"/api/v1/guide/sessions/{session}/rating", json={"rating": "down", "comment": "Pomalé."}
    )
    assert (rated.json()["rating"], rated.json()["comment"]) == ("down", "Pomalé.")
    signed_in.client.post(
        "/api/v1/guide/events", json={"kind": "stuck", "session_id": session, "step_id": "etalon.upload"}
    )

    assert signed_in.client.get("/api/v1/guide/feedback").status_code == 403
    signed_in.user("spravca", role="admin")
    admin = signed_in.other_browser()
    signed_in.login("spravca", client=admin)
    overview = admin.get("/api/v1/guide/feedback").json()

    assert overview["totals"] == {
        "sessions": 1, "done": 0, "stopped": 0, "missing": 0, "guiding": 1, "rated_up": 0, "rated_down": 1,
    }  # fmt: skip
    assert sorted((e["kind"], e["goal"]) for e in overview["events"]) == [
        ("note", "Chcem nahrať maďarský žaltár a spustiť import."),
        ("stuck", "Chcem nahrať maďarský žaltár a spustiť import."),
    ]
