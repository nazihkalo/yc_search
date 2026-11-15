import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { closeDb, execute, initializeDatabase } from "../lib/db";
import { parseSearchParams } from "../lib/request-parsing";
import { getVendorAnalytics } from "../lib/vendor-analytics";

const testUrl = process.env.VENDOR_TEST_DATABASE_URL;
const schema = `vendor_rankings_${randomUUID().replaceAll("-", "")}`;
let admin: Pool | undefined;
const params = (search = "") => parseSearchParams(new URLSearchParams(search));

before(async () => {
  if (!testUrl || !["localhost", "127.0.0.1", "[::1]"].includes(new URL(testUrl).hostname)) {
    throw new Error("Set VENDOR_TEST_DATABASE_URL to disposable local Postgres");
  }
  admin = new Pool({ connectionString: testUrl });
  await admin.query(`CREATE SCHEMA ${schema}`);
  const scoped = new URL(testUrl);
  scoped.searchParams.set("options", `-csearch_path=${schema}`);
  process.env.DATABASE_URL = scoped.href;
  await initializeDatabase();
  await execute(`INSERT INTO companies (id, name, source_kind) VALUES
    (1, 'One', 'yc'), (2, 'Two', 'yc'), (3, 'Three', 'yc'), (4, 'Uncovered', 'yc')`);
  await execute(`INSERT INTO vendors (id, canonical_name, normalized_name, category) VALUES
    (1, 'Cloud', 'cloud', 'infrastructure'), (2, 'Pay', 'pay', 'payments')`);
  // Cloud's second evidence URL and relationship type are new, but the pair is old.
  await execute(`INSERT INTO company_vendors
    (company_id, vendor_id, raw_vendor_name, relationship_type, source_type, evidence_url, created_at) VALUES
    (1, 1, 'Cloud', 'subprocessor', 'trust', 'https://one.test/old', NOW() - INTERVAL '60 days'),
    (1, 1, 'Cloud', 'technology', 'website', 'https://one.test/new', NOW()),
    (2, 1, 'Cloud', 'subprocessor', 'trust', 'https://two.test/old', NOW() - INTERVAL '31 days'),
    (3, 1, 'Cloud', 'subprocessor', 'trust', 'https://three.test/old', NOW() - INTERVAL '31 days'),
    (1, 2, 'Pay', 'subprocessor', 'trust', 'https://one.test/pay', NOW() - INTERVAL '2 days'),
    (1, 2, 'Pay', 'subprocessor', 'trust', 'https://one.test/pay-copy', NOW()),
    (2, 2, 'Pay', 'subprocessor', 'trust', 'https://two.test/pay', NOW() - INTERVAL '29 days')`);
  await execute(`INSERT INTO company_list_sources (url, publisher, kind, title)
    VALUES ('https://list.test/top', 'linkedin', 'list', 'Top startups')`);
  await execute(`INSERT INTO company_list_documents (id, source_url, content_hash, content, extractor_version, extracted)
    VALUES (1, 'https://list.test/top', 'hash', 'fixture', 'v1', '{}')`);
  await execute(`INSERT INTO company_list_memberships
    (source_url, member_key, company_id, company_name, evidence, document_id, resolution) VALUES
    ('https://list.test/top', 'one', 1, 'One', 'One', 1, 'existing'),
    ('https://list.test/top', 'four', 4, 'Uncovered', 'Uncovered', 1, 'existing')`);
});

after(async () => {
  await closeDb();
  if (admin) { await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`); await admin.end(); }
});

test("top vendors rank by distinct companies, with an explicit coverage denominator", async () => {
  const result = await getVendorAnalytics(params(), { topN: 1 });
  assert.deepEqual(result.coverage, { matchedCompanies: 4, companiesWithVendors: 3 });
  assert.equal(result.totalVendors, 2);
  assert.equal(result.topVendors.length, 1);
  assert.equal(result.topVendors[0].id, 1);
  assert.equal(result.topVendors[0].companyCount, 3);
  assert.equal(result.topVendors[0].relationshipCount, 4);
});

test("recent ranking is applied before topN and deduplicates evidence pages", async () => {
  const result = await getVendorAnalytics(params(), { ranking: "recent", topN: 1 });
  assert.equal(result.recentWindowDays, 30);
  assert.equal(result.totalVendors, 1);
  assert.equal(result.topVendors[0].id, 2);
  assert.equal(result.topVendors[0].recentCompanyCount, 2);
  assert.equal(result.topVendors[0].companyCount, 2);
});

test("new pages and relationship types do not reset an old pair's first observation", async () => {
  const result = await getVendorAnalytics(params(), { ranking: "recent", relationshipTypes: ["technology"] });
  assert.deepEqual(result.topVendors, []);
  assert.equal(result.totalVendors, 0);
  assert.deepEqual(result.coverage, { matchedCompanies: 4, companiesWithVendors: 3 });
});

test("category filtering preserves other category choices and cohort coverage", async () => {
  const result = await getVendorAnalytics(params(), { category: "infrastructure" });
  assert.deepEqual(result.topVendors.map((vendor) => vendor.id), [1]);
  assert.equal(result.totalRelationships, 4);
  assert.equal(result.categories.length, 2);
  assert.equal(result.coverage.companiesWithVendors, 3);
  const empty = await getVendorAnalytics(params(), { category: "missing" });
  assert.equal(empty.totalRelationships, 0);
  assert.equal(empty.categories.length, 2);
});

test("publisher and named list cohorts include memberships without replacing YC provenance", async () => {
  for (const result of [
    await getVendorAnalytics(params("sources=linkedin_lists")),
    await getVendorAnalytics(params(), { sourceListName: "Top startups" }),
  ]) {
    assert.deepEqual(result.coverage, { matchedCompanies: 2, companiesWithVendors: 1 });
    assert.equal(result.totalCompanies, 1);
    assert.equal(result.topVendors.length, 2);
    assert.ok(result.topVendors.every((vendor) => vendor.companyCount === 1));
  }
  const empty = await getVendorAnalytics(params("sources=nonexistent"));
  assert.deepEqual(empty.coverage, { matchedCompanies: 0, companiesWithVendors: 0 });
  assert.deepEqual(empty.topVendors, []);
});
