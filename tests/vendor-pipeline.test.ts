import assert from "node:assert/strict";
import { after, before, beforeEach, test } from "node:test";
import { randomUUID } from "node:crypto";
import { mkdtemp, writeFile, rm, chmod } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer, type Server } from "node:http";
import { Pool } from "pg";
import { closeScrapeBrowsers } from "../lib/scrape-browser";
import { closeDb, execute, initializeDatabase, query, queryOne, withTransaction } from "../lib/db";
import { claimVendorJob, completeVendorJob, enqueueVendorJobs, failVendorJob, lockVendorJob, renewVendorLease } from "../lib/vendor-jobs";
import { createVendorPilot, getVendorPilotReport } from "../lib/vendor-pilot";
import { enrichCompanyVendors } from "../scripts/enrich-company-vendors";

const testUrl = process.env.VENDOR_TEST_DATABASE_URL;
const schema = `vendor_test_${randomUUID().replaceAll("-", "")}`;
let admin: Pool;
let server: Server;
let origin: string;
let directory: string;
let markdownPath: string;
let validationMode: "accept" | "reject" | "invalid" = "accept";
let validationCalls = 0;
let documentStatus = 200;
let modelDelayMs = 0;

before(async () => {
  if (!testUrl || !["127.0.0.1", "localhost", "[::1]"].includes(new URL(testUrl).hostname)) {
    throw new Error("Set VENDOR_TEST_DATABASE_URL to a disposable local Postgres database");
  }
  admin = new Pool({ connectionString: testUrl });
  await admin.query(`CREATE SCHEMA ${schema}`);
  const scopedUrl = new URL(testUrl);
  scopedUrl.searchParams.set("options", `-csearch_path=${schema}`);
  process.env.DATABASE_URL = scopedUrl.href;
  process.env.SCRAPE_DOMAIN_DELAY_MS = "0";
  process.env.VENDOR_MAX_ATTEMPTS = "2";
  process.env.VENDOR_RETRY_SECONDS = "60";
  process.env.VENDOR_ENRICHMENT_CONCURRENCY = "3";
  process.env.VENDOR_DISCOVERY_URL_LIMIT = "1";
  process.env.VENDOR_LLM_VALIDATION = "1";
  process.env.OPENAI_API_KEY = "local-test-key";
  directory = await mkdtemp(join(tmpdir(), "vendor-pipeline-"));
  markdownPath = join(directory, "document.md");
  const executable = join(directory, "crawler.cjs");
  await writeFile(executable, `#!/usr/bin/env node
const fs = require('node:fs');
require('node:readline').createInterface({input:process.stdin}).on('line',line=>{
const request=JSON.parse(line);
if(process.env.VENDOR_FIXTURE_CRAWLER_FAIL) { console.log(JSON.stringify({id:request.id,success:false,error:'Fixture browser failure',bytes:0}));return; }
const document = fs.readFileSync(process.env.VENDOR_FIXTURE_MARKDOWN_FILE,'utf8');
console.log(JSON.stringify({id:request.id,success:true,markdown:document,text:document,bytes:200,status:200}));
});
`);
  await chmod(executable, 0o755);
  process.env.CRAWL4AI_PYTHON_BIN = executable;
  process.env.VENDOR_FIXTURE_MARKDOWN_FILE = markdownPath;
  server = createServer(async (req, res) => {
    if (req.url === "/v1/chat/completions") {
      validationCalls++;
      let body = "";
      for await (const chunk of req) body += chunk;
      const candidate = JSON.parse(JSON.parse(body).messages[1].content).candidate;
      if (modelDelayMs) await new Promise((resolve) => setTimeout(resolve, modelDelayMs));
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify({ choices: [{ message: { content: JSON.stringify(validationMode === "invalid" ? {} : {
        is_vendor_entity: true, relationship_supported: validationMode === "accept",
        canonical_name: candidate.proposed_canonical_name, category: candidate.proposed_category,
        confidence: 0.9, reason: "fixture evidence decision",
      }) } }], usage: { prompt_tokens: 12, completion_tokens: 5 } }));
      return;
    }
    res.setHeader("content-type", "text/html");
    if (req.url === "/") res.end('<a href="/subprocessors">Subprocessors</a>');
    else { res.statusCode = documentStatus; res.end(documentStatus === 200 ? "Public subprocessors list" : "Unavailable"); }
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert(address && typeof address !== "string");
  origin = `http://127.0.0.1:${address.port}`;
  process.env.OPENAI_BASE_URL = `${origin}/v1`;
  await initializeDatabase();
  // The additive schema is safe to apply more than once.
  const { SCHEMA_SQL } = await import("../db/schema");
  await admin.query(`SET search_path TO ${schema}`);
  await admin.query(SCHEMA_SQL);
});

beforeEach(async () => {
  closeScrapeBrowsers();
  await execute("TRUNCATE companies, vendors, vendor_validation_cache CASCADE");
  validationMode = "accept";
  modelDelayMs = 0;
  delete process.env.VENDOR_COMPANY_TIMEOUT_MS;
  delete process.env.VENDOR_FIXTURE_CRAWLER_FAIL;
  validationCalls = 0;
  documentStatus = 200;
  await writeFile(markdownPath, `# Subprocessors\n\nPurpose: service providers processing customer data on our behalf.\n\n| Name | Service | Location |\n| --- | --- | --- |\n| Amazon Web Services | Cloud hosting | US |\n| Stripe | Payments | US |\n| OpenAI | Model inference | US |\n\n${"Our subprocessors provide the services listed above and process customer data under contract. ".repeat(15)}`);
});

after(async () => {
  closeScrapeBrowsers();
  await closeDb();
  if (server) await new Promise<void>((resolve) => server.close(() => resolve()));
  if (admin) { await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`); await admin.end(); }
  if (directory) await rm(directory, { recursive: true, force: true });
});

async function company(id: number, website: string | null = origin) {
  await execute("INSERT INTO companies (id, name, website) VALUES (@id, @name, @website)",
    { id, name: `Fixture Company ${id}`, website });
}

test("parallel claims are exclusive; crash recovery fences the old worker", async () => {
  await company(1);
  await company(2);
  await Promise.all([enqueueVendorJobs(2), enqueueVendorJobs(2)]);
  const claims = await Promise.all(Array.from({ length: 5 }, () => claimVendorJob()));
  const jobs = claims.filter((job) => job !== null);
  assert.equal(jobs.length, 2);
  assert.equal(new Set(jobs.map((job) => job.company_id)).size, 2);
  const first = jobs[0];
  await execute("UPDATE vendor_jobs SET lease_expires_at = NOW() - interval '1 second' WHERE company_id = @id", { id: first.company_id });
  await assert.rejects(withTransaction(async (client) => { await lockVendorJob(first, client); }), /lease lost/);
  const replacement = await claimVendorJob();
  assert(replacement);
  assert.equal(replacement.company_id, first.company_id);
  assert.notEqual(replacement.lease_token, first.lease_token);
  assert.equal(await renewVendorLease(first), false);
  await assert.rejects(withTransaction(async (client) => { await lockVendorJob(first, client); }), /lease lost/);
  assert.equal(await failVendorJob(first, "stale failure", {}), false);
  assert.equal((await queryOne("SELECT outcome FROM vendor_runs WHERE id = @token", { token: first.lease_token }))?.outcome, "lease_expired");
  assert.equal(await renewVendorLease(replacement), true);
});

test("failures back off, exhaust retries, and only explicit requests restart dead jobs", async () => {
  await company(1);
  await enqueueVendorJobs(1);
  const first = await claimVendorJob(); assert(first);
  await failVendorJob(first, "HTTP 429", {});
  assert.equal(await claimVendorJob(), null);
  assert.equal(await enqueueVendorJobs(1), 0);
  await execute("UPDATE vendor_jobs SET available_at = NOW() - interval '1 second'");
  const second = await claimVendorJob(); assert(second);
  assert.equal(second.attempts, 2);
  await failVendorJob(second, "still unavailable", {});
  assert.equal((await queryOne("SELECT status FROM vendor_jobs"))?.status, "dead");
  assert.equal(await enqueueVendorJobs(1), 0);
  await execute("UPDATE companies SET needs_vendor_enrichment = 1 WHERE id = 1");
  assert.equal(await enqueueVendorJobs(1), 1);
  assert.equal((await claimVendorJob())?.attempts, 1);
});

test("a crashed final attempt becomes dead and stays out of the queue", async () => {
  await company(1);
  await enqueueVendorJobs(1);
  const job = await claimVendorJob(); assert(job);
  await execute("UPDATE vendor_jobs SET attempts = 2, lease_expires_at = NOW() - interval '1 second'");
  assert.equal(await claimVendorJob(), null);
  assert.equal((await queryOne("SELECT status FROM vendor_jobs"))?.status, "dead");
  assert.equal((await queryOne("SELECT outcome FROM vendor_runs"))?.outcome, "crawl_failed");
});

test("refreshes run when due and preserve enqueue requests made during a crawl", async () => {
  await company(1);
  await enqueueVendorJobs(1);
  const job = await claimVendorJob(); assert(job);
  await withTransaction(async (client) => {
    await lockVendorJob(job, client);
    await completeVendorJob(job, "no_public_disclosure", 0, {}, client);
  });
  assert.equal(await enqueueVendorJobs(1), 0);
  await execute("UPDATE vendor_jobs SET refresh_at = NOW() - interval '1 second'");
  assert.equal(await enqueueVendorJobs(1), 1);
  const next = await claimVendorJob(); assert(next);
  await execute("UPDATE companies SET needs_vendor_enrichment = 1 WHERE id = 1");
  await withTransaction(async (client) => {
    await lockVendorJob(next, client);
    await completeVendorJob(next, "found_vendors", 3, {}, client);
  });
  assert.equal(await enqueueVendorJobs(1), 1);
});

test("pipeline discovers the homepage disclosure link, validates relationships, and retains versions", async () => {
  await company(1);
  const first = await enrichCompanyVendors({ limit: 1 });
  assert.equal(first.foundVendorsCount, 1);
  assert(first.relationshipsUpserted >= 3);
  assert(validationCalls >= 3, "seed vendors must undergo relationship validation");
  const versionsBefore = (await query("SELECT * FROM vendor_document_versions")).length;
  assert.equal(versionsBefore, 1);
  assert((await query("SELECT * FROM vendor_relationship_observations")).length >= 3);
  const callsBefore = validationCalls;
  await execute("UPDATE companies SET needs_vendor_enrichment = 1 WHERE id = 1");
  await enrichCompanyVendors({ limit: 1 });
  assert.equal(validationCalls, callsBefore, "unchanged evidence should hit the cache");
  assert.equal((await query("SELECT * FROM vendor_document_versions")).length, versionsBefore);
  await writeFile(markdownPath, `# Subprocessors\nPurpose: cloud hosting\n| Name | Service | Location |\n| --- | --- | --- |\n| Amazon Web Services | Hosting | US |\n${"Updated disclosure listing our cloud processing service provider. ".repeat(25)}`);
  await execute("UPDATE companies SET needs_vendor_enrichment = 1 WHERE id = 1");
  await enrichCompanyVendors({ limit: 1 });
  assert.equal((await query("SELECT * FROM vendor_document_versions")).length, versionsBefore + 1);
  assert.equal((await query("SELECT * FROM vendor_runs WHERE outcome = 'found_vendors'")).length, 3);
});

test("a real vendor mention without relationship evidence is rejected", async () => {
  validationMode = "reject";
  await company(1);
  const result = await enrichCompanyVendors({ limit: 1 });
  assert.equal(result.noPublicDisclosureCount, 1);
  assert.equal((await query("SELECT * FROM company_vendors")).length, 0);
  assert((await query("SELECT * FROM vendor_candidate_rejections")).length >= 3);
});

test("validator outages retry instead of being recorded as no disclosure", async () => {
  validationMode = "invalid";
  await company(1);
  const result = await enrichCompanyVendors({ limit: 1 });
  assert.equal(result.failureCount, 1);
  assert.equal(result.successCount, 0);
  assert.equal((await queryOne("SELECT status FROM vendor_jobs"))?.status, "pending");
  assert.equal((await query("SELECT * FROM company_vendors")).length, 0);
});

test("company deadlines cancel slow work without publishing relationships", async () => {
  await company(1);
  process.env.VENDOR_COMPANY_TIMEOUT_MS = "150";
  modelDelayMs = 1000;
  const result = await enrichCompanyVendors({ limit: 1 });
  assert.equal(result.failureCount, 1);
  assert.equal((await query("SELECT * FROM company_vendors")).length, 0);
  const job = await queryOne<{ status: string; last_error: string }>("SELECT status, last_error FROM vendor_jobs");
  assert.equal(job?.status, "pending");
  assert.match(job?.last_error ?? "", /crawl exceeded 150ms/);
});

test("a blocked disclosure retries and retains the previous evidence", async () => {
  await company(1);
  await enrichCompanyVendors({ limit: 1 });
  documentStatus = 403;
  process.env.VENDOR_FIXTURE_CRAWLER_FAIL = "1";
  closeScrapeBrowsers(); // The fixture process must inherit its changed failure mode.
  await execute("UPDATE companies SET needs_vendor_enrichment = 1 WHERE id = 1");
  const result = await enrichCompanyVendors({ limit: 1 });
  assert.equal(result.failureCount, 1);
  assert((await query("SELECT * FROM company_vendors")).length >= 3);
  assert((await queryOne("SELECT subprocessors_url FROM vendor_trust_profiles"))?.subprocessors_url);
});

test("a readable browser disclosure can recover an HTTP 403 preflight", async () => {
  documentStatus = 403;
  await company(1);
  const result = await enrichCompanyVendors({ limit: 1 });
  assert.equal(result.foundVendorsCount, 1);
  assert(result.relationshipsUpserted >= 3);
  const run = await queryOne<{ metrics: Record<string, number> }>("SELECT metrics FROM vendor_runs");
  assert.equal(run?.metrics.browser_fallback_calls, 1);
});

test("an absent disclosure is a coverage outcome rather than a crawl failure", async () => {
  documentStatus = 404;
  await company(1);
  const result = await enrichCompanyVendors({ limit: 1 });
  assert.equal(result.noPublicDisclosureCount, 1);
  assert.equal(result.failureCount, 0);
  assert.equal((await queryOne("SELECT status FROM vendor_jobs"))?.status, "succeeded");
  assert.equal(validationCalls, 0);
});

test("fixed pilot cohort excludes other companies and reports against its full denominator", async () => {
  for (let id = 1; id <= 8; id++) await company(id, null);
  // Pilots sample websites; use no-website only after capturing the cohort.
  await execute("UPDATE companies SET website = @website", { website: origin });
  assert.equal(await createVendorPilot("sample", 3), 3);
  const ids = await query<{ company_id: number }>("SELECT company_id FROM vendor_pilot_companies ORDER BY company_id");
  assert.equal(await createVendorPilot("sample", 5), 3);
  assert.deepEqual(await query("SELECT company_id FROM vendor_pilot_companies ORDER BY company_id"), ids);
  await execute("UPDATE companies SET website = NULL");
  const result = await enrichCompanyVendors({ limit: 100, pilotId: "sample" });
  assert.equal(result.requested, 3);
  assert.equal(result.noWebsiteCount, 3);
  const report = await getVendorPilotReport("sample");
  assert.equal(report.cohortSize, 3);
  assert.equal(report.coverage.noWebsite, 3);
  assert.equal(report.coverage.companiesWithVendorsShare, 0);
  assert.equal((await query("SELECT * FROM vendor_runs")).length, 3);
});


test("Retry-After survives job failure and delays the durable retry", async () => {
  await company(1);
  await enqueueVendorJobs(1);
  const job = await claimVendorJob(); assert(job);
  await failVendorJob(job, "Publisher rate limited", { retry_after_seconds: 120 });
  const row = await queryOne<{ delay: number }>("SELECT EXTRACT(EPOCH FROM available_at-NOW())::int AS delay FROM vendor_jobs");
  assert.ok(row && row.delay >= 119 && row.delay <= 120);
});
