#!/bin/sh
set -e

python - <<'PY'
import os
import socket
import time

host = os.environ.get("POSTGRES_HOST", "db")
port = int(os.environ.get("POSTGRES_PORT", "5432"))
for _ in range(60):
    try:
        conn = socket.create_connection((host, port), 2)
        conn.close()
        break
    except OSError:
        time.sleep(1)
else:
    raise SystemExit(f"Postgres {host}:{port} is not ready")
PY

if [ "${RUN_MIGRATIONS}" = "1" ]; then
    python manage.py migrate --noinput
    python manage.py collectstatic --noinput
    python manage.py shell -c "
import os
from django.contrib.auth import get_user_model
User = get_user_model()
email = os.environ.get('DJANGO_SUPERUSER_EMAIL')
password = os.environ.get('DJANGO_SUPERUSER_PASSWORD')
if email and password and not User.objects.filter(email=email).exists():
    User.objects.create_superuser(email=email, password=password)
"
fi

if [ "$#" -gt 0 ]; then
    exec "$@"
fi

if [ "${RUN_MIGRATIONS}" = "1" ]; then
    exec gunicorn config.wsgi:application --bind 0.0.0.0:8000 --reload --timeout 120
fi

exec celery -A config worker --loglevel=info
