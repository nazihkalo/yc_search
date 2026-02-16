# YC Search

A full Next.js app for:

- ingesting YC company data from `yc-oss/api`
- scraping each company website with Crawl4AI
- storing metadata + scrape snapshots + embeddings in local SQLite
- searching with both faceted keyword search and semantic search
- visual analytics by batch over time with optional stacked color-by tags/industries

## Stack

- Next.js (App Router, TypeScript, Tailwind)
- SQLite via `better-sqlite3`
- Crawl4AI (Python runtime) for website scraping
- OpenAI embeddings (`text-embedding-3-small`) for semantic ranking

## Environment

Copy `.env.example` to `.env` (or let `make setup` do it) and set:

```bash
OPENAI_API_KEY=...
# optional:
# DATABASE_PATH=./data/yc_search.sqlite
# SYNC_TOKEN=your-shared-secret-for-api-sync
# CRAWL4AI_PYTHON_BIN=python3
# CRAWL4AI_PAGE_TIMEOUT_MS=35000
```

## Setup (recommended)

Use `uv` + `make` for seamless local bootstrap:

```bash
make setup
```

What `make setup` does:

- installs Node deps (`npm install`)
- creates `.venv` via `uv`
- installs Python deps from `requirements-crawl4ai.txt`
- runs `python -m crawl4ai.install`
- installs Playwright Chromium browser binaries
- creates `.env` from `.env.example` (if missing)
- ensures `.env` has `CRAWL4AI_PYTHON_BIN=.venv/bin/python`

If you prefer manual Python setup:

```bash
uv venv .venv
uv pip install --python .venv/bin/python -r requirements-crawl4ai.txt
.venv/bin/python -m crawl4ai.install
.venv/bin/python -m playwright install chromium
```

Quick verification:

```bash
make doctor
```

## Run

Install deps:

```bash
npm install
```

Start app:

```bash
npm run dev
```

Open `http://localhost:3000`.

## Data Pipeline

Run full pipeline:

```bash
npm run sync:all
```

Or run in steps:

```bash
npm run db:migrate
npm run sync:yc
npm run sync:scrape
npm run sync:embed
```

Scrape all companies in one large pass (Crawl4AI):

```bash
npm run sync:scrape -- --limit=20000
```

Or explicit full refresh flow:

```bash
npm run db:migrate
npm run sync:yc
npm run sync:scrape -- --limit=20000
npm run sync:embed -- --limit=20000
```

Targeted sample run (random 2026 companies):

```bash
npm run test:crawl4ai:sample
# optional:
# npm run test:crawl4ai:sample -- --limit=2
```

### Incremental behavior

- `sync:yc` upserts YC data and marks only changed/new companies for scrape/embed.
- `sync:scrape` scrapes only rows with `needs_scrape = 1` and writes snapshots with `source='crawl4ai'`.
- `sync:embed` embeds only rows with `needs_embed = 1` and skips unchanged content hashes.

This keeps scraping and embedding one-time unless company data/content changes.

## API Endpoints

- `GET /api/facets` -> available tags, industries, years, stages, regions
- `GET /api/search` -> keyword + faceted search
- `GET /api/semantic-search` -> semantic search over precomputed embeddings
- `POST /api/chat` -> chat QA over semantic company retrieval + Crawl4AI snapshot context
- `GET /api/analytics` -> filtered batch chart data, optional stacked category series
- `GET /api/companies/:id/embedding-map` -> PCA-based 2D embedding map for selected/similar/other company clusters
- `POST /api/sync` -> runs `sync:all` (optional token auth via `Authorization: Bearer <SYNC_TOKEN>`)

## Frontend behavior

- Result cards show a small company logo to the left of the name (when available).
- Clicking a tag or industry chip on a company card toggles that value in the filter sidebar.
- The `Analytics` tab uses the current query/filters and draws bars by batch over time.
- In `Analytics`, `Color by` supports:
  - `none` (single bar per batch)
  - `tags` (stacked bars by top tags + `Other`)
  - `industries` (stacked bars by top industries + `Other`)
- Each company detail page includes a 2D PCA embedding map:
  - selected company (color 1)
  - similar companies (color 2)
  - all other companies (color 3)
- Each company detail page shows a Crawl4AI website snapshot section with:
  - extracted description
  - extracted URLs
  - full markdown (expand/collapse)
- Search dashboard includes an **Ask YC Chat** panel:
  - asks natural-language questions over semantic company retrieval
  - uses YC metadata plus Crawl4AI snapshot content
  - returns answer text with cited company links and extracted URLs/socials

## Notes

- Semantic search requires `OPENAI_API_KEY`.
- Crawl4AI requires a working Python env where `crawl4ai` is installed.
- SQLite lives in `./data/yc_search.sqlite` by default.
