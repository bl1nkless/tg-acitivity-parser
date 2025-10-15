PYTHON ?= python
PIP ?= pip

.PHONY: install install-dev lint format format-check test migrate run-api run-collector

install:
	$(PIP) install -e .

install-dev:
	$(PIP) install -e .[dev]

lint:
	ruff check api collector common tests
	isort --check-only api collector common tests
	black --check api collector common tests

format:
	isort api collector common tests
	black api collector common tests

format-check:
	black --check api collector common tests

test:
	pytest

migrate:
	alembic -c migrations/alembic.ini upgrade head

run-api:
	uvicorn api.main:app --host 0.0.0.0 --port 8000 --reload

run-collector:
	python -m collector.app
