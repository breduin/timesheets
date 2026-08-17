from rest_framework.exceptions import NotFound, PermissionDenied
from rest_framework.permissions import BasePermission

from apps.projects.models import Project
from apps.projects.services import get_membership, get_role


def get_visible_project(user, project_id):
    try:
        project = Project.objects.get(pk=project_id)
    except Project.DoesNotExist as exc:
        raise NotFound() from exc
    if get_membership(user, project) is None:
        raise PermissionDenied("Нет доступа к проекту.")
    return project


def require_role(user, project, allowed_roles):
    role = get_role(user, project)
    if role is None:
        raise PermissionDenied("Нет доступа к проекту.")
    if role not in allowed_roles:
        raise PermissionDenied("Недостаточно прав.")
    return role


class IsAuthenticatedAndActive(BasePermission):
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.is_active)
