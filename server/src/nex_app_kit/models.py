"""The kit's own tables. Every name starts with ``kit_`` and the kit keeps its own migration record
(``kit_alembic_version``), so they never meet the app's tables or migrations — not even NEX Manager's ``users``
when it moves onto the template. An app's table that points at a person points at ``kit_users.id``."""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Integer,
    MetaData,
    String,
    Text,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

from .layout import SIDEBAR_WIDTH

NAMING = {
    "ix": "ix_%(column_0_label)s",
    "uq": "uq_%(table_name)s_%(column_0_name)s",
    "ck": "ck_%(table_name)s_%(constraint_name)s",
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
    "pk": "pk_%(table_name)s",
}


class KitBase(DeclarativeBase):
    metadata = MetaData(naming_convention=NAMING)


def _now_column() -> Mapped[datetime]:
    return mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())


class User(KitBase):
    """A person of the app: with the app's own password (``source='local'``), or a mirror of the person NEX
    Manager launched (``source='manager'``, no password here — refreshed at every launch and re-check)."""

    __tablename__ = "kit_users"
    __table_args__ = (
        CheckConstraint("role IN ('admin', 'user')", name="role"),
        CheckConstraint("source IN ('local', 'manager')", name="source"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    username: Mapped[str] = mapped_column(String(100), nullable=False, unique=True)
    # DEV-310: not unique — one person may have several accounts with their one e-mail; sign-in is by username.
    email: Mapped[str | None] = mapped_column(String(255))
    password_hash: Mapped[str | None] = mapped_column(String(255))
    role: Mapped[str] = mapped_column(String(10), nullable=False, default="user")
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    first_name: Mapped[str | None] = mapped_column(String(100))
    last_name: Mapped[str | None] = mapped_column(String(100))
    must_change_password: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    failed_logins: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    locked_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    source: Mapped[str] = mapped_column(String(10), nullable=False, default="local")
    #: DEV-394 — the person's language (``i18n.LANGUAGES``); ``None`` = the installation's.
    language: Mapped[str | None] = mapped_column(String(8))
    created_at: Mapped[datetime] = _now_column()
    updated_at: Mapped[datetime] = _now_column()


class Session(KitBase):
    """One signed-in browser. The browser holds the token in a cookie JavaScript cannot read; here is only its
    SHA-256, so a copy of the database signs nobody in. Deleting the row ends the session at once."""

    __tablename__ = "kit_sessions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    token_hash: Mapped[str] = mapped_column(String(64), nullable=False, unique=True)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("kit_users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    created_at: Mapped[datetime] = _now_column()
    last_seen_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    #: Launched from NEX Manager: when NEX Manager last confirmed the person, and its token version then.
    verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    manager_token_version: Mapped[int | None] = mapped_column(Integer)
    user_agent: Mapped[str | None] = mapped_column(String(200))


class WebAccount(KitBase):
    """DEV-523 — a person of the app's web (``web/``): signs in by e-mail, unique among the web's accounts, and a
    registration is a request the admin decides in the administration. Separate from :class:`User` — the
    administration signs in by name, and one e-mail may be on several of its accounts (DEV-310). Director 26.11.2026 on
    the proposal (own web accounts, sign-in by e-mail, a registration request the admin approves): „Súhlasím“."""

    __tablename__ = "kit_web_accounts"
    __table_args__ = (CheckConstraint("status IN ('pending', 'active', 'rejected', 'disabled')", name="status"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    #: Normalised (``routes.clean_email``) — the one thing the web signs in with.
    email: Mapped[str] = mapped_column(String(255), nullable=False, unique=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    first_name: Mapped[str | None] = mapped_column(String(100))
    last_name: Mapped[str | None] = mapped_column(String(100))
    #: ``pending`` (the request waits for the admin) → ``active`` | ``rejected``; an active one may be ``disabled``.
    status: Mapped[str] = mapped_column(String(10), nullable=False, default="pending")
    language: Mapped[str | None] = mapped_column(String(8))
    failed_logins: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    locked_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    #: Who decided the request (or last switched the account off or on) and when.
    decided_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("kit_users.id", ondelete="SET NULL")
    )
    decided_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = _now_column()
    updated_at: Mapped[datetime] = _now_column()


class WebSession(KitBase):
    """DEV-523 — one browser signed in to the web, like :class:`Session` for the administration: the token in a cookie
    JavaScript cannot read, here only its SHA-256."""

    __tablename__ = "kit_web_sessions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    token_hash: Mapped[str] = mapped_column(String(64), nullable=False, unique=True)
    account_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("kit_web_accounts.id", ondelete="CASCADE"), nullable=False, index=True
    )
    created_at: Mapped[datetime] = _now_column()
    last_seen_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    user_agent: Mapped[str | None] = mapped_column(String(200))


class UsedLaunchToken(KitBase):
    """A launch ticket from NEX Manager works once — its ``jti`` is kept until it would have expired anyway."""

    __tablename__ = "kit_used_launch_tokens"

    jti: Mapped[str] = mapped_column(String(64), primary_key=True)
    login: Mapped[str] = mapped_column(String(100), nullable=False)
    used_at: Mapped[datetime] = _now_column()
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)


class SystemSetting(KitBase):
    """A system setting changed from its default. The definition (default, type, label…) lives in the app's code;
    a key without a row has its default."""

    __tablename__ = "kit_system_settings"

    key: Mapped[str] = mapped_column(String(100), primary_key=True)
    value: Mapped[str] = mapped_column(Text, nullable=False)
    updated_at: Mapped[datetime] = _now_column()
    updated_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("kit_users.id", ondelete="SET NULL")
    )


class AgentSetting(KitBase):
    """Model and effort of one agent role, for the whole app; empty = the app's default."""

    __tablename__ = "kit_agent_settings"

    role: Mapped[str] = mapped_column(String(32), primary_key=True)
    model: Mapped[str | None] = mapped_column(String(16))
    effort: Mapped[str | None] = mapped_column(String(16))
    updated_at: Mapped[datetime] = _now_column()
    updated_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("kit_users.id", ondelete="SET NULL")
    )


