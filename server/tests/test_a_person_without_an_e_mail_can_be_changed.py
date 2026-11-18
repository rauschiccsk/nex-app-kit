"""DEV-422 — the admin changes a person who has no e-mail (the language, the role, the name) without having to give one.

17.11.2026 NEX Manager 1.7.0 passed Verifikácia with a note: the admin could not change the language of a person who
has no e-mail until he filled one in — the template's server checked the e-mail on every change of a person. Director
17.11.2026: „Súhlasím“ (a ticket), 18.11.2026: „Súhlasím … aj mimo balíku“.
"""

from __future__ import annotations

from nex_app_kit.models import User
from tests.test_users import signed_in_admin

CHANGES = {"email": "", "role": "user", "first_name": "Jana", "last_name": "Bez Mailu", "is_active": True}


def test_a_person_without_an_e_mail_gets_another_language_and_name(make_app):
    app = make_app(languages=["sk", "hu", "en"])
    app.user("spravca", role="admin")
    app.login("spravca")
    jana = app.user("jana", email=None)

    response = app.client.patch(f"/api/v1/users/{jana.id}", json={**CHANGES, "language": "hu"})

    assert response.status_code == 200, response.text
    body = response.json()
    assert (body["language"], body["last_name"]) == ("hu", "Bez Mailu")
    with app.factory() as db:
        assert db.get(User, jana.id).email is None, "no e-mail was made up for the person"


def test_an_e_mail_given_to_such_a_person_is_checked_as_ever(make_app):
    app, _ = signed_in_admin(make_app)
    jana = app.user("jana", email=None)

    response = app.client.patch(f"/api/v1/users/{jana.id}", json={**CHANGES, "email": "zly"})

    assert response.status_code == 422
    assert "nie je platný e-mail" in response.text


def test_a_person_who_has_an_e_mail_keeps_having_one(make_app):
    app, _ = signed_in_admin(make_app)
    eva = app.user("eva")

    response = app.client.patch(f"/api/v1/users/{eva.id}", json=CHANGES)

    assert response.status_code == 422
    assert "KIT-EMAIL" in response.text
