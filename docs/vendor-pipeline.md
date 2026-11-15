# Operate the vendor pipeline

Use the vendor worker to crawl public company disclosures independently of the company sync. It uses the existing Postgres database for jobs, retries, crawl versions, and relationship observations.

## Start with a fixed cohort

Run these commands with `DATABASE_URL`, `OPENAI_API_KEY`, and the Crawl4AI Python runtime configured as described in the README:

```bash
npm run db:migrate
npm run vendor:pilot -- --create=initial-100 --limit=100
npm run vendor:worker -- --pilot=initial-100 --limit=100
npm run vendor:pilot -- --report=initial-100
```

The pilot captures up to 100 companies with websites, sampling across source, industry, and team-size buckets. Reusing a pilot name preserves its original membership and baseline time. This is a coverage pilot, not a representative estimate of all technology companies.

The worker processes at most the requested number of attempts. Failed jobs wait before retrying; rerun the worker after the backoff, or use `--continuous` to keep processing this cohort. An unknown pilot name fails before any job is scheduled.

The report is saved to `data/vendor-pilot-initial-100.json`. It contains the full cohort denominator, each company's latest outcome, attempt durations, HTTP/crawler/browser/search call counts, validation token counts, and evidence rows for manual review. `--output=PATH` chooses another location. Provider retries and charges are not captured by the token counters; use provider billing to establish actual cost.

Before expanding, review a sample of accepted relationships against their source documents, including different company sizes, industries, and trust platforms. Record false positives and missed rows as well as accepted matches. `manually_verified` starts as null in the report; the worker does not calculate accuracy automatically.

## Deploy a Railway worker

1. Deploy the updated application and run `npm run db:migrate` before starting the new worker. The vendor tables are additive; existing vendor displays keep using the compatibility tables.
2. Create a Railway service from the same repository and Dockerfile. Set the service's start command to the value recorded in `railway.vendor-worker.json`:

   ```bash
   npm run db:migrate && npm run vendor:worker -- --continuous --limit=25
   ```

   Use one replica and restart on failure. New Railway services may reject legacy config-file paths; in that case configure these values directly in service settings.

3. Give it the same `DATABASE_URL`, `OPENAI_API_KEY`, `CRAWL4AI_PYTHON_BIN`, and optional `EXA_API_KEY` and `OPENAI_BASE_URL` as the app. Set `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` for the shared Dockerfile's Next.js build. The Dockerfile already installs Chromium and Crawl4AI.
4. Set `VENDOR_DEDICATED_WORKER=1` on the incremental sync service so vendor crawls no longer wait behind founder enrichment. Keep the flag unset until the dedicated worker is running. Deploy all existing sync services to this version before adding replicas; older versions do not participate in job leasing.
5. Check worker logs for `vendor_batch` and inspect the queue:

   ```bash
   npm run vendor:worker -- --status
   ```

   For a production rollout, create a pilot first and set `VENDOR_PILOT_ID` on the worker to restrict its continuous batches to that cohort. After checking live evidence, remove the variable and redeploy to backfill the full database. An explicit `--pilot` argument takes precedence over the environment variable.

   `/api/sync/status` also includes `vendorQueue`. `dead` jobs need investigation; `expired` jobs are reclaimed when a worker next claims work. A successful batch can still contain individual failed attempts, which remain in the queue for retry.

For a bounded cron service, omit `--continuous` and schedule it at the desired interval. A continuous worker and a cron service can coexist after both use the new job implementation.

## Tune throughput and refreshes

