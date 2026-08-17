from django.db.models import Sum
from django.db.models.functions import Coalesce
from django.shortcuts import get_object_or_404
from rest_framework import generics, status
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.projects.invites import accept_invite, create_or_refresh_invite
from apps.projects.models import Invite, Membership, Project, Task
from apps.projects.permissions import get_visible_project, require_role
from apps.projects.serializers import (
    InviteAcceptSerializer,
    InvitePreviewSerializer,
    InviteSerializer,
    MembershipSerializer,
    ProjectSerializer,
    ProjectWriteSerializer,
    TaskSerializer,
)
from apps.projects.services import (
    MANAGE_MEMBERS_ROLES,
    MANAGE_PROJECT_ROLES,
    MANAGE_TASKS_ROLES,
    create_project,
)


class ProjectListCreateView(generics.ListCreateAPIView):
    serializer_class = ProjectSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return (
            Project.objects.filter(memberships__user=self.request.user)
            .distinct()
            .prefetch_related("memberships")
        )

    def create(self, request, *args, **kwargs):
        writer = ProjectWriteSerializer(data=request.data)
        writer.is_valid(raise_exception=True)
        project = create_project(user=request.user, **writer.validated_data)
        return Response(
            ProjectSerializer(project, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )


class ProjectDetailView(generics.RetrieveUpdateAPIView):
    serializer_class = ProjectSerializer
    permission_classes = [IsAuthenticated]
    queryset = Project.objects.all()

    def get_object(self):
        return get_visible_project(self.request.user, self.kwargs["pk"])

    def perform_update(self, serializer):
        require_role(self.request.user, serializer.instance, MANAGE_PROJECT_ROLES)
        writer = ProjectWriteSerializer(serializer.instance, data=self.request.data, partial=True)
        writer.is_valid(raise_exception=True)
        writer.save()


class MemberListView(generics.ListAPIView):
    serializer_class = MembershipSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = None

    def get_queryset(self):
        project = get_visible_project(self.request.user, self.kwargs["project_id"])
        return project.memberships.select_related("user").all()


class MemberDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request, project_id, user_id):
        project = get_visible_project(request.user, project_id)
        require_role(request.user, project, MANAGE_MEMBERS_ROLES)
        membership = get_object_or_404(Membership, project=project, user_id=user_id)
        if membership.user_id == request.user.id:
            raise PermissionDenied("Нельзя сменить свою роль.")
        serializer = MembershipSerializer(membership, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)

    def delete(self, request, project_id, user_id):
        project = get_visible_project(request.user, project_id)
        require_role(request.user, project, MANAGE_MEMBERS_ROLES)
        membership = get_object_or_404(Membership, project=project, user_id=user_id)
        if membership.role == Membership.Role.OWNER:
            raise PermissionDenied("Владельца нельзя исключить.")
        membership.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class ProjectInviteListCreateView(generics.ListCreateAPIView):
    serializer_class = InviteSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = None

    def get_queryset(self):
        project = get_visible_project(self.request.user, self.kwargs["project_id"])
        require_role(self.request.user, project, MANAGE_MEMBERS_ROLES)
        return project.invites.filter(accepted_at__isnull=True).select_related("invited_by")

    def create(self, request, *args, **kwargs):
        project = get_visible_project(request.user, kwargs["project_id"])
        require_role(request.user, project, MANAGE_MEMBERS_ROLES)
        serializer = InviteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        invite = create_or_refresh_invite(
            project=project,
            email=serializer.validated_data["email"],
            role=serializer.validated_data["role"],
            invited_by=request.user,
        )
        if invite is None:
            return Response({"detail": "Пользователь добавлен в проект."}, status=status.HTTP_201_CREATED)
        return Response(InviteSerializer(invite).data, status=status.HTTP_201_CREATED)


class ProjectInviteRevokeView(APIView):
    permission_classes = [IsAuthenticated]

    def delete(self, request, project_id, invite_id):
        project = get_visible_project(request.user, project_id)
        require_role(request.user, project, MANAGE_MEMBERS_ROLES)
        invite = get_object_or_404(Invite, pk=invite_id, project=project)
        if invite.accepted_at:
            raise ValidationError("Приглашение уже принято.")
        invite.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class InvitePreviewView(APIView):
    permission_classes = [AllowAny]

    def get(self, request, token):
        invite = get_object_or_404(Invite, token=token)
        return Response(InvitePreviewSerializer(invite).data)


class InviteAcceptView(APIView):
    permission_classes = [AllowAny]

    def post(self, request, token):
        invite = get_object_or_404(Invite, token=token)
        serializer = InviteAcceptSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        current_user = request.user if request.user.is_authenticated else None
        accept_invite(
            invite=invite,
            password=serializer.validated_data.get("password"),
            current_user=current_user,
        )
        return Response({"detail": "Приглашение принято."})


class ProjectTaskListCreateView(generics.ListCreateAPIView):
    serializer_class = TaskSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = None

    def get_project(self):
        return get_visible_project(self.request.user, self.kwargs["project_id"])

    def get_queryset(self):
        project = self.get_project()
        qs = project.tasks.all().annotate(
            total_minutes=Coalesce(Sum("time_entries__duration_minutes"), 0)
        )
        status_filter = self.request.query_params.get("status")
        if status_filter:
            qs = qs.filter(status=status_filter)
        archived = self.request.query_params.get("archived")
        if archived == "1":
            return qs
        return qs.filter(is_archived=False)

    def perform_create(self, serializer):
        project = self.get_project()
        require_role(self.request.user, project, MANAGE_TASKS_ROLES)
        serializer.save(project=project)


class TaskDetailView(generics.RetrieveUpdateAPIView):
    serializer_class = TaskSerializer
    permission_classes = [IsAuthenticated]
    queryset = Task.objects.select_related("project").annotate(
        total_minutes=Coalesce(Sum("time_entries__duration_minutes"), 0)
    )

    def get_object(self):
        task = super().get_object()
        get_visible_project(self.request.user, task.project_id)
        return task

    def perform_update(self, serializer):
        require_role(self.request.user, serializer.instance.project, MANAGE_TASKS_ROLES)
        serializer.save()
