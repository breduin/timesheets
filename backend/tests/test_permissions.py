import pytest

from apps.projects.models import Membership
from apps.projects.services import create_project
from tests.conftest import add_member, auth_client, make_task, make_user


@pytest.mark.django_db
def test_foreign_project_is_403():
    owner = make_user("owner@example.com")
    stranger = make_user("stranger@example.com")
    project = create_project(user=owner, name="A")
    client = auth_client(stranger)
    response = client.get(f"/api/projects/{project.id}/")
    assert response.status_code == 403


@pytest.mark.django_db
def test_create_project_makes_owner_without_system_task():
    owner = make_user("owner@example.com")
    client = auth_client(owner)
    response = client.post("/api/projects/", {"name": "Alpha", "description": "d", "rate": 1500})
    assert response.status_code == 201
    assert response.data["role"] == Membership.Role.OWNER
    assert response.data["rate"] == 1500
    task_resp = client.get(f"/api/projects/{response.data['id']}/tasks/")
    assert task_resp.status_code == 200
    assert task_resp.data == []


@pytest.mark.django_db
def test_developer_cannot_create_task():
    owner = make_user("owner@example.com")
    developer = make_user("dev@example.com")
    project = create_project(user=owner, name="A")
    add_member(project, developer, Membership.Role.DEVELOPER)
    client = auth_client(developer)
    response = client.post(f"/api/projects/{project.id}/tasks/", {"name": "X"})
    assert response.status_code == 403


@pytest.mark.django_db
def test_manager_can_create_task():
    owner = make_user("owner@example.com")
    manager = make_user("mgr@example.com")
    project = create_project(user=owner, name="A")
    add_member(project, manager, Membership.Role.MANAGER)
    client = auth_client(manager)
    created = client.post(f"/api/projects/{project.id}/tasks/", {"name": "Feature"})
    assert created.status_code == 201
    assert created.data["name"] == "Feature"


@pytest.mark.django_db
def test_viewer_cannot_post_time_entry():
    owner = make_user("owner@example.com")
    viewer = make_user("view@example.com")
    project = create_project(user=owner, name="A")
    add_member(project, viewer, Membership.Role.VIEWER)
    task = make_task(project)
    client = auth_client(viewer)
    response = client.post(
        "/api/time-entries/",
        {"task": task.id, "spent_on": "2026-08-01", "duration_minutes": 30},
    )
    assert response.status_code in (400, 403)


@pytest.mark.django_db
def test_time_entry_rejected_unless_in_progress():
    owner = make_user("owner@example.com")
    project = create_project(user=owner, name="A")
    task = make_task(project, status="todo")
    client = auth_client(owner)
    response = client.post(
        "/api/time-entries/",
        {"task": task.id, "spent_on": "2026-08-01", "duration_minutes": 30},
    )
    assert response.status_code == 400


@pytest.mark.django_db
def test_developer_sees_only_own_entries():
    owner = make_user("owner@example.com")
    developer = make_user("dev@example.com")
    project = create_project(user=owner, name="A")
    add_member(project, developer, Membership.Role.DEVELOPER)
    task = make_task(project)
    owner_client = auth_client(owner)
    owner_client.post(
        "/api/time-entries/",
        {"task": task.id, "spent_on": "2026-08-01", "duration_minutes": 60, "comment": "own"},
    )
    dev_client = auth_client(developer)
    mine = dev_client.post(
        "/api/time-entries/",
        {"task": task.id, "spent_on": "2026-08-01", "duration_minutes": 15, "comment": "dev"},
    )
    assert mine.status_code == 201
    listing = dev_client.get(f"/api/time-entries/?project={project.id}")
    ids = [row["id"] for row in listing.data["results"]]
    assert mine.data["id"] in ids
    assert len(ids) == 1


@pytest.mark.django_db
def test_manager_can_patch_foreign_entry():
    owner = make_user("owner@example.com")
    manager = make_user("mgr@example.com")
    developer = make_user("dev@example.com")
    project = create_project(user=owner, name="A")
    add_member(project, manager, Membership.Role.MANAGER)
    add_member(project, developer, Membership.Role.DEVELOPER)
    task = make_task(project)
    dev_client = auth_client(developer)
    created = dev_client.post(
        "/api/time-entries/",
        {"task": task.id, "spent_on": "2026-08-01", "duration_minutes": 20},
    )
    mgr_client = auth_client(manager)
    patched = mgr_client.patch(
        f"/api/time-entries/{created.data['id']}/",
        {"duration_minutes": 40},
        format="json",
    )
    assert patched.status_code == 200
    assert patched.data["duration_minutes"] == 40
