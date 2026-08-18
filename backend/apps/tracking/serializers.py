from datetime import timedelta

from django.contrib.auth import get_user_model
from django.db.models import Q
from django.utils import timezone
from rest_framework import serializers

from apps.projects.models import Membership
from apps.projects.services import OTHERS_ENTRIES_ROLES, OWN_ENTRIES_ROLES, SEE_ALL_ENTRIES_ROLES, get_role
from apps.tracking.models import TimeEntry

User = get_user_model()


class TimeEntrySerializer(serializers.ModelSerializer):
    task_name = serializers.CharField(source="task.name", read_only=True)
    task_status = serializers.CharField(source="task.status", read_only=True)
    project_id = serializers.IntegerField(source="task.project_id", read_only=True)
    project_name = serializers.CharField(source="task.project.name", read_only=True)
    user_email = serializers.EmailField(source="user.email", read_only=True)
    user_id = serializers.IntegerField(source="user.id", read_only=True)
    user = serializers.IntegerField(write_only=True, required=False)

    class Meta:
        model = TimeEntry
        fields = (
            "id",
            "task",
            "task_name",
            "task_status",
            "project_id",
            "project_name",
            "user",
            "user_id",
            "user_email",
            "spent_on",
            "duration_minutes",
            "comment",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "id",
            "task_name",
            "task_status",
            "project_id",
            "project_name",
            "user_id",
            "user_email",
            "created_at",
            "updated_at",
        )

    def validate_spent_on(self, value):
        if value > timezone.localdate() + timedelta(days=1):
            raise serializers.ValidationError("Дата не может быть позже чем завтра.")
        return value

    def validate(self, attrs):
        request = self.context["request"]
        task = attrs.get("task") or getattr(self.instance, "task", None)
        if task is None:
            raise serializers.ValidationError({"task": "Задача обязательна."})
        if task.is_archived:
            raise serializers.ValidationError({"task": "Нельзя писать время в архивную задачу."})
        if task.status != task.Status.IN_PROGRESS:
            raise serializers.ValidationError(
                {"task": "Время можно учитывать только по задачам в статусе «В работе»."}
            )
        role = get_role(request.user, task.project)
        if role is None:
            raise serializers.ValidationError("Нет доступа к проекту.")
        if role not in OWN_ENTRIES_ROLES:
            raise serializers.ValidationError("Недостаточно прав для учёта времени.")

        target_user_id = attrs.pop("user", None)
        if self.instance is None:
            if target_user_id and target_user_id != request.user.id:
                if role not in OTHERS_ENTRIES_ROLES:
                    raise serializers.ValidationError({"user": "Нельзя писать время за другого."})
                if not Membership.objects.filter(project=task.project, user_id=target_user_id).exists():
                    raise serializers.ValidationError({"user": "Пользователь не в проекте."})
                attrs["user"] = User.objects.get(pk=target_user_id)
            else:
                attrs["user"] = request.user
        else:
            attrs.pop("user", None)
            if self.instance.user_id != request.user.id and role not in OTHERS_ENTRIES_ROLES:
                raise serializers.ValidationError("Нельзя править чужие записи.")
        return attrs


def visible_entries_q(user):
    memberships = Membership.objects.filter(user=user)
    see_all_ids = memberships.filter(role__in=SEE_ALL_ENTRIES_ROLES).values_list(
        "project_id", flat=True
    )
    developer_ids = memberships.filter(role=Membership.Role.DEVELOPER).values_list(
        "project_id", flat=True
    )
    return Q(task__project_id__in=see_all_ids) | Q(
        task__project_id__in=developer_ids, user=user
    )
