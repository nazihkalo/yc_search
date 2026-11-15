import { getDb, withConnection, tryAdvisoryLock, advisoryUnlock } from "../db";
import { exaSearch } from "../exa";
import { scrapeWebsiteMarkdown } from "../crawl4ai";
import { fetchScrapeHtml } from "../scrape-http";
import { ScrapeRateLimitError } from "../scrape-policy";
import { sha256 } from "../hash";
import { DISCOVERY_SEEDS, discoveryQueries, looksLikeList, canonicalListUrl, publisherOf } from "./sources";
import { COMPANY_DISCOVERY_SCHEMA } from "./schema";
import { EXTRACTION_VERSION, extractLinkedInRanking, extractCompanyList, parsePublisherHtml } from "./extract";
import { resolveProfileWebsites } from "./profiles";
import { enqueueSource, persistList } from "./store";

export async function fetchPublisherPage(url: string) {
  if (!publisherOf(url)) throw new Error("Publisher URL not allowed");
  // Redirects remain on the publisher allowlist. No arbitrary destinations from
  // model output/search snippets are fetched by the discovery service.
  let current = url;
  for (let redirects = 0; redirects < 5; redirects++) {
    const response = await fetchScrapeHtml(current, { redirect: "manual", timeoutMs: 25_000, maxBytes: 2_000_001, headers: { "user-agent": "YCSearchCompanyDiscovery/1.0" } });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.location;
      if (!location) throw new Error("Redirect missing location");
      const next = new URL(location, current).href;
      if (!publisherOf(next) || publisherOf(next) !== publisherOf(url)) throw new Error("Redirect outside publisher");
      if (/authwall|login|checkpoint/.test(next)) throw new Error("Publisher requires login");
      current = next;
      continue;
    }
    if (!response.ok) { throw new Error(`Publisher HTTP ${response.status}`); }
    if (!response.contentType.includes("text/html")) { throw new Error("Publisher did not return HTML"); }
    const html = response.html;
    if (Buffer.byteLength(html) >= 2_000_000) throw new Error("Publisher HTML exceeds 2 MB budget");
    return parsePublisherHtml(html, current);
  }
  throw new Error("Too many publisher redirects");
}

