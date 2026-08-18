from django.db.models import Sum

from apps.projects.models import Membership
from apps.projects.services import SEE_BY_USER_ROLES
from apps.tracking.models import TimeEntry
from apps.tracking.serializers import visible_entries_q


class ReportService:
    def __init__(self, user, filters):
        self.user = user
        self.filters = filters
        self.memberships = list(Membership.objects.filter(user=user).select_related("project"))
        project_id = filters.get("project")
        if project_id:
            self.memberships = [m for m in self.memberships if str(m.project_id) == str(project_id)]

    def _roles(self):
        return {m.role for m in self.memberships}

    def can_see_by_user(self):
        return bool(self._roles() & SEE_BY_USER_ROLES)

    def can_see_entries(self):
        return bool(self.memberships)

    def _project_ids(self):
        return [m.project_id for m in self.memberships]

    def _apply_filters(self, qs):
        filters = self.filters
        if filters.get("project"):
            qs = qs.filter(task__project_id=filters["project"])
        if filters.get("task"):
            qs = qs.filter(task_id=filters["task"])
        if filters.get("user") and self.can_see_by_user():
            qs = qs.filter(user_id=filters["user"])
        if filters.get("from"):
            qs = qs.filter(spent_on__gte=filters["from"])
        if filters.get("to"):
            qs = qs.filter(spent_on__lte=filters["to"])
        return qs

    def aggregate_queryset(self):
        qs = TimeEntry.objects.filter(task__project_id__in=self._project_ids())
        return self._apply_filters(qs)

    def entries_queryset(self):
        qs = TimeEntry.objects.filter(visible_entries_q(self.user)).select_related(
            "task", "task__project", "user"
        )
        return self._apply_filters(qs)

    def build(self):
        qs = self.aggregate_queryset()
        totals = qs.aggregate(minutes=Sum("duration_minutes"))
        by_project = list(
            qs.values("task__project_id", "task__project__name")
            .annotate(minutes=Sum("duration_minutes"))
            .order_by("task__project__name")
        )
        by_task = list(
            qs.values("task_id", "task__name", "task__project_id", "task__project__name")
            .annotate(minutes=Sum("duration_minutes"))
            .order_by("task__project__name", "task__name")
        )
        payload = {
            "totals": {"minutes": totals["minutes"] or 0},
            "by_project": [
                {
                    "project_id": row["task__project_id"],
                    "project_name": row["task__project__name"],
                    "minutes": row["minutes"],
                }
                for row in by_project
            ],
            "by_task": [
                {
                    "task_id": row["task_id"],
                    "task_name": row["task__name"],
                    "project_id": row["task__project_id"],
                    "project_name": row["task__project__name"],
                    "minutes": row["minutes"],
                }
                for row in by_task
            ],
        }
        if self.can_see_by_user():
            by_user = list(
                qs.values("user_id", "user__email")
                .annotate(minutes=Sum("duration_minutes"))
                .order_by("user__email")
            )
            payload["by_user"] = [
                {
                    "user_id": row["user_id"],
                    "email": row["user__email"],
                    "minutes": row["minutes"],
                }
                for row in by_user
            ]
        if self.can_see_entries():
            payload["entries"] = [
                {
                    "id": entry.id,
                    "spent_on": entry.spent_on.isoformat(),
                    "duration_minutes": entry.duration_minutes,
                    "comment": entry.comment,
                    "task_id": entry.task_id,
                    "task_name": entry.task.name,
                    "project_id": entry.task.project_id,
                    "project_name": entry.task.project.name,
                    "user_id": entry.user_id,
                    "user_email": entry.user.email,
                }
                for entry in self.entries_queryset().order_by("-spent_on", "-id")[:1000]
            ]
        return payload
