"""Passwords: bcrypt, as NEX Manager and the cockpit keep them (a NEX Manager hash still works after the move)."""

from __future__ import annotations

import bcrypt

from .errors import invalid

#: The shortest password the server accepts — the same number the frontend shows (PASSWORD_MIN_LENGTH).
PASSWORD_MIN_LENGTH = 8
#: bcrypt reads at most 72 bytes; a longer password would be cut without a word.
PASSWORD_MAX_BYTES = 72


def check_new_password(password: str) -> None:
    if len(password) < PASSWORD_MIN_LENGTH:
        raise invalid(f"Heslo musí mať aspoň {PASSWORD_MIN_LENGTH} znakov.", "KIT-PASSWORD-SHORT")
    if len(password.encode("utf-8")) > PASSWORD_MAX_BYTES:
        raise invalid(
            "Heslo je príliš dlhé — najviac 72 znakov (písmeno s diakritikou sa ráta za dva).", "KIT-PASSWORD-LONG"
        )


def hash_password(password: str, rounds: int = 12) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt(rounds)).decode("ascii")


def verify_password(password: str, password_hash: str | None) -> bool:
    if not password_hash:
        return False
    data = password.encode("utf-8")
    if len(data) > PASSWORD_MAX_BYTES:
        return False
    try:
        return bcrypt.checkpw(data, password_hash.encode("ascii"))
    except ValueError:
        return False


#: Checked against when the login is unknown, so a wrong name takes as long as a wrong password.
DUMMY_HASH = hash_password("nex-app-kit-dummy", rounds=12)
