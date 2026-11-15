# Operate company list discovery

This job discovers publisher company lists and imports supported company memberships independently of YC sync and vendor crawling. Its Railway service uses the separate daily configuration below.

## Run a bounded batch

Use the app's `DATABASE_URL` and `OPENAI_API_KEY`. Add `EXA_API_KEY` for automatic web discovery beyond seed and hub links.

```bash
npm run db:migrate
npm run discover:companies -- --pages=20 --searches=8 --year=2026 --lookback=4 --profiles=5 --browser
```

The CLI exits after one batch. It seeds the twelve supplied regional LinkedIn Top Startups URLs, the LinkedIn Top Companies hub, and CNBC, Fortune, and Forbes entry points. These URLs are starting candidates, not claims that a ranking exists or is publicly readable. The supplied double-encoded French URL is preserved so a bad URL remains visible rather than being silently replaced.

Search queries rotate across publisher, ranking family, and year (current year through four years earlier by default). Families include LinkedIn Top Startups/Top Companies, CNBC Disruptor 50, Fortune AI Innovators/Future 50, and Forbes AI 50/Cloud 100/Next Billion Dollar Startups. The default year advances with UTC time; `--year` allows historical backfills. The publisher allowlist is in `lib/company-discovery/sources.ts`.

Exa search results enqueue URLs; snippets never establish list membership. Hub links also enqueue candidate lists, including editions in other regions and years. Newly found URLs enter subsequent batches. Without `EXA_API_KEY`, seeds and hub traversal still run and the summary reports `searchConfigured:false`.

The job retrieves public HTML, removes page chrome, and preserves links in extraction text. A reusable parser extracts numbered LinkedIn rankings without model calls and checks contiguous ranks and the entry count advertised by the title. Other layouts use a model once per distinct content hash and extractor version. It must supply exact excerpts containing each company name; unsupported excerpts fail the extraction. Official websites must appear in the same quoted entry or in the public company profile's explicit Website field, whose evidence is saved separately. Model interpretation of membership still needs sample-based quality review before large imports.

`--browser` enables the existing Crawl4AI runtime when HTTP retrieval fails or returns short content, and enables bounded public company-profile website resolution. Configure `CRAWL4AI_PYTHON_BIN` as in the README. Unrecovered HTTP errors, login gates, paywalls, CAPTCHA pages, missing lists, oversized pages, and incomplete model output stay failures. The job does not log into publishers. Optional allowlisted residential routing is described in [scraping operations](scraping.md); rate limits still defer requests. Direct HTTP requests to the supplied LinkedIn US article and representative CNBC/Fortune pages returned HTTP 403 during the local check. Normal public browser retrieval succeeded for the supplied LinkedIn US and Australia articles, yielding all 50 and 20 ranked entries respectively. CNBC/Fortune extraction remains unverified.

Limits are per batch: up to 200 pages and 100 search requests; each search requests ten results. Default Railway config requests 30 list/hub pages, eight searches, and up to five additional public company profiles. HTML is capped at 2 MB and model input at 100,000 characters, with a 14,000-token output cap per uncached page. These bound requests rather than dollars; inspect provider billing for actual charges. Large, paginated, gated and JavaScript-only lists may need dedicated publisher adapters. Change `EXTRACTION_VERSION` to re-extract cached pages after an extraction change.

## Company identity and downstream work

A company keeps its original YC/Forbes metadata. `company_list_memberships` records each publisher URL, rank, evidence, document, and resolution separately. Editions and regional articles have separate URLs and memberships. Domain matching uses registered domains with private suffix support, and ambiguous existing domains are held for review. Same-name companies with different or missing websites are also held for reconciliation. When a ranked entry links to a LinkedIn company profile, that stable profile URL can identify and index a new company before its website is known. The browser profile resolver processes up to `--profiles=5` pending profiles per batch, accepts only an explicit public Website field, and stores its excerpt and content hash. No website is guessed and no name-only merge occurs. Entries lacking both a usable profile and a website stay unresolved.

