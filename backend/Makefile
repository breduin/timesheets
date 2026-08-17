COMPOSE := docker compose --env-file .env -f ../docker-compose.yml

.PHONY: up down rebuild logs test migrate

run:
	$(COMPOSE) up -d --build

stop:
	$(COMPOSE) down

rerun:
	$(COMPOSE) down
	$(COMPOSE) up -d --build

logs:
	$(COMPOSE) logs -f

test:
	$(COMPOSE) exec web pytest -q

migrate:
	$(COMPOSE) exec web python manage.py migrate
