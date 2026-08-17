from django.db.models import Sum
from rest_framework import serializers

from apps.projects.models import Invite, Membership, Project, Task
from apps.projects.services import INVITE_ROLES
from apps.users.serializers import UserSerializer


class ProjectSerializer(serializers.ModelSerializer):
    role = serializers.SerializerMethodField()
    tasks_total = serializers.SerializerMethodField()
    tasks_done = serializers.SerializerMethodField()
    total_minutes = serializers.SerializerMethodField()

    class Meta:
        model = Project
        fields = (
            "id",
            "name",
            "description",
            "status",
            "rate",
            "is_archived",
            "role",
            "tasks_total",
            "tasks_done",
            "total_minutes",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "id",
            "is_archived",
            "role",
            "tasks_total",
            "tasks_done",
            "total_minutes",
            "created_at",
            "updated_at",
        )

    def get_role(self, obj):
        request = self.context.get("request")
        if not request or not request.user.is_authenticated:
            return None
        for membership in obj.memberships.all():
            if membership.user_id == request.user.id:
                return membership.role
        return None

    def get_tasks_total(self, obj):
        return obj.tasks.filter(is_archived=False).count()

    def get_tasks_done(self, obj):
        return obj.tasks.filter(is_archived=False, status=Task.Status.DONE).count()

    def get_total_minutes(self, obj):
        return obj.tasks.filter(is_archived=False).aggregate(
            minutes=Sum("time_entries__duration_minutes")
        )["minutes"] or 0


class ProjectWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = Project
        fields = ("name", "description", "status", "rate")

    def validate_rate(self, value):
        if value is None or value < 0:
            raise serializers.ValidationError("Ставка должна быть целым неотрицательным числом.")
        return value


class MembershipSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)
    user_id = serializers.IntegerField(write_only=True, required=False)

    class Meta:
        model = Membership
        fields = ("id", "user", "user_id", "role", "created_at")
        read_only_fields = ("id", "user", "created_at")

    def validate_role(self, value):
        if self.instance and self.instance.role == Membership.Role.OWNER:
            raise serializers.ValidationError("Роль владельца нельзя сменить.")
        if value == Membership.Role.OWNER:
            raise serializers.ValidationError("Нельзя назначить владельца.")
        return value


class TaskSerializer(serializers.ModelSerializer):
    project_id = serializers.IntegerField(source="project.id", read_only=True)
    project_name = serializers.CharField(source="project.name", read_only=True)
    total_minutes = serializers.SerializerMethodField()

    class Meta:
        model = Task
        fields = (
            "id",
            "project_id",
            "project_name",
            "name",
            "status",
            "is_archived",
            "total_minutes",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "id",
            "project_id",
            "project_name",
            "total_minutes",
            "created_at",
            "updated_at",
        )

    def get_total_minutes(self, obj):
        value = getattr(obj, "total_minutes", None)
        if value is not None:
            return value
        return obj.time_entries.aggregate(minutes=Sum("duration_minutes"))["minutes"] or 0


class InviteSerializer(serializers.ModelSerializer):
    invited_by = UserSerializer(read_only=True)

    class Meta:
        model = Invite
        fields = (
            "id",
            "email",
            "role",
            "expires_at",
            "accepted_at",
            "invited_by",
            "created_at",
        )
        read_only_fields = ("id", "expires_at", "accepted_at", "invited_by", "created_at")

    def validate_role(self, value):
        if value not in INVITE_ROLES:
            raise serializers.ValidationError("Эту роль нельзя назначить приглашением.")
        return value


class InvitePreviewSerializer(serializers.ModelSerializer):
    project_name = serializers.CharField(source="project.name", read_only=True)

    class Meta:
        model = Invite
        fields = ("email", "role", "project_name", "expires_at")


class InviteAcceptSerializer(serializers.Serializer):
    password = serializers.CharField(write_only=True, required=False, allow_blank=True)