| Variable | Default | Purpose |
| --- | --- | --- |
| `VENDOR_ENRICHMENT_CONCURRENCY` | `3` | Companies processed concurrently per process |
| `VENDOR_MAX_ATTEMPTS` | `4` | Attempts before a job becomes `dead` |
| `VENDOR_RETRY_SECONDS` | `60` | Initial retry backoff, doubled per failure up to one day |
| `VENDOR_LEASE_SECONDS` | `300` | Claim lifetime, renewed every third of the interval |
| `VENDOR_COMPANY_TIMEOUT_MS` | `180000` | Per-company deadline; cancels HTTP, browser, and model work and retries the job |
| `VENDOR_REFRESH_DAYS` | `30` | Time after success before another crawl is due |
| `VENDOR_DISCOVERY_URL_LIMIT` | `14` | Initial disclosure URLs checked per company |
| `VENDOR_BROWSER_FALLBACK_LIMIT` | `3` | Extra browser fallback calls per company |
| `VENDOR_EXA_FALLBACK` | unset | Set `1` to search when no vendors were extracted |
| `VENDOR_LLM_VALIDATION` | enabled | Set `0` only for extraction debugging; disables relationship validation |
| `VENDOR_VALIDATION_MODEL` | `gpt-4o-mini` | Model used to validate company–vendor evidence |

Start with one worker. Increase concurrency or replicas only after measuring memory, upstream throttling, runtime, and cost. Crawl4AI Markdown generation and browser rendering now share a small persistent Python/Chromium pool. Contexts retain sessions, and media requests are blocked. See [scraping operations](scraping.md) for per-domain pacing, the comparison command, and optional residential fallback.

New or updated companies request work through `needs_vendor_enrichment`. Enqueueing consumes that flag; requests made during a crawl remain set for another pass. PostgreSQL row locks prevent duplicate claims, and an ownership check fences the final relationship transaction after a lease expires. Crawlers can repeat work after a crash, so this is at-least-once processing.

The first unrestricted run also queues previously enriched companies that have no durable job record. Use the pilot restriction to validate coverage and cost before starting the continuous worker across the full database.

To retry a dead company after resolving the cause:

```sql
UPDATE companies SET needs_vendor_enrichment = 1 WHERE id = 123;
```

The next enqueue pass resets its attempt budget. Dead jobs do not reset themselves automatically.

## Interpret evidence and history

- `found_vendors`: at least one relationship passed the configured validation.
- `no_public_disclosure`: no validated relationships were found within the crawl budget. This includes readable disclosures with no accepted candidates; it does not prove the company has no vendors.
- `no_website`: the company has no website to crawl.
- `crawl_failed`: fetching, validation, or persistence failed. The job retries until its attempt budget is exhausted.
- `lease_expired`: another worker reclaimed an unfinished attempt.

Discovery prioritizes previously successful documents and links from the company's homepage before guessed paths. Links can lead to hosted Vanta, SafeBase, Drata, Secureframe, Trustpage, and Whistic pages. Search evidence must come from the company domain, a subdomain, or an already discovered URL. Hosted-page pagination, gated documents, and PDFs can still limit coverage.

Validation checks relationship evidence even for known vendor names. Responses are cached by company, website, candidate, evidence snippet, URL, and model. Unchanged evidence avoids another model call; extraction still runs. A validation outage fails the attempt rather than turning it into a successful empty result.

Generic Google and Microsoft mentions do not establish use of their cloud products. Evidence snippets match whole vendor names, and navigation links or brands appearing only inside URLs are rejected before model validation.

`vendor_document_versions` retains distinct successful content hashes. `vendor_runs` and `vendor_relationship_observations` retain dated attempts and accepted relationships. Failed fetches do not erase the last successful content or trust URLs. The compatibility tables show the most recently observed evidence and can include older relationships.

Absence in a later crawl does not automatically retire a relationship: a partial page, crawl budget, or changed formatting can hide it. Compare successful observations from equivalent documents before treating a missing vendor as a removal. Public disclosure counts measure observed disclosures, not service quality, market share, or confirmed adoption dates.

Historical snapshots from before this change have no reconstructed timeline. New versions begin accumulating on the first successful crawl with this worker.

## Verify locally and roll back

Run the integration tests against a disposable local PostgreSQL database. Tests create and remove an isolated schema and use local HTTP, crawler, and model fixtures:

```bash
VENDOR_TEST_DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/vendor_test npm run test:vendors
npm run typecheck
```

To stop processing, stop the dedicated Railway worker and unset `VENDOR_DEDICATED_WORKER` on the updated incremental service. It will resume bounded vendor processing with the same queue. Leave the additive tables in place so attempts and evidence remain available. Reverting to an older application version requires stopping all new workers first; older code does not honor their leases or retry schedule.