class UserLayout(KitBase):
    """How one person arranged the screen; a width of NULL is the default."""

    __tablename__ = "kit_user_layouts"
    __table_args__ = (
        CheckConstraint(
            f"sidebar_width IS NULL OR sidebar_width BETWEEN {SIDEBAR_WIDTH.min} AND {SIDEBAR_WIDTH.max}",
            name="sidebar_width",
        ),
    )

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("kit_users.id", ondelete="CASCADE"), primary_key=True
    )
    sidebar_width: Mapped[int | None] = mapped_column(Integer)
    sidebar_collapsed: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    updated_at: Mapped[datetime] = _now_column()


class GuideSession(KitBase):
    """DEV-535 — one goal a person brought to Sprievodca: what they wrote, the path composed from the app's catalog of
    steps, how far the guiding got and how it ended. The Director 28.11.2026: a person who has never seen the app
    „sadol si k naším aplikáciám a začal používať“ — Sprievodca leads them step by step; they always click."""

    __tablename__ = "kit_guide_sessions"
    __table_args__ = (
        CheckConstraint("status IN ('asking', 'planned', 'missing', 'guiding', 'done', 'stopped')", name="status"),
        CheckConstraint("rating IS NULL OR rating IN ('up', 'down')", name="rating"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("kit_users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    goal: Mapped[str] = mapped_column(Text, nullable=False)
    language: Mapped[str] = mapped_column(String(8), nullable=False)
    #: ``asking`` (Sprievodca asked back) · ``planned`` · ``missing`` (no path in the catalog) · ``guiding`` · ``done``
    #: · ``stopped``.
    status: Mapped[str] = mapped_column(String(10), nullable=False)
    #: The conversation: ``[{"by": "person" | "guide", "text": …}]``.
    transcript: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    #: The composed path: ``[{"id": <step>, "subject": <object id> | null}]``.
    steps: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    current_step: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    stop_reason: Mapped[str | None] = mapped_column(String(20))
    rating: Mapped[str | None] = mapped_column(String(4))
    comment: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = _now_column()
    updated_at: Mapped[datetime] = _now_column()


class GuideEvent(KitBase):
    """DEV-535 — what tells how well Sprievodca works: a step missing in the catalog, a person stuck on a step, a step
    the app did not see done, a guiding stopped or finished, an idea, Sprievodca's own note. The Director 28.11.2026:
    „…niečo čo by nám dával spätnú väzbu o tom do akej miery funguje táto vrstva dobre.“"""

    __tablename__ = "kit_guide_events"
    __table_args__ = (
        CheckConstraint(
            "kind IN ('missing_step', 'invalid_plan', 'stuck', 'not_detected', 'no_target', 'skipped', 'stopped', "
            "'finished', 'idea', 'note')",
            name="kind",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    session_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("kit_guide_sessions.id", ondelete="CASCADE"), index=True
    )
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("kit_users.id", ondelete="SET NULL")
    )
    kind: Mapped[str] = mapped_column(String(14), nullable=False)
    step_id: Mapped[str | None] = mapped_column(String(80))
    detail: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = _now_column()
