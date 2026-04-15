.PHONY: help up down logs health configure configure-dev configure-up test

EPURE_PORT ?= $(shell grep -E '^EPURE_PORT=' .env 2>/dev/null | tail -1 | cut -d= -f2)
EPURE_PORT ?= 8080

help:
	@echo "Targets:"
	@echo "  make up            docker compose up -d  (default — no .env)"
	@echo "  make down          docker compose down"
	@echo "  make logs          docker compose logs -f epure"
	@echo "  make health        curl /health on EPURE_PORT"
	@echo "  make configure     ./configure --quick (ports only if busy)"
	@echo "  make configure-dev ./configure --dev"
	@echo "  make configure-up  ./configure --quick --up"
	@echo "  make test          ./scripts/test.sh"

up:
	docker compose up -d

down:
	docker compose down

logs:
	docker compose logs -f epure

health:
	curl -fsS "http://localhost:$(EPURE_PORT)/health"

configure:
	./configure --quick

configure-dev:
	./configure --dev

configure-up:
	./configure --quick --up

test:
	./scripts/test.sh
