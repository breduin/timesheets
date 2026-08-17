from django.conf import settings
from django.core.validators import MinValueValidator
from django.db import models


class TimeEntry(models.Model):
    task = models.ForeignKey("projects.Task", on_delete=models.PROTECT, related_name="time_entries")
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="time_entries",
    )
    spent_on = models.DateField()
    duration_minutes = models.PositiveIntegerField(validators=[MinValueValidator(1)])
    comment = models.CharField(max_length=500, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-spent_on", "-id"]
        indexes = [
            models.Index(fields=["user", "spent_on"]),
            models.Index(fields=["task", "spent_on"]),
        ]

    def __str__(self):
        return f"{self.user_id} {self.spent_on} {self.duration_minutes}m"
