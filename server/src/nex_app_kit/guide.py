"""DEV-535 — Sprievodca: the guide of an app on the template. A person writes what they want to do; Sprievodca looks at
the app's state, asks back when the goal is unclear, says the steps in short and leads the person to the goal step by
step — at the start, during the work and at its end. The person always clicks; Sprievodca only shows the way.

The Director 28.11.2026: „…aby človek ktorý nikdy nevidel a ani nevie načo slúži sadol si k naším aplikáciám a začal
používať.“ His proposal (a chat „Sprievodca“ in place of „Ako začať“, a path composed for the goal) and the plan of four
stages: „súhlasím“.

**A path only from the catalog.** The screen sends the app's catalog of steps — each with what it does, its screen,
what it needs first, the object it applies to, and whether the screen measured it can be done and is done — with the
objects there are. Claude composes the path from those steps and nothing else; :func:`check_path` refuses a step that
is not in the catalog, an object that does not exist, or an order that skips what a step needs, and Claude is given the
reason once to compose again. Guiding itself is the screen's: no AI per step.

**Feedback.** Every session and event is kept (``kit_guide_sessions``, ``kit_guide_events``): a goal the catalog has no
path for (``missing_step``), a path Claude could not compose right (``invalid_plan``), a person stuck on a step, a step
the app did not see done, a step skipped, a guiding stopped (and why) or finished, an idea, a rating; when guiding did
not go well, Sprievodca writes one sentence of what would have helped (``note``). The admin reads it all in Settings.

Mounted unless the manifest says ``"guide": false``.
"""

from __future__ import annotations

import json
import logging
import uuid
from datetime import datetime
from typing import TYPE_CHECKING, Any, Literal

from fastapi import APIRouter, BackgroundTasks, Depends
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.orm import Session as Db

from . import claude
from .errors import KitError, not_found
from .models import GuideEvent, GuideSession, User

if TYPE_CHECKING:
    from .kit import AppKit

logger = logging.getLogger(__name__)

#: The family that composes the path, and the one that writes the short note when guiding did not go well.
PLAN_FAMILY = "sonnet"
NOTE_FAMILY = "haiku"
PLAN_TIMEOUT_SECONDS = 180
NOTE_TIMEOUT_SECONDS = 90
MESSAGE_MAX_CHARS = 2000
CATALOG_MAX_STEPS = 400
#: Why a person stopped the guiding — one click each on the screen.
STOP_REASONS = ("unclear", "did_otherwise", "not_needed")
#: What the screen reports by itself during guiding, and the idea a person writes.
SCREEN_EVENTS = ("stuck", "not_detected", "no_target", "skipped", "idea")
#: Events after which Sprievodca writes what would have helped.
NOTE_AFTER = ("stuck", "not_detected", "no_target", "stopped")

SYSTEM = (
    "You are Sprievodca, the guide inside the application {app}. A person tells you what they want to do. You get the "
    "application's catalog of steps — the only things the application can guide through. Each step has an id, a title, "
    "one sentence of what the person does, the screen, the steps it needs done first, the kind of object it applies to "
    "and, for each object, whether it can be done now and whether it is already done; you also get the objects there "
    "are.\n"
    "Compose the shortest path to the person's goal using ONLY steps of the catalog, in an order where every step's "
    "required steps are done or come earlier for the same object. Leave out steps already done. A step that applies to "
    'an object names it by its id in "subject"; other steps have "subject": null.\n'
    'If the goal needs something no step of the catalog does, answer kind "missing" and say in one sentence exactly '
    'which step is missing. If the goal or the object is unclear, ask ONE short question, kind "question". Otherwise '
    'answer kind "plan": "text" says the steps in one to three short sentences a newcomer understands, "steps" lists '
    "them. Write the text in the language with the code {language}. Never invent a step id or an object id."
)

PLAN_SCHEMA: dict[str, Any] = {
    "type": "object",
    "properties": {
        "kind": {"type": "string", "enum": ["plan", "question", "missing"]},
        "text": {"type": "string"},
        "steps": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {"id": {"type": "string"}, "subject": {"type": ["string", "null"]}},
                "required": ["id"],
            },
        },
    },
    "required": ["kind", "text"],
}


class StepState(BaseModel):
    available: bool = True
    done: bool = False


