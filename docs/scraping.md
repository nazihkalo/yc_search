# Diagnose scraping failures and add a residential fallback

Use the comparison command before enabling paid traffic. The default run compares ordinary HTTP with the shared browser pool; it does not contact a proxy or write company/vendor data.

```bash
npm run scrape:compare -- --from-pilot=data/vendor-pilot-nov14-release-100.json --limit=20 --output=data/scrape-comparison-direct.json
```

`--from-pilot` selects up to 20 distinct websites whose latest pilot outcome failed, prioritizing explicit blocking signals. These are **homepage accessibility tests**, not proof that their disclosures can be extracted. For extraction comparisons, provide a JSON cohort of confirmed disclosure or ranking URLs:

```json
[
  { "name": "Example disclosure", "url": "https://example.com/legal/subprocessors", "kind": "vendor" },
  { "name": "LinkedIn ranking", "url": "https://www.linkedin.com/pulse/example-ranking", "kind": "company_list" }
]
```

```bash
npm run scrape:compare -- --cohort=data/scrape-cohort.json --output=data/scrape-comparison.json
```

Kinds are `page`, `vendor`, and `company_list`. `vendor` includes rule-filtered candidate vendors with evidence snippets; these are not LLM-validated relationships. A readable page is a separate result from successful extraction. Manual extraction review starts unset, so cost per verified extraction remains null until results are reviewed and summarized again. The benchmark never invokes a model or upserts vendor relationships. After reviewing snippets/source pages, set each measurement's `manuallyVerifiedExtraction` to true or false and recalculate the summary without making network requests:

```bash
npm run scrape:compare -- --summarize=data/scrape-comparison-proxy.json
```

Methods rotate order across targets to reduce systematic ordering effects. Cookies, changing site state, and shared rate limits still affect results; a cooldown can defer a method before it makes a request. The report separates attempted requests from deferred measurements, records content hashes, durations, status codes, available transfer sizes, and provisional proxy bandwidth costs. It saves after each completed target, retaining completed results if interrupted. Use the same saved cohort for later comparisons.

## Configure the optional proxy

The integration accepts a standard HTTP/HTTPS residential proxy URL. For Decodo, obtain the generated endpoint, proxy username, and proxy password; a management API key is not the credential this transport uses. Start with a small pay-as-you-go allocation and disable automatic top-ups. Use a stable provider session during a browser visit so cookies and the outgoing IP remain consistent.

Set these environment variables on the worker that needs the fallback:

```dotenv
SCRAPE_PROXY_ENABLED=0
SCRAPE_PROXY_URL=http://USERNAME:PASSWORD@PROXY_HOST:PORT
SCRAPE_PROXY_DOMAINS=linkedin.com,example.com
SCRAPE_PROXY_MONTHLY_USD=10
SCRAPE_PROXY_USD_PER_GB=4
SCRAPE_PROXY_REQUEST_MB=10
```

URL-encode special characters in the username/password. Keep the value in local environment configuration or Railway variables. Worker errors redact the URL and its credentials; the Python bridge receives credentials through its private stdin pipe rather than command-line arguments.

Run `npm run db:migrate` with the app database before enabling proxy traffic. The additive `scrape_proxy_budget` and `scrape_proxy_requests` tables share the allowance across worker replicas. The comparison command creates only those tables when `--with-proxy` is requested.

For the paid comparison, enable the proxy and explicitly request its third method:

```bash
SCRAPE_PROXY_ENABLED=1 npm run scrape:compare -- --cohort=data/scrape-cohort.json --with-proxy --output=data/scrape-comparison-proxy.json
```

The URL must also match `SCRAPE_PROXY_DOMAINS`. Entries match that hostname and its subdomains, not lookalike suffixes. Omit `--with-proxy` to guarantee the comparison runs only HTTP/browser methods even when credentials exist. Review cost per usable page and manually verified extraction before leaving fallback enabled on a worker.

## Understand the allowance

The default local estimate is $10/month at $4 per decimal GB, allowing 2.5 GB of measured/reserved traffic. The configured rate is an operator estimate, not a live price or a provider invoice. Each proxy navigation reserves 10 MB before starting; a successful navigation replaces that reservation with reported transfer bytes. Failures and cancellations conservatively consume the full reservation. Settlement is idempotent, and a crash leaves its reservation charged for the month. The month uses the database clock in UTC.