Resolved new companies get IDs from a separate negative range with collision checks. The list year never becomes the founding/launch year. New rows with websites request website scraping, embedding and vendor enrichment, while disabling YC profile scraping. Profile-only rows initially request embeddings; website and vendor work starts when a supported website is resolved. A domain conflict with another existing company stays in review. The existing sync and vendor services consume those flags; this job only performs discovery/import. Existing companies receive new list context for keyword/semantic indexing without overwriting their `source_kind` or `company_hash`.

Publisher source filters include memberships on existing YC companies, with distinct company counts. Keyword search matches ranking titles, years and regions. Embeddings include list context on the next embedding pass. The company detail panel links to its lists. Provenance is historical: absence from a later page does not remove an earlier observation or establish that a company left a ranking.

## Schedule on Railway

1. Deploy the updated application and migrate its schema before using the new search/detail queries. Existing sync services should also run this version so the embedding pass reads list context.
2. Create a separate service from this repository. Set its start command to `npm run discover:companies -- --pages=30 --searches=8 --lookback=4 --profiles=5 --browser`, its cron schedule to `0 5 * * *` (**05:00 UTC**), and its restart policy to `NEVER`. These values are recorded in `railway.company-discovery.json`; new Railway services may require configuring them directly in service settings because legacy config-file paths are deprecated.
3. Set `DATABASE_URL`, `OPENAI_API_KEY`, and `EXA_API_KEY` on this service. Set `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` for the shared Dockerfile's Next.js build. The Dockerfile installs Crawl4AI if `--browser` is enabled later. Use the OpenAI endpoint appropriate to the key; do not inherit an unrelated gateway setting.
4. Check the JSON summary in service logs and the database queries below. A batch may finish with `partial` status even when the process exits normally; alert on source failures and run status, not process exit alone.

The worker initializes only its additive discovery tables. A Postgres session lock allows one discovery run at a time. Interrupted runs are marked on the next invocation. Import transactions also serialize company identity allocation. Sources refresh after 14 days; search queries after seven days. Failed pages retry with exponential hourly backoff capped at seven days, retaining their last successful evidence. Blocked sources can require an approved feed or manual publisher export before extraction is possible.

## Inspect results and review unresolved identities

```sql
SELECT * FROM company_discovery_runs ORDER BY started_at DESC LIMIT 10;

SELECT url,status,attempts,last_error,next_check_at
FROM company_list_sources ORDER BY last_checked_at DESC NULLS LAST;

SELECT lm.company_name,lm.resolution,lm.website,lm.evidence,lm.source_url,
       ls.title,ls.list_year,ls.region
FROM company_list_memberships lm
JOIN company_list_sources ls ON ls.url=lm.source_url
WHERE lm.company_id IS NULL OR lm.resolution='profile_needs_website';
```

Profile-only entries are indexed and queued for public profile website resolution. Inspect evidence for blocked profiles, entries without stable identities, and ambiguous/name-conflicting existing companies. Resolve conflicting identities before retrying. Profile website failures back off seven days; successful mappings are cached and website changes are not automatically reconciled. A cached document is imported again on a due check, so changed domain mappings can resolve without another model request.

To retry a source after correcting access/configuration:

```sql
UPDATE company_list_sources SET next_check_at=NOW() WHERE url='https://www.linkedin.com/hubs/top-companies';
```

To stop discovery, pause/delete the Railway cron service. Leave the additive tables intact to preserve evidence; stop downstream workers too if newly discovered companies should not be enriched. Already imported companies remain searchable.

## Verify locally

Use a disposable local Postgres database. The suite creates and drops an isolated schema, uses synthetic publisher documents, and makes no paid search/model calls.

```bash
DISCOVERY_TEST_DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/discovery_test npm run test:discovery
npm run typecheck
```

The tests cover URL normalization, historical searches, evidence checks, domain ambiguity, ID collisions, repeat imports, concurrent runs, cached extraction, browser recovery, profile website resolution, blocked-source retries, and keyword/source-filter behavior. They do not establish publisher extraction precision or broad source coverage.

A separate local smoke check used browser-fetched LinkedIn US/Australia content to import 70 ranked entries into disposable Postgres, repeated imports to check deduplication, and resolved Anthropic's website from its public profile. See the ignored local report `data/company-discovery-smoke.json` for actual counts. This sample does not validate every regional list, all 70 websites, publisher-general extraction, or production operation.
