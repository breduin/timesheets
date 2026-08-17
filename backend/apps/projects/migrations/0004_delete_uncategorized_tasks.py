from django.db import migrations


def drop_uncategorized_tasks(apps, schema_editor):
    Task = apps.get_model("projects", "Task")
    TimeEntry = apps.get_model("tracking", "TimeEntry")
    for task in Task.objects.filter(name="Без категории"):
        if not TimeEntry.objects.filter(task_id=task.id).exists():
            task.delete()


class Migration(migrations.Migration):

    dependencies = [
        ("projects", "0003_project_rate_drop_uncategorized"),
        ("tracking", "0002_initial"),
    ]

    operations = [
        migrations.RunPython(drop_uncategorized_tasks, migrations.RunPython.noop),
    ]
