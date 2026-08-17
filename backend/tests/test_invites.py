import pytest

from apps.projects.models import Membership
from apps.projects.services import create_project
from tests.conftest import PASSWORD, add_member, auth_client, make_user


@pytest.mark.django_db
def test_invite_new_user_creates_active_account(api):
    owner = make_user("owner@example.com")
    project = create_project(user=owner, name="A")
    owner_client = auth_client(owner)
    invited = owner_client.post(
        f"/api/projects/{project.id}/invites/",
        {"email": "newdev@example.com", "role": Membership.Role.DEVELOPER},
    )
    assert invited.status_code == 201
    token = invited.data["id"]
    from apps.projects.models import Invite

    invite = Invite.objects.get(pk=token)
    accepted = api.post(
        f"/api/invites/{invite.token}/accept/",
        {"password": PASSWORD},
    )
    assert accepted.status_code == 200
    from apps.users.models import User

    user = User.objects.get(email="newdev@example.com")
    assert user.is_active is True
    assert Membership.objects.filter(project=project, user=user, role=Membership.Role.DEVELOPER).exists()


@pytest.mark.django_db
def test_invite_existing_user_adds_membership():
    owner = make_user("owner@example.com")
    existing = make_user("exist@example.com")
    project = create_project(user=owner, name="A")
    owner_client = auth_client(owner)
    response = owner_client.post(
        f"/api/projects/{project.id}/invites/",
        {"email": existing.email, "role": Membership.Role.MANAGER},
    )
    assert response.status_code == 201
    assert Membership.objects.filter(
        project=project, user=existing, role=Membership.Role.MANAGER
    ).exists()


@pytest.mark.django_db
def test_viewer_cannot_invite():
    owner = make_user("owner@example.com")
    viewer = make_user("view@example.com")
    project = create_project(user=owner, name="A")
    add_member(project, viewer, Membership.Role.VIEWER)
    client = auth_client(viewer)
    response = client.post(
        f"/api/projects/{project.id}/invites/",
        {"email": "x@example.com", "role": Membership.Role.DEVELOPER},
    )
    assert response.status_code == 403
