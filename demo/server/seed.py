"""Example people and values for the demo — invented, marked as examples, never a customer's."""

from __future__ import annotations

from datetime import UTC, datetime

from sqlalchemy import select

from nex_app_kit.models import SystemSetting, User
from nex_app_kit.passwords import hash_password


def seed(session_factory) -> None:
    now = datetime.now(UTC)
    with session_factory() as db:
        admin = db.scalars(select(User).where(User.username == "admin")).one()
        if admin.first_name:
            return
        admin.first_name, admin.last_name, admin.email = "Ján", "Novák", "jan@firma.sk"
        for username, first, last, active in (("eva", "Eva", "Malá", True), ("peter", "Peter", "", False)):
            db.add(
                User(
                    username=username,
                    email=f"{username}@firma.sk",
                    password_hash=hash_password("ukazka-heslo-1", 10),
                    role="user",
                    is_active=active,
                    first_name=first,
                    last_name=last or None,
                    must_change_password=False,
                    failed_logins=0,
                    source="local",
                    created_at=now,
                    updated_at=now,
                )
            )
        db.add(SystemSetting(key="retention_days", value="730", updated_at=now, updated_by=admin.id))
        db.commit()
