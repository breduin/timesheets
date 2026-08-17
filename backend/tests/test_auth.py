import pytest
from django.contrib.auth.tokens import default_token_generator
from django.core import mail
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_encode

from tests.conftest import PASSWORD, make_user


@pytest.mark.django_db
def test_register_inactive_until_activation(api):
    response = api.post(
        "/api/auth/users/",
        {"email": "new@example.com", "password": PASSWORD},
    )
    assert response.status_code == 201
    from apps.users.models import User

    user = User.objects.get(email="new@example.com")
    assert user.is_active is False
    assert mail.outbox

    denied = api.post("/api/auth/jwt/create/", {"email": user.email, "password": PASSWORD})
    assert denied.status_code == 401

    uid = urlsafe_base64_encode(force_bytes(user.pk))
    token = default_token_generator.make_token(user)
    activated = api.post("/api/auth/users/activation/", {"uid": uid, "token": token})
    assert activated.status_code == 204

    user.refresh_from_db()
    assert user.is_active is True
    ok = api.post("/api/auth/jwt/create/", {"email": user.email, "password": PASSWORD})
    assert ok.status_code == 200
    assert "access" in ok.data


@pytest.mark.django_db
def test_health(api):
    response = api.get("/api/health/")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"
