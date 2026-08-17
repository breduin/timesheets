from apps.projects.models import Membership, Project


MANAGE_PROJECT_ROLES = {Membership.Role.OWNER}
MANAGE_MEMBERS_ROLES = {
    Membership.Role.OWNER,
    Membership.Role.MANAGER,
    Membership.Role.DEVELOPER,
}
MANAGE_TASKS_ROLES = {Membership.Role.OWNER, Membership.Role.MANAGER}
OWN_ENTRIES_ROLES = {
    Membership.Role.OWNER,
    Membership.Role.MANAGER,
    Membership.Role.DEVELOPER,
}
OTHERS_ENTRIES_ROLES = {Membership.Role.OWNER, Membership.Role.MANAGER}
SEE_ALL_ENTRIES_ROLES = {Membership.Role.OWNER, Membership.Role.MANAGER}
INVITE_ROLES = {
    Membership.Role.MANAGER,
    Membership.Role.DEVELOPER,
    Membership.Role.VIEWER,
}


def get_membership(user, project):
    if user is None or not user.is_authenticated:
        return None
    return Membership.objects.filter(user=user, project=project).first()


def get_role(user, project):
    membership = get_membership(user, project)
    return membership.role if membership else None


def create_project(*, user, name, description="", status=Project.Status.ACTIVE, rate=0):
    project = Project.objects.create(
        name=name,
        description=description,
        created_by=user,
        status=status,
        rate=rate or 0,
    )
    Membership.objects.create(project=project, user=user, role=Membership.Role.OWNER)
    return project