class CatalogStep(BaseModel):
    id: str = Field(min_length=1, max_length=80)
    title: str
    hint: str = ""
    screen: str = ""
    #: The kind of object the step applies to (``collection``) — ``None`` for a step of the whole app.
    subject_kind: str | None = None
    requires: list[str] = Field(default_factory=list)
    #: What the screen measured: ``{"": state}`` for a step of the whole app, ``{object id: state}`` otherwise.
    state: dict[str, StepState] = Field(default_factory=dict)


class GuideSubject(BaseModel):
    id: str
    label: str


class PlanBody(BaseModel):
    session_id: str | None = None
    #: The goal, or the answer to Sprievodca's question in the same session.
    message: str
    language: str | None = None
    catalog: list[CatalogStep] = Field(default_factory=list)
    subjects: dict[str, list[GuideSubject]] = Field(default_factory=dict)


class ProgressBody(BaseModel):
    status: Literal["guiding", "done", "stopped"]
    current_step: int = 0
    reason: str | None = None


class EventBody(BaseModel):
    kind: str
    session_id: str | None = None
    step_id: str | None = None
    detail: str | None = None


class RatingBody(BaseModel):
    rating: Literal["up", "down"]
    comment: str | None = None


def _state(step: CatalogStep, subject: str | None) -> StepState:
    return step.state.get(subject or "", StepState())


def check_path(
    catalog: dict[str, CatalogStep], subjects: dict[str, list[GuideSubject]], raw: list[dict[str, Any]]
) -> tuple[list[dict[str, Any]], str | None]:
    """The path as it will be guided — steps already done left out — or why it cannot be (told to Claude)."""
    path: list[dict[str, Any]] = []
    placed: set[tuple[str, str | None]] = set()
    for one in raw:
        step_id, subject = str(one.get("id", "")), one.get("subject") or None
        step = catalog.get(step_id)
        if step is None:
            return [], f"step {step_id!r} is not in the catalog"
        if step.subject_kind:
            if subject not in {s.id for s in subjects.get(step.subject_kind, [])}:
                return [], f"step {step_id!r} needs an existing {step.subject_kind} as its subject, not {subject!r}"
        else:
            subject = None
        if _state(step, subject).done:
            continue
        for needed in step.requires:
            before = catalog.get(needed)
            if before is None:
                continue
            on = subject if before.subject_kind and before.subject_kind == step.subject_kind else None
            if not _state(before, on).done and (needed, on) not in placed:
                return [], f"step {step_id!r} needs {needed!r} done first"
        placed.add((step_id, subject))
        path.append({"id": step_id, "subject": subject, "title": step.title})
    return path, None


def _catalog_text(body: PlanBody) -> str:
    steps = [
        {
            "id": s.id,
            "title": s.title,
            "what_to_do": s.hint,
            "screen": s.screen,
            "applies_to": s.subject_kind,
            "requires": s.requires,
            "state": {key or "app": value.model_dump() for key, value in s.state.items()},
        }
        for s in body.catalog
    ]
    objects = {kind: [o.model_dump() for o in found] for kind, found in body.subjects.items()}
    return json.dumps({"steps": steps, "objects": objects}, ensure_ascii=False)


def _session_read(session: GuideSession) -> dict[str, Any]:
    return {
        "id": str(session.id),
        "goal": session.goal,
        "status": session.status,
        "steps": session.steps,
        "current_step": session.current_step,
        "stop_reason": session.stop_reason,
        "rating": session.rating,
        "comment": session.comment,
        "created_at": session.created_at.isoformat() if session.created_at else None,
    }


