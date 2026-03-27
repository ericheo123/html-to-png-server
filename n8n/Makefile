SHELL := /bin/zsh

.PHONY: init up down restart logs ps open

init:
	cp -n .env.example .env || true
	mkdir -p data

up:
	docker compose up -d

down:
	docker compose down

restart:
	docker compose down
	docker compose up -d

logs:
	docker compose logs -f --tail=200

ps:
	docker compose ps

open:
	open http://localhost:5678
