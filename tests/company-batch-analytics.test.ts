import assert from "node:assert/strict";
import { before, after, test } from "node:test";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { closeDb, getDb, initializeDatabase } from "../lib/db";
import { getBatchAnalytics, getFacets, type SearchParams } from "../lib/search";
import { upsertUser } from "../lib/user-sync";
import { getOverview } from "../lib/overview";
const schema = `analytics_test_${randomUUID().replaceAll("-", "")}`;
let admin: Pool;
const params: SearchParams = {
  query: "",
  page: 1,
  pageSize: 20,
  sort: "name",
  filters: {
    tags: [],
    industries: [],
    batches: [],
    years: [],
    stages: [],
    regions: [],
    sources: [],
  },
};
before(async () => {
  const url = process.env.ANALYTICS_TEST_DATABASE_URL;
  if (
    !url ||
    !["127.0.0.1", "localhost", "[::1]"].includes(new URL(url).hostname)
  )
    throw new Error(
      "Set ANALYTICS_TEST_DATABASE_URL to disposable local Postgres",
    );
  admin = new Pool({ connectionString: url });
  await admin.query(`CREATE SCHEMA ${schema}`);
  const scoped = new URL(url);
  scoped.searchParams.set("options", `-csearch_path=${schema}`);
  process.env.DATABASE_URL = scoped.href;
  await initializeDatabase();
  await getDb()
    .query(`INSERT INTO companies(id,name,batch,tags,industries,source_kind) VALUES
    (1,'YC One','W24','["AI"]','["Software"]','yc'),
    (2,'Discovered YC','Summer 2025','["AI"]','["Software"]','linkedin_lists'),
    (3,'Discovered','Unspecified','["Dominant"]','["Other"]','linkedin_lists'),
    (4,'No batch',NULL,'["Dominant"]','["Other"]','yc'),
    (5,'Unknown batch','Unknown','["Dominant"]','["Other"]','yc')`);
});
after(async () => {
  await closeDb();
  if (admin) {
    await admin.query(`DROP SCHEMA ${schema} CASCADE`);
    await admin.end();
  }
});
test("batch charts exclude unknown batches before ranking colored series", async () => {
  const result = await getBatchAnalytics(params, "tags", 1);
  assert.equal(result.totalCompanies, 2);
  assert.equal(result.matchedCompanies, 5);
  assert.equal(result.excludedCompanies, 3);
  assert.deepEqual(
    result.rows.map((r) => r.batch),
    ["W24", "Summer 2025"],
  );
  assert.deepEqual(result.series, ["AI", "Other"]);
  assert.equal(
    result.rows.reduce((n, r) => n + Number(r.total), 0),
    2,
  );
});
test("hybrid empty subset stays empty and source/tag filters still apply", async () => {
  assert.equal(
    (await getBatchAnalytics(params, "none", 8, [])).matchedCompanies,
    0,
  );
  const source = await getBatchAnalytics(
    { ...params, filters: { ...params.filters, sources: ["linkedin_lists"] } },
    "none",
  );
  assert.equal(source.matchedCompanies, 2);
  assert.equal(source.totalCompanies, 1);
  assert.equal(source.excludedCompanies, 1);
  const filtered = await getBatchAnalytics(
    { ...params, filters: { ...params.filters, tags: ["Dominant"] } },
    "none",
  );
  assert.equal(filtered.matchedCompanies, 3);
  assert.equal(filtered.rows.length, 0);
});
test("overview and batch picker use recognized batches while preserving overall company counts", async () => {
  const overview = await getOverview();
  assert.equal(overview.companies, 5);
  assert.equal(overview.batchCount, 2);
  assert.equal(overview.companiesWithoutBatch, 3);
  assert.deepEqual(overview.years, [
    { year: 2024, count: 1 },
    { year: 2025, count: 1 },
  ]);
  assert.equal((await getFacets()).batches.length, 2);
});
test("user synchronization is idempotent and preserves canonical signup dates and plan", async () => {
  const user = {
    id: "clerk_test",
    email: "test@example.com",
    name: "Test",
    imageUrl: null,
    createdAt: new Date("2026-10-01T12:00:00Z"),
  };
  await upsertUser(user);
  await getDb().query("UPDATE users SET plan='pro' WHERE id='clerk_test'");
  await Promise.all([
    upsertUser({ ...user, name: "Updated" }),
    upsertUser({ ...user, name: "Updated" }),
  ]);
  const rows = (
    await getDb().query("SELECT * FROM users WHERE id='clerk_test'")
  ).rows;
  assert.equal(rows.length, 1);
  assert.equal(rows[0].plan, "pro");
  assert.equal(rows[0].name, "Updated");
  assert.equal(rows[0].created_at.toISOString(), user.createdAt.toISOString());
});
