"""DEV-296 — a password of any length; only an empty one is refused.

The Director's rule (02.11.2026): „Dĺžku, zložitosť ani tvar hesla neobmedzujem a nenavrhujem — o hesle rozhoduje
Director; nástroj odmietne nanajvýš prázdne heslo." The template refused a password shorter than 8 characters and one
longer than 72 bytes — the most bcrypt reads. A longer one is now condensed with SHA-256 before bcrypt, so its whole
length counts; a shorter one goes to bcrypt as before, so the hashes NEX Manager and the cockpit made still work.
"""

from __future__ import annotations

import bcrypt
import pytest

from nex_app_kit.passwords import hash_password, verify_password

from .conftest import TEST_ROUNDS
from .test_users import NEW, signed_in_admin

LONG = "ž" * 100  # 200 bytes
EMPTY = {"detail": "Heslo nesmie byť prázdne.", "code": "KIT-PASSWORD-EMPTY"}
#: Another person than the signed-in admin's Eva — a taken e-mail would stop the request before the password.
JANO = {"username": "jano", "email": "jano@firma.sk"}


def test_a_short_password_is_the_person_s_choice(make_app):
    app, _ = signed_in_admin(make_app)

    assert app.client.post("/api/v1/users", json={**NEW, "password": "a"}).status_code == 201

    assert app.login("eva", "a").status_code == 200


def test_a_password_longer_than_bcrypt_reads_counts_whole(make_app):
    app = make_app()
    app.user("eva")
    app.login("eva")

    changed = app.client.post(
        "/api/v1/auth/change-password", json={"current_password": "heslo-123", "new_password": LONG}
    )

    assert changed.status_code == 204
    assert app.login("eva", LONG, client=app.other_browser()).status_code == 200
    # the same first 72 bytes, a different end — bcrypt alone would have let it in
    assert app.login("eva", LONG[:-1] + "x", client=app.other_browser()).status_code == 401


@pytest.mark.parametrize(
    "call",
    [
        lambda app, eva: app.client.post("/api/v1/users", json={**NEW, **JANO, "password": ""}),
        lambda app, eva: app.client.post(f"/api/v1/users/{eva.id}/password", json={"new_password": ""}),
    ],
    ids=["new user", "new password from the admin"],
)
def test_an_empty_password_is_the_only_one_refused(make_app, call):
    app, _ = signed_in_admin(make_app)
    eva = app.user("eva")

    response = call(app, eva)

    assert (response.status_code, response.json()) == (422, EMPTY)


def test_an_empty_new_own_password_is_refused(make_app):
    app = make_app()
    app.user("eva")
    app.login("eva")

    response = app.client.post(
        "/api/v1/auth/change-password", json={"current_password": "heslo-123", "new_password": ""}
    )

    assert (response.status_code, response.json()) == (422, EMPTY)


def test_a_hash_bcrypt_made_of_the_password_itself_still_works():
    """NEX Manager's and the cockpit's hashes: bcrypt of the password as it is — after the move to the template too."""
    legacy = bcrypt.hashpw(b"heslo-123", bcrypt.gensalt(TEST_ROUNDS)).decode("ascii")

    assert verify_password("heslo-123", legacy) is True
    assert verify_password("heslo-124", legacy) is False


def test_a_long_password_is_not_its_first_72_bytes():
    truncated = bcrypt.hashpw(LONG.encode("utf-8")[:72], bcrypt.gensalt(TEST_ROUNDS)).decode("ascii")

    assert verify_password(LONG, truncated) is False
    assert verify_password(LONG, hash_password(LONG, TEST_ROUNDS)) is True
