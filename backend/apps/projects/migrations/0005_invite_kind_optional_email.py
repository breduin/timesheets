from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("projects", "0004_delete_uncategorized_tasks"),
    ]

    operations = [
        migrations.AddField(
            model_name="invite",
            name="kind",
            field=models.CharField(
                choices=[("email", "Email"), ("link", "Ссылка"), ("token", "Токен")],
                default="email",
                max_length=16,
            ),
        ),
        migrations.AlterField(
            model_name="invite",
            name="email",
            field=models.EmailField(blank=True, default="", max_length=254),
        ),
        migrations.AddIndex(
            model_name="invite",
            index=models.Index(fields=["kind", "project"], name="projects_in_kind_5c1e8a_idx"),
        ),
    ]
