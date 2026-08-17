# Timesheets

Учёт рабочего времени по проектам и задачам: записи, недельный вид, роли (owner / manager / developer / viewer), приглашения по email, сводные отчёты и CSV.

## Стек

**Backend:** Django 5.2, Django REST Framework, SimpleJWT, Djoser, Celery, Gunicorn.

**Frontend:** SolidJS, Solid Router, TypeScript, Vite.

**Инфра:** PostgreSQL 16, Redis 7, Docker Compose.

## Деплой

Бэкенд поднимается через Docker Compose из `backend/`. Фронтенд в compose не входит — его запускают отдельно.

1. Скопировать `backend/.env.example` в `backend/.env` и заполнить секреты, SMTP и `FRONTEND_URL`.
2. Из `backend/`: `make run` — Postgres, Redis, API (`:8000`) и Celery worker. При старте web-контейнера прогоняются миграции, collectstatic и создаётся суперпользователь из `DJANGO_SUPERUSER_EMAIL` / `DJANGO_SUPERUSER_PASSWORD`.
3. Из `frontend/`: `make dev` — Vite на `:5173`. Для продакшена: `make build`.

API: `http://localhost:8000`. Админка: `http://localhost:8000/admin/`. UI: `http://localhost:5173`.

## Make

Из `backend/`:

| Команда | Что делает |
|---|---|
| `make run` | Собрать образы и поднять стек в фоне |
| `make stop` | Остановить и снять контейнеры |
| `make rerun` | `stop` + `run` |
| `make logs` | Логи compose, follow |
| `make migrate` | `manage.py migrate` в контейнере `web` |
| `make test` | `pytest` в контейнере `web` |

Из `frontend/`:

| Команда | Что делает |
|---|---|
| `make dev` | `npm install` и dev-сервер Vite |
| `make build` | `npm install` и production-сборка |
