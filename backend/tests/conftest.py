import pytest
from rest_framework.test import APIClient

from apps.projects.models import Membership, Task
from apps.users.models import User

PASSWORD = "Testpass123!"


@pytest.fixture(autouse=True)
def _email_eager(settings):
    settings.CELERY_TASK_ALWAYS_EAGER = True
    settings.CELERY_TASK_EAGER_PROPAGATES = True
    settings.EMAIL_DELIVERY_BACKEND = "django.core.mail.backends.locmem.EmailBackend"


@pytest.fixture
def api():
    return APIClient()


def make_user(email, **kwargs):
    kwargs.setdefault("is_active", True)
    return User.objects.create_user(email=email, password=PASSWORD, **kwargs)


def auth_client(user):
    client = APIClient()
    response = client.post("/api/auth/jwt/create/", {"email": user.email, "password": PASSWORD})
    assert response.status_code == 200, response.content
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {response.data['access']}")
    return client


def add_member(project, user, role):
    return Membership.objects.create(project=project, user=user, role=role)


def make_task(project, name="Feature", status=Task.Status.IN_PROGRESS):
    return Task.objects.create(project=project, name=name, status=status)
