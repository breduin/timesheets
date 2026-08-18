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


@pytest.mark.django_db
def test_invite_link_register_binds_new_user(api):
    owner = make_user("owner@example.com")
    project = create_project(user=owner, name="A")
    owner_client = auth_client(owner)
    created = owner_client.post(
        f"/api/projects/{project.id}/invites/",
        {"kind": "link", "role": Membership.Role.VIEWER},
    )
    assert created.status_code == 201
    token = created.data["token"]
    accepted = api.post(
        f"/api/invites/{token}/accept/",
        {"email": "linkuser@example.com", "password": PASSWORD},
    )
    assert accepted.status_code == 200
    from apps.users.models import User

    user = User.objects.get(email="linkuser@example.com")
    assert user.is_active is True
    assert Membership.objects.filter(project=project, user=user, role=Membership.Role.VIEWER).exists()


@pytest.mark.django_db
def test_invite_link_login_binds_existing_user():
    owner = make_user("owner@example.com")
    existing = make_user("exist2@example.com")
    project = create_project(user=owner, name="A")
    created = auth_client(owner).post(
        f"/api/projects/{project.id}/invites/",
        {"kind": "link", "role": Membership.Role.DEVELOPER},
    )
    assert created.status_code == 201
    token = created.data["token"]
    accepted = auth_client(existing).post(f"/api/invites/{token}/accept/", {})
    assert accepted.status_code == 200
    assert Membership.objects.filter(
        project=project, user=existing, role=Membership.Role.DEVELOPER
    ).exists()


@pytest.mark.django_db
def test_invite_token_requires_auth(api):
    owner = make_user("owner@example.com")
    project = create_project(user=owner, name="A")
    created = auth_client(owner).post(
        f"/api/projects/{project.id}/invites/",
        {"kind": "token", "role": Membership.Role.MANAGER},
    )
    assert created.status_code == 201
    token = created.data["token"]
    rejected = api.post(f"/api/invites/{token}/accept/", {})
    assert rejected.status_code == 400


@pytest.mark.django_db
def test_invite_token_binds_authenticated_user():
    owner = make_user("owner@example.com")
    member = make_user("tokener@example.com")
    project = create_project(user=owner, name="A")
    created = auth_client(owner).post(
        f"/api/projects/{project.id}/invites/",
        {"kind": "token", "role": Membership.Role.VIEWER},
    )
    assert created.status_code == 201
    token = created.data["token"]
    accepted = auth_client(member).post(f"/api/invites/{token}/accept/", {})
    assert accepted.status_code == 200
    assert Membership.objects.filter(project=project, user=member, role=Membership.Role.VIEWER).exists()