def build_guide_router(kit: AppKit) -> APIRouter:
    router = APIRouter()
    db_dep = Depends(kit.db)

    def language_for(asked: str | None, user: User) -> str:
        offered = kit.manifest.languages
        for code in (asked, user.language):
            if code in offered:
                return code
        return offered[0]

    def own(db: Db, session_id: str, user: User) -> GuideSession:
        try:
            found = db.get(GuideSession, uuid.UUID(session_id))
        except ValueError:
            found = None
        if found is None or found.user_id != user.id:
            raise not_found("kit.server.guide.sessionNotFound")
        return found

    def record(db: Db, kind: str, user: User | None, session: GuideSession | None = None, **values: Any) -> None:
        db.add(
            GuideEvent(
                kind=kind,
                session_id=session.id if session else None,
                user_id=user.id if user else None,
                created_at=kit.clock(),
                **values,
            )
        )

    def compose(body: PlanBody, transcript: list[dict[str, str]], language: str, retry: str | None) -> dict[str, Any]:
        conversation = "\n".join(f"{line['by']}: {line['text']}" for line in transcript)
        prompt = f"Catalog and objects (JSON):\n{_catalog_text(body)}\n\nConversation so far:\n{conversation}"
        if retry:
            prompt += f"\n\nYour previous path was refused: {retry}. Compose it again from the catalog only."
        try:
            answer = claude.ask(
                prompt,
                family=PLAN_FAMILY,
                system=SYSTEM.format(app=kit.manifest.name, language=language),
                schema=PLAN_SCHEMA,
                timeout=PLAN_TIMEOUT_SECONDS,
            )
        except claude.ClaudeFailure as exc:
            raise KitError(503, "KIT-GUIDE-CLAUDE", exc.key, params=exc.params) from None
        return answer.data if isinstance(answer.data, dict) else {}

    def write_note(session_id: uuid.UUID, step_id: str | None, what: str, language: str) -> None:
        """One sentence of what would have helped — after a step the person got stuck on or a guiding they stopped."""
        with kit._session_factory() as db:
            session = db.get(GuideSession, session_id)
            if session is None:
                return
            titles = [s.get("title", s.get("id")) for s in session.steps]
            prompt = (
                f"Application: {kit.manifest.name}. A person's goal: {session.goal!r}. The path Sprievodca guided: "
                f"{titles}. What happened: {what} at step {step_id!r}. In one short sentence, in the language with the "
                f"code {language}, say what would have helped the person here — a step missing in the catalog, an "
                "unclear screen or button, a sentence that should be clearer."
            )
            try:
                answer = claude.ask(prompt, family=NOTE_FAMILY, timeout=NOTE_TIMEOUT_SECONDS)
            except claude.ClaudeFailure as exc:
                logger.info("guide note not written: %s", exc)
                return
            db.add(
                GuideEvent(
                    kind="note",
                    session_id=session.id,
                    step_id=step_id,
                    detail=answer.text.strip()[:MESSAGE_MAX_CHARS],
                    created_at=kit.clock(),
                )
            )
            db.commit()

    @router.post("/guide/plan")
    def plan(body: PlanBody, user: User = Depends(kit.current_user), db: Db = db_dep) -> dict[str, Any]:
        message = " ".join(body.message.split())[:MESSAGE_MAX_CHARS]
        if not message:
            raise KitError(422, "KIT-GUIDE-EMPTY", "kit.server.guide.empty")
        language = language_for(body.language, user)
        now = kit.clock()
        session = own(db, body.session_id, user) if body.session_id else None
        if session is None or session.status != "asking":
            session = GuideSession(
                user_id=user.id, goal=message, language=language, status="asking", transcript=[], steps=[],
                current_step=0, created_at=now, updated_at=now,
            )  # fmt: skip
            db.add(session)
            db.flush()
        transcript = [*session.transcript, {"by": "person", "text": message}]
        catalog = {step.id: step for step in body.catalog[:CATALOG_MAX_STEPS]}
        if not catalog:
            data: dict[str, Any] = {"kind": "missing", "text": ""}
        else:
            data = compose(body, transcript, language, None)
            if data.get("kind") == "plan":
                path, why = check_path(catalog, body.subjects, list(data.get("steps") or []))
                if why:
                    data = compose(body, transcript, language, why)
                    if data.get("kind") == "plan":
                        path, why = check_path(catalog, body.subjects, list(data.get("steps") or []))
                if why:
                    record(db, "invalid_plan", user, session, detail=why[:MESSAGE_MAX_CHARS])
                    data = {"kind": "question", "text": "", "invalid": True}
                elif data.get("kind") == "plan":
                    data["steps"] = path
        kind = data.get("kind") if data.get("kind") in ("plan", "question", "missing") else "question"
        text = str(data.get("text") or "").strip()
        if kind == "missing":
            record(db, "missing_step", user, session, detail=(text or "the catalog is empty")[:MESSAGE_MAX_CHARS])
            session.status = "missing"
        elif kind == "plan":
            session.steps, session.status, session.current_step = data["steps"], "planned", 0
        else:
            session.status = "asking"
        session.transcript = [*transcript, {"by": "guide", "text": text}]
        session.updated_at = now
        db.commit()
        return {
            "session_id": str(session.id),
            "kind": kind,
            "text": text,
            "steps": session.steps if kind == "plan" else [],
            "invalid": bool(data.get("invalid")),
            "empty_catalog": not catalog,
        }

    @router.post("/guide/sessions/{session_id}/progress")
    def progress(
        session_id: str,
        body: ProgressBody,
        background: BackgroundTasks,
        user: User = Depends(kit.current_user),
        db: Db = db_dep,
    ) -> dict[str, Any]:
        session = own(db, session_id, user)
        if session.status not in ("planned", "guiding"):
            raise KitError(409, "KIT-GUIDE-STATUS", "kit.server.guide.notGuiding")
        if body.status == "stopped" and body.reason not in STOP_REASONS:
            raise KitError(422, "KIT-GUIDE-REASON", "kit.server.guide.reason")
        session.status = body.status
        session.current_step = max(0, min(body.current_step, len(session.steps)))
        session.updated_at = kit.clock()
        step = session.steps[session.current_step]["id"] if session.current_step < len(session.steps) else None
        if body.status == "done":
            record(db, "finished", user, session, detail=f"{len(session.steps)} steps")
        elif body.status == "stopped":
            session.stop_reason = body.reason
            record(db, "stopped", user, session, step_id=step, detail=body.reason)
            background.add_task(
                write_note, session.id, step, f"the person stopped the guiding ({body.reason})", session.language
            )
        db.commit()
        return _session_read(session)

    @router.post("/guide/events", status_code=201)
    def event(
        body: EventBody, background: BackgroundTasks, user: User = Depends(kit.current_user), db: Db = db_dep
    ) -> dict[str, str]:
        if body.kind not in SCREEN_EVENTS:
            raise KitError(422, "KIT-GUIDE-EVENT", "kit.server.guide.event")
        session = own(db, body.session_id, user) if body.session_id else None
        detail = " ".join((body.detail or "").split())[:MESSAGE_MAX_CHARS] or None
        if body.kind == "idea" and not detail:
            raise KitError(422, "KIT-GUIDE-EMPTY", "kit.server.guide.empty")
        record(db, body.kind, user, session, step_id=(body.step_id or None), detail=detail)
        db.commit()
        if session is not None and body.kind in NOTE_AFTER:
            background.add_task(write_note, session.id, body.step_id, f"event {body.kind}", session.language)
        return {"recorded": body.kind}

    @router.post("/guide/sessions/{session_id}/rating")
    def rate(session_id: str, body: RatingBody, user: User = Depends(kit.current_user), db: Db = db_dep) -> dict:
        session = own(db, session_id, user)
        session.rating = body.rating
        session.comment = " ".join((body.comment or "").split())[:MESSAGE_MAX_CHARS] or None
        session.updated_at = kit.clock()
        db.commit()
        return _session_read(session)

    @router.get("/guide/feedback")
    def feedback(_admin: User = Depends(kit.require_admin), db: Db = db_dep) -> dict[str, Any]:
        """What tells how well Sprievodca works — for the admin (Nastavenia → Sprievodca) and later for the cockpit."""
        counts = dict(db.execute(select(GuideSession.status, func.count()).group_by(GuideSession.status)).all())
        sessions = db.scalars(select(GuideSession).order_by(GuideSession.created_at.desc()).limit(50)).all()
        events = db.execute(
            select(GuideEvent, GuideSession.goal)
            .outerjoin(GuideSession, GuideSession.id == GuideEvent.session_id)
            .order_by(GuideEvent.created_at.desc())
            .limit(200)
        ).all()
        ratings = dict(
            db.execute(
                select(GuideSession.rating, func.count())
                .where(GuideSession.rating.is_not(None))
                .group_by(GuideSession.rating)
            ).all()
        )
        return {
            "totals": {
                "sessions": sum(counts.values()),
                "done": counts.get("done", 0),
                "stopped": counts.get("stopped", 0),
                "missing": counts.get("missing", 0),
                "guiding": counts.get("guiding", 0) + counts.get("planned", 0),
                "rated_up": ratings.get("up", 0),
                "rated_down": ratings.get("down", 0),
            },
            "sessions": [_session_read(s) for s in sessions],
            "events": [
                {
                    "kind": e.kind,
                    "step_id": e.step_id,
                    "detail": e.detail,
                    "goal": goal,
                    "created_at": e.created_at.isoformat() if isinstance(e.created_at, datetime) else None,
                }
                for e, goal in events
            ],
        }

    return router
