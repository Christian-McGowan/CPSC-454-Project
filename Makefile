.PHONY: install dev backend frontend lint security smoke

install:
	cd backend && npm install
	cd frontend && npm install

dev:
	docker compose -f docker-compose.dev.yml up --build

backend:
	cd backend && npm run dev

frontend:
	cd frontend && npm run dev

lint:
	cd backend && npm run lint

security:
	bash scripts/run-local-security-checks.sh

smoke:
	bash scripts/smoke-test.sh