export type DiscoveryOptions = { pageLimit: number; searchLimit: number; year: number; lookback: number; browser: boolean; profileLimit?: number };
export async function runCompanyDiscovery(options: DiscoveryOptions, dependencies: {
  fetchPage?: typeof fetchPublisherPage;
  extract?: typeof extractCompanyList;
  search?: typeof exaSearch;
  renderPage?: typeof scrapeWebsiteMarkdown;
} = {}) {
  const fetchPage = dependencies.fetchPage ?? fetchPublisherPage;
  const extract = dependencies.extract ?? extractCompanyList;
  const search = dependencies.search ?? exaSearch;
  const renderPage = dependencies.renderPage ?? scrapeWebsiteMarkdown;
  if (!Number.isInteger(options.year) || options.year < 1990 || options.year > 2100) throw new Error("Invalid discovery year");
  for (const [key, max] of [["pageLimit", 200], ["searchLimit", 100], ["lookback", 20]] as const) {
    if (!Number.isInteger(options[key]) || options[key] < 0 || options[key] > max) throw new Error(`Invalid discovery ${key}`);
  }
  const profileLimit = options.profileLimit ?? 0;
  if (!Number.isInteger(profileLimit) || profileLimit < 0 || profileLimit > 100) throw new Error("Invalid profile limit");
  const db = getDb();
  await db.query(COMPANY_DISCOVERY_SCHEMA);
  return withConnection(async (lock) => {
    if (!await tryAdvisoryLock("company-discovery-cron", lock)) return { skipped: "another run is active" };
    let runId: string | undefined;
    try {
      // An acquired lock proves previous sessions are gone; expose crashed runs.
      await db.query("UPDATE company_discovery_runs SET status='interrupted',finished_at=NOW() WHERE status='running'");
      runId = (await db.query("INSERT INTO company_discovery_runs DEFAULT VALUES RETURNING id")).rows[0].id;
      for (const seed of DISCOVERY_SEEDS) await enqueueSource(seed.url, seed.kind, "seed");
      const summary = { searched: 0, searchErrors: 0, queued: 0, pages: 0, failed: 0, inserted: 0, linked: 0, unresolved: 0, profilesAttempted: 0, profilesResolved: 0, searchConfigured: Boolean(process.env.EXA_API_KEY) };
      if (summary.searchConfigured && options.searchLimit) {
        const queries = discoveryQueries(options.year, options.lookback);
        // Least-recently searched queries rotate through publisher/family/year
        // combinations, including historical editions, across daily runs.
        for (const query of queries) await db.query("INSERT INTO company_discovery_state(key) VALUES ($1) ON CONFLICT DO NOTHING", [query]);
        const due = (await db.query<{ key: string }>("SELECT key FROM company_discovery_state WHERE key=ANY($1::text[]) AND next_check_at<=NOW() ORDER BY next_check_at,key LIMIT $2", [queries, options.searchLimit])).rows;
        for (const { key } of due) {
          summary.searched++;
          try {
            const result = await search(key, { numResults: 10, signal: AbortSignal.timeout(30_000) });
            for (const page of result.results) if (looksLikeList(page.url, page.title ?? "")) {
              if (await enqueueSource(page.url, "list", `search:${key}`)) summary.queued++;
            }
            await db.query("UPDATE company_discovery_state SET next_check_at=NOW()+INTERVAL '7 days' WHERE key=$1", [key]);
          } catch {
            summary.searchErrors++;
            await db.query("UPDATE company_discovery_state SET next_check_at=NOW()+INTERVAL '1 day' WHERE key=$1", [key]);
          }
        }
      }
      const pages = (await db.query<{ url: string; kind: "list" | "hub"; content_hash: string | null }>(`
        SELECT url,kind,content_hash FROM company_list_sources WHERE next_check_at<=NOW()
        ORDER BY next_check_at,CASE WHEN kind='hub' THEN 0 ELSE 1 END,url LIMIT $1`, [options.pageLimit])).rows;
      for (const page of pages) {
        summary.pages++;
        try {
          let pageData;
          try { pageData = await fetchPage(page.url); }
          catch (error) {
            if (!options.browser || error instanceof ScrapeRateLimitError) throw error;
            // A normal public browser can render a page refused by an HTTP
            // client. Auth walls/CAPTCHAs still fail content validation below.
            pageData = { content: "", lists: [] as string[] };
          }
          let { content, lists } = pageData;
          if (options.browser && content.length < 500) {
            content = await renderPage(page.url, { signal: AbortSignal.timeout(90_000), allowProxy: true });
            // Browser content can also expose links hidden behind hydration.
            lists = [...lists, ...[...content.matchAll(/https:\/\/[^\s)<>"\]]+/g)].map((m) => m[0]).filter((url) => looksLikeList(url))];
          }
          if (content.length < 200 || /access denied|captcha|verify you are human/i.test(content.slice(0, 1000))) throw new Error("Blocked or thin publisher content");
          for (const url of lists.slice(0, 200)) if (canonicalListUrl(url) !== page.url && await enqueueSource(url, "list", page.url)) summary.queued++;
          if (page.kind === "list") {
            const cached = await db.query("SELECT extracted FROM company_list_documents WHERE source_url=$1 AND content_hash=$2 AND extractor_version=$3", [page.url, sha256(content), EXTRACTION_VERSION]);
            const list = cached.rows[0]?.extracted ?? (publisherOf(page.url) === "linkedin" ? extractLinkedInRanking(content) : null) ?? await extract(content);
            const saved = await persistList(page.url, content, list);
            summary.inserted += saved.inserted; summary.linked += saved.linked; summary.unresolved += saved.unresolved;
          }
          await db.query(`UPDATE company_list_sources SET status='ok',attempts=0,last_error=NULL,last_checked_at=NOW(),
            next_check_at=NOW()+INTERVAL '14 days' WHERE url=$1`, [page.url]);
        } catch (error) {
          summary.failed++;
          // Store bounded diagnostics without persisting model/provider secrets.
          const message = error instanceof Error ? error.message : "Unknown discovery failure";
          const safe = /^(Publisher HTTP \d+|Publisher requires login|Blocked or|No supported|List exceeds|Incomplete|Unsupported list member|Duplicate or|Redirect|Too many|Publisher HTML)/.test(message) ? message.slice(0, 300) : "Fetch/extraction failed; check network and model configuration";
          await db.query(`UPDATE company_list_sources SET status='retry',attempts=attempts+1,last_error=$2,last_checked_at=NOW(),
            next_check_at=NOW()+GREATEST(LEAST(168, POWER(2, LEAST(attempts,7))) * 3600,$3) * INTERVAL '1 second' WHERE url=$1`,
          [page.url, safe, error instanceof ScrapeRateLimitError ? Math.ceil(error.retryAfterMs / 1000) : 0]);
        }
      }
      if (options.browser && profileLimit) {
        const profiles = await resolveProfileWebsites(profileLimit);
        summary.profilesAttempted = profiles.attempted;
        summary.profilesResolved = profiles.resolved;
        for (const url of profiles.sources) {
          const latest = (await db.query("SELECT content,extracted FROM company_list_documents WHERE source_url=$1 ORDER BY id DESC LIMIT 1", [url])).rows[0];
          if (latest) await persistList(url, latest.content, latest.extracted);
        }
      }
      await db.query("UPDATE company_discovery_runs SET status=$2,summary=$3::jsonb,finished_at=NOW() WHERE id=$1", [runId, summary.failed || summary.searchErrors || summary.profilesAttempted > summary.profilesResolved ? "partial" : "ok", JSON.stringify(summary)]);
      return summary;
    } catch (error) {
      if (runId) await db.query("UPDATE company_discovery_runs SET status='failed',error='Discovery job failed',finished_at=NOW() WHERE id=$1", [runId]);
      throw error;
    } finally { await advisoryUnlock("company-discovery-cron", lock); }
  });
}
