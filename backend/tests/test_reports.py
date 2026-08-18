import pytest

from apps.projects.models import Membership
from apps.projects.services import create_project
from apps.tracking.models import TimeEntry
from tests.conftest import add_member, auth_client, make_task, make_user


@pytest.mark.django_db
def test_summary_minutes_match_and_role_keys():
    owner = make_user("owner@example.com")
    developer = make_user("dev@example.com")
    viewer = make_user("view@example.com")
    project = create_project(user=owner, name="A")
    add_member(project, developer, Membership.Role.DEVELOPER)
    add_member(project, viewer, Membership.Role.VIEWER)
    task = make_task(project)
    TimeEntry.objects.create(task=task, user=owner, spent_on="2026-07-01", duration_minutes=30)
    TimeEntry.objects.create(task=task, user=owner, spent_on="2026-08-01", duration_minutes=60)
    TimeEntry.objects.create(task=task, user=developer, spent_on="2026-08-01", duration_minutes=30)

    owner_report = auth_client(owner).get(f"/api/reports/summary/?project={project.id}")
    assert owner_report.status_code == 200
    assert owner_report.data["totals"]["minutes"] == 120
    assert owner_report.data["by_project"][0]["minutes"] == 120
    assert owner_report.data["by_project"][0]["total_minutes"] == 120
    ranged = auth_client(owner).get(
        f"/api/reports/summary/?project={project.id}&from=2026-08-01&to=2026-08-01"
    )
    assert ranged.status_code == 200
    assert ranged.data["totals"]["minutes"] == 90
    assert ranged.data["by_project"][0]["minutes"] == 90
    assert ranged.data["by_project"][0]["total_minutes"] == 120
    assert "by_user" in owner_report.data
    assert "entries" in owner_report.data
    assert {row["id"] for row in owner_report.data["entries"]} == set(
        TimeEntry.objects.values_list("id", flat=True)
    )

    dev_report = auth_client(developer).get(f"/api/reports/summary/?project={project.id}")
    assert dev_report.status_code == 200
    assert dev_report.data["totals"]["minutes"] == 120
    assert "by_user" not in dev_report.data
    assert "entries" in dev_report.data
    assert all(row["user_id"] == developer.id for row in dev_report.data["entries"])

    view_report = auth_client(viewer).get(f"/api/reports/summary/?project={project.id}")
    assert view_report.status_code == 200
    assert view_report.data["totals"]["minutes"] == 120
    assert "by_user" not in view_report.data
    assert "entries" in view_report.data
    assert {row["id"] for row in view_report.data["entries"]} == set(
        TimeEntry.objects.values_list("id", flat=True)
    )

    csv_resp = auth_client(viewer).get(f"/api/reports/summary/?project={project.id}&format=csv")
    assert csv_resp.status_code == 200
    body = csv_resp.content.decode()
    assert "user" not in body.splitlines()[0]