Browser transfer sizes include completed request/response bodies and headers. They can omit startup/background traffic, unfinished transfers, protocol overhead, or provider-specific accounting. Transfers already in flight can exceed a per-request threshold before the browser closes the page. **The local estimate cannot enforce an exact provider dollar ceiling.** Set a hard spending/traffic limit at the provider where available, or keep automatic top-ups disabled and purchase only the intended allocation. Neither the code nor the comparison enables auto-recharge.

Inspect shared usage:

```sql
SELECT month,requests,reserved_bytes,measured_bytes
FROM scrape_proxy_budget ORDER BY month DESC;
```

Reservations left by a crash reduce the remaining allowance. Do not clear them without reconciling provider usage. Changing credentials does not reset the shared monthly allowance.

## Request and browser behavior

- HTTP and top-level browser requests serialize by registered domain within each Node process, with a one-second gap after completion. Private suffixes remain distinct. A 429 or a 503 with `Retry-After` establishes a cooldown, capped at one day; a long cooldown defers work instead of consuming a crawl deadline. Start with one worker because domain pacing is not shared across replicas.
- Two browser workers are used by default, with a separate single proxy worker only when needed. Hostnames route consistently to a worker. Contexts retain cookies across visits to the same hostname, with at most eight contexts per browser. Idle workers close after 30 seconds; cancellation terminates that worker and its browser process group. Another request starts a replacement.
- Playwright derives its user agent from the installed Chromium version/platform and normalizes the `HeadlessChrome` product marker to `Chrome`, keeping the browser version current. Images, media and fonts are blocked; scripts and styles remain available. Crawl4AI converts rendered HTML to Markdown in the same persistent Python worker.
- Vendor discovery processes previously successful and homepage-linked URLs first, crawling as it goes. It stops speculative requests when a vendor-specific document yields strong evidence. Company jobs retain lease and deadline checks while waiting for transport slots.
- Residential fallback applies only to enabled/allowlisted domains after direct browser failure or thin content. It is available to the vendor browser fallback and company-list/profile browser paths. A rate limit defers the request; missing pages and recognized login requirements do not trigger residential fallback.

The browser and HTTP layers report challenge pages and errors for retry. Proxy success is not established by HTTP 200 alone: the comparison checks readable content and retains extraction evidence separately. Publisher-specific parsing and private/gated data access remain separate concerns.

## Tune and roll back

| Variable | Default | Effect |
| --- | --- | --- |
| `SCRAPE_DOMAIN_DELAY_MS` | `1000` | Gap between top-level requests to the same registered domain, per process |
| `SCRAPE_BROWSER_WORKERS` | `2` | Direct browser processes, from 1 to 4; proxy adds at most one |
| `CRAWL4AI_PAGE_TIMEOUT_MS` | `35000` | Browser navigation timeout; caller cancellation also covers pool waits |
| `SCRAPE_COMPARE_TIMEOUT_MS` | `20000` | Per-method comparison timeout; outer HTTP/domain waits can add pacing time |
| `SCRAPE_PROXY_ENABLED` | off | Enables allowlisted residential fallback |
| `SCRAPE_PROXY_DOMAINS` | empty | Hostnames permitted to use the proxy |
| `SCRAPE_PROXY_MONTHLY_USD` | `10` | Estimated monthly allowance, shared in Postgres |
| `SCRAPE_PROXY_USD_PER_GB` | `4` | Price estimate used to convert dollars to a traffic allowance |
| `SCRAPE_PROXY_REQUEST_MB` | `10` | Per-navigation reservation and transfer threshold |

Set `SCRAPE_PROXY_ENABLED=0` and restart the worker to disable paid fallback. Direct HTTP/browser transport continues. Leave usage tables intact for reconciliation. Stop/redeploy workers to change proxy credentials or browser settings cleanly.

Verify against disposable local Postgres and the installed Python/Chromium runtime:

```bash
SCRAPE_TEST_DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/scrape_test SCRAPE_TEST_PYTHON_BIN=.venv/bin/python npm run test:scraping
```

Tests exercise actual Chromium against local pages and an authenticated local proxy, including cookie/process reuse, resource blocking, cancellation recovery, rate limits, credential redaction, concurrent reservations, and settlement. They make no paid provider requests. Real residential-provider recovery requires credentials and a separate comparison run.
