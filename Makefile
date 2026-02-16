SHELL := /bin/bash
UV ?= uv
PYTHON_BIN := .venv/bin/python

.PHONY: help setup setup-node setup-python setup-env doctor dev sync-all compare clean-python

help:
	@echo "Targets:"
	@echo "  make setup         - Full bootstrap (node + python + env defaults)"
	@echo "  make setup-node    - Install Node dependencies"
	@echo "  make setup-python  - Create uv venv and install Crawl4AI runtime"
	@echo "  make setup-env     - Create/update .env with Crawl4AI defaults"
	@echo "  make doctor        - Verify Crawl4AI import in the venv"
	@echo "  make dev           - Run Next.js dev server"
	@echo "  make sync-all      - Run full ingest/scrape/embed pipeline"
	@echo "  make compare       - Run Crawl4AI vs FireCrawl sample compare"
	@echo "  make clean-python  - Remove local Python venv"

setup: setup-node setup-python setup-env
	@echo "Setup complete. Run: make dev"

setup-node:
	npm install

setup-python:
	$(UV) venv .venv
	$(UV) pip install --python $(PYTHON_BIN) -r requirements-crawl4ai.txt
	$(PYTHON_BIN) -m crawl4ai.install
	$(PYTHON_BIN) -m playwright install chromium

setup-env:
	@if [ ! -f .env ]; then \
		cp .env.example .env; \
		echo "Created .env from .env.example"; \
	fi
	@if ! rg -q '^CRAWL4AI_PYTHON_BIN=' .env; then \
		printf "\nCRAWL4AI_PYTHON_BIN=$(PYTHON_BIN)\n" >> .env; \
	fi
	@if ! rg -q '^CRAWL4AI_PAGE_TIMEOUT_MS=' .env; then \
		printf "CRAWL4AI_PAGE_TIMEOUT_MS=35000\n" >> .env; \
	fi

doctor:
	$(PYTHON_BIN) -c "import crawl4ai; print('crawl4ai', crawl4ai.__version__)"

dev:
	npm run dev

sync-all:
	npm run sync:all

compare:
	npm run test:crawl4ai:compare -- --limit=2

clean-python:
	rm -rf .venv
