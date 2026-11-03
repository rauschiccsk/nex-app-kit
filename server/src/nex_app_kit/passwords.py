"""Passwords: bcrypt, as NEX Manager and the cockpit keep them (a NEX Manager hash still works after the move)."""

from __future__ import annotations

import base64
import hashlib

import bcrypt

from .errors import invalid

#: DEV-296 — the Director's rule: „Dĺžku, zložitosť ani tvar hesla neobmedzujem a nenavrhujem — o hesle rozhoduje
#: Director; nástroj odmietne nanajvýš prázdne heslo." The shortest password is one character — the same number the
#: frontend gives its forms (PASSWORD_MIN_LENGTH); apps that read it keep reading it.
PASSWORD_MIN_LENGTH = 1
#: bcrypt reads at most 72 bytes. A longer password is condensed with SHA-256 first, so its whole length counts.
BCRYPT_MAX_BYTES = 72


def _material(password: str) -> bytes:
    """What bcrypt hashes: the password itself up to 72 bytes — as NEX Manager and the cockpit hash it, so their hashes
    keep working — and the SHA-256 of a longer one (base64, 44 bytes)."""
    data = password.encode("utf-8")
    if len(data) <= BCRYPT_MAX_BYTES:
        return data
    return base64.b64encode(hashlib.sha256(data).digest())


def check_new_password(password: str) -> None:
    if not password:
        raise invalid("Heslo nesmie byť prázdne.", "KIT-PASSWORD-EMPTY")


def hash_password(password: str, rounds: int = 12) -> str:
    return bcrypt.hashpw(_material(password), bcrypt.gensalt(rounds)).decode("ascii")


def verify_password(password: str, password_hash: str | None) -> bool:
    if not password_hash:
        return False
    try:
        return bcrypt.checkpw(_material(password), password_hash.encode("ascii"))
    except ValueError:
        return False


#: Checked against when the login is unknown, so a wrong name takes as long as a wrong password.
DUMMY_HASH = hash_password("nex-app-kit-dummy", rounds=12)
