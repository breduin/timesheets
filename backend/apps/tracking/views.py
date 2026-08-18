import csv

from django.http import HttpResponse
from rest_framework import generics
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.projects.permissions import get_visible_project, require_role
from apps.projects.services import OTHERS_ENTRIES_ROLES, OWN_ENTRIES_ROLES
from apps.tracking.models import TimeEntry
from apps.tracking.serializers import TimeEntrySerializer, visible_entries_q
from apps.tracking.services import ReportService


class TimeEntryListCreateView(generics.ListCreateAPIView):
    serializer_class = TimeEntrySerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = (
            TimeEntry.objects.filter(visible_entries_q(self.request.user))
            .select_related("task", "task__project", "user")
        )
        params = self.request.query_params
        if params.get("project"):
            qs = qs.filter(task__project_id=params["project"])
        if params.get("task"):
            qs = qs.filter(task_id=params["task"])
        if params.get("user"):
            qs = qs.filter(user_id=params["user"])
        if params.get("spent_on_after"):
            qs = qs.filter(spent_on__gte=params["spent_on_after"])
        if params.get("spent_on_before"):
            qs = qs.filter(spent_on__lte=params["spent_on_before"])
        return qs

    def perform_create(self, serializer):
        serializer.save()


class TimeEntryDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = TimeEntrySerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return TimeEntry.objects.filter(visible_entries_q(self.request.user)).select_related(
            "task", "task__project", "user"
        )

    def perform_update(self, serializer):
        self._assert_can_mutate(serializer.instance)
        serializer.save()

    def perform_destroy(self, instance):
        self._assert_can_mutate(instance)
        instance.delete()

    def _assert_can_mutate(self, instance):
        require_role(self.request.user, instance.task.project, OWN_ENTRIES_ROLES)
        if instance.user_id != self.request.user.id:
            require_role(self.request.user, instance.task.project, OTHERS_ENTRIES_ROLES)


class ReportSummaryView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        filters = {
            "project": request.query_params.get("project"),
            "task": request.query_params.get("task"),
            "user": request.query_params.get("user"),
            "from": request.query_params.get("from") or request.query_params.get("spent_on_after"),
            "to": request.query_params.get("to") or request.query_params.get("spent_on_before"),
        }
        if filters.get("project"):
            get_visible_project(request.user, filters["project"])
        payload = ReportService(request.user, filters).build()
        if request.query_params.get("format") == "csv":
            return self._csv(payload)
        return Response(payload)

    def _csv(self, payload):
        response = HttpResponse(content_type="text/csv")
        response["Content-Disposition"] = 'attachment; filename="report.csv"'
        writer = csv.writer(response)
        if "entries" in payload:
            headers = [
                "date",
                "project",
                "task",
                "minutes",
                "comment",
            ]
            include_user = "by_user" in payload
            if include_user:
                headers.insert(3, "user")
            writer.writerow(headers)
            for row in payload["entries"]:
                line = [
                    row["spent_on"],
                    row["project_name"],
                    row["task_name"],
                ]
                if include_user:
                    line.append(row["user_email"])
                line.extend([row["duration_minutes"], row["comment"]])
                writer.writerow(line)
        else:
            writer.writerow(["project", "task", "minutes"])
            for row in payload["by_task"]:
                writer.writerow([row["project_name"], row["task_name"], row["minutes"]])
        return response
