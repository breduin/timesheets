from django.contrib import admin

from apps.projects.models import Invite, Membership, Project, Task


@admin.register(Project)
class ProjectAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "status", "rate")


@admin.register(Membership)
class MembershipAdmin(admin.ModelAdmin):
    list_display = ("id", "project", "user", "role")


@admin.register(Task)
class TaskAdmin(admin.ModelAdmin):
    list_display = ("id", "project", "name", "status")


@admin.register(Invite)
class InviteAdmin(admin.ModelAdmin):
    list_display = ("id", "project", "email", "role", "accepted_at")
