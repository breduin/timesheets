from django.contrib import admin

from apps.tracking.models import TimeEntry


@admin.register(TimeEntry)
class TimeEntryAdmin(admin.ModelAdmin):
    list_display = ("id", "user", "task", "spent_on", "duration_minutes")
