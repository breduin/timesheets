from django.urls import path

from apps.tracking.views import ReportSummaryView, TimeEntryDetailView, TimeEntryListCreateView

urlpatterns = [
    path("time-entries/", TimeEntryListCreateView.as_view()),
    path("time-entries/<int:pk>/", TimeEntryDetailView.as_view()),
    path("reports/summary/", ReportSummaryView.as_view()),
]
