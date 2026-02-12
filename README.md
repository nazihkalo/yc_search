# YC Search

A full Next.js app for:

- ingesting YC company data from `yc-oss/api`
- scraping each company website once with Firecrawl
- storing metadata + scrape snapshots + embeddings in local SQLite
- searching with both faceted keyword search and semantic search

## Stack

- Next.js (App Router, TypeScript, Tailwind)
- SQLite via `better-sqlite3`
- Firecrawl API for website scraping
- OpenAI embeddings (`text-embedding-3-small`) for semantic ranking

## Environment

Create `.env` with:

```bash
FIRECRAWL_API_KEY=...
OPENAI_API_KEY=...
# optional:
# DATABASE_PATH=./data/yc_search.sqlite
# SYNC_TOKEN=your-shared-secret-for-api-sync
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

### Incremental behavior

- `sync:yc` upserts YC data and marks only changed/new companies for scrape/embed.
- `sync:scrape` scrapes only rows with `needs_scrape = 1`.
- `sync:embed` embeds only rows with `needs_embed = 1` and skips unchanged content hashes.

This keeps scraping and embedding one-time unless company data/content changes.

## API Endpoints

- `GET /api/facets` -> available tags, industries, years, stages, regions
- `GET /api/search` -> keyword + faceted search
- `GET /api/semantic-search` -> semantic search over precomputed embeddings
- `POST /api/sync` -> runs `sync:all` (optional token auth via `Authorization: Bearer <SYNC_TOKEN>`)

## Notes

- Semantic search requires `OPENAI_API_KEY`.
- Firecrawl scraping requires `FIRECRAWL_API_KEY`.
- SQLite lives in `./data/yc_search.sqlite` by default.
