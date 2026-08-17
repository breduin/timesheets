from django.urls import path

from apps.projects.views import (
    InviteAcceptView,
    InvitePreviewView,
    MemberDetailView,
    MemberListView,
    ProjectDetailView,
    ProjectInviteListCreateView,
    ProjectInviteRevokeView,
    ProjectListCreateView,
    ProjectTaskListCreateView,
    TaskDetailView,
)

urlpatterns = [
    path("projects/", ProjectListCreateView.as_view()),
    path("projects/<int:pk>/", ProjectDetailView.as_view()),
    path("projects/<int:project_id>/members/", MemberListView.as_view()),
    path("projects/<int:project_id>/members/<int:user_id>/", MemberDetailView.as_view()),
    path("projects/<int:project_id>/invites/", ProjectInviteListCreateView.as_view()),
    path("projects/<int:project_id>/invites/<int:invite_id>/", ProjectInviteRevokeView.as_view()),
    path("projects/<int:project_id>/tasks/", ProjectTaskListCreateView.as_view()),
    path("tasks/<int:pk>/", TaskDetailView.as_view()),
    path("invites/<str:token>/", InvitePreviewView.as_view()),
    path("invites/<str:token>/accept/", InviteAcceptView.as_view()),
]
