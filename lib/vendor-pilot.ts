import { execute, query, queryOne, withTransaction } from "./db";

export async function requireVendorPilot(pilotId: string) {
  const row = await queryOne<{ count: number }>(
    "SELECT COUNT(*)::int AS count FROM vendor_pilot_companies WHERE pilot_id = @id", { id: pilotId });
  if (!row?.count) throw new Error(`Unknown or empty vendor pilot: ${pilotId}`);
  return row.count;
}

export async function createVendorPilot(pilotId: string, limit = 100) {
  if (!/^[a-zA-Z0-9_-]{1,80}$/.test(pilotId)) throw new Error("Pilot name must contain 1–80 letters, digits, underscores or hyphens");
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 1000) throw new Error("Pilot size must be between 1 and 1000");
  await withTransaction(async (client) => {
    await execute("SELECT pg_advisory_xact_lock(hashtext(@key))", { key: `vendor-pilot:${pilotId}` }, client);
    await execute(`INSERT INTO vendor_pilot_companies (pilot_id, company_id)
      SELECT @id, id FROM (
        SELECT id, ROW_NUMBER() OVER (
          PARTITION BY source_kind, COALESCE(industry, 'unknown'),
            CASE WHEN team_size IS NULL THEN 'unknown' WHEN team_size < 20 THEN 'small'
              WHEN team_size < 100 THEN 'medium' ELSE 'large' END
          ORDER BY md5(id::text || @id)
        ) AS sample_rank FROM companies
        WHERE NULLIF(TRIM(website), '') IS NOT NULL
      ) sample
      WHERE NOT EXISTS (SELECT 1 FROM vendor_pilot_companies WHERE pilot_id = @id)
      ORDER BY sample_rank, md5(id::text || @id) LIMIT @limit
      ON CONFLICT DO NOTHING`, { id: pilotId, limit }, client);
  });
  return requireVendorPilot(pilotId);
}

export async function getVendorPilotReport(pilotId: string) {
  const cohortSize = await requireVendorPilot(pilotId);
  const [companies, totals, evidence, configurations] = await Promise.all([
    query(`SELECT c.id, c.name, c.website, c.industry, c.team_size, c.source_kind,
      j.status AS job_status, j.last_error, r.outcome, r.duration_ms, r.relationships, r.finished_at
      FROM vendor_pilot_companies p JOIN companies c ON c.id = p.company_id
      LEFT JOIN vendor_jobs j ON j.company_id = c.id
      LEFT JOIN LATERAL (SELECT * FROM vendor_runs r WHERE r.company_id = c.id
        AND r.started_at >= p.baseline_at ORDER BY r.started_at DESC LIMIT 1) r ON true
      WHERE p.pilot_id = @id ORDER BY c.id`, { id: pilotId }),
    queryOne(`SELECT COUNT(*)::int AS attempts,
      COUNT(DISTINCT r.company_id)::int AS attempted_companies,
      COUNT(*) FILTER (WHERE r.outcome IN ('crawl_failed', 'lease_expired'))::int AS failed_attempts,
      COALESCE(SUM(duration_ms), 0)::bigint AS total_attempt_ms,
      percentile_cont(0.5) WITHIN GROUP (ORDER BY duration_ms) AS median_attempt_ms,
      percentile_cont(0.95) WITHIN GROUP (ORDER BY duration_ms) AS p95_attempt_ms,
      COALESCE(SUM((metrics->>'input_tokens')::bigint), 0)::bigint AS input_tokens,
      COALESCE(SUM((metrics->>'output_tokens')::bigint), 0)::bigint AS output_tokens,
      COALESCE(SUM((metrics->>'validation_calls')::int), 0)::int AS validation_calls,
      COALESCE(SUM((metrics->>'validation_cache_hits')::int), 0)::int AS validation_cache_hits,
      COALESCE(SUM((metrics->>'http_requests')::int), 0)::int AS http_requests,
      COALESCE(SUM((metrics->>'crawl4ai_calls')::int), 0)::int AS crawl4ai_calls,
      COALESCE(SUM((metrics->>'browser_fallback_calls')::int), 0)::int AS browser_fallback_calls,
      COALESCE(SUM((metrics->>'search_calls')::int), 0)::int AS search_calls,
      COALESCE(SUM((metrics->>'unvalidated_mentions')::int), 0)::int AS unvalidated_mentions
      FROM vendor_runs r JOIN vendor_pilot_companies p ON p.company_id = r.company_id
      WHERE p.pilot_id = @id AND r.started_at >= p.baseline_at`, { id: pilotId }),
    query(`SELECT c.id AS company_id, c.name AS company_name, v.canonical_name AS vendor,
      o.relationship_type, o.evidence_url, o.evidence_snippet, o.confidence, o.observed_at,
      o.run_id, NULL::boolean AS manually_verified
      FROM vendor_relationship_observations o JOIN vendor_runs r ON r.id = o.run_id
      JOIN vendor_pilot_companies p ON p.company_id = r.company_id
      JOIN companies c ON c.id = r.company_id JOIN vendors v ON v.id = o.vendor_id
      WHERE p.pilot_id = @id AND r.started_at >= p.baseline_at
      ORDER BY c.id, v.canonical_name, o.observed_at`, { id: pilotId }),
    query(`SELECT metrics->>'pipeline_version' AS pipeline_version,
      metrics->>'discovery_url_limit' AS discovery_url_limit,
      metrics->>'browser_fallback_limit' AS browser_fallback_limit,
      metrics->>'company_timeout_ms' AS company_timeout_ms, COUNT(*)::int AS attempts
      FROM vendor_runs r JOIN vendor_pilot_companies p ON p.company_id = r.company_id
      WHERE p.pilot_id = @id AND r.started_at >= p.baseline_at
      GROUP BY 1, 2, 3, 4`, { id: pilotId }),
  ]);
  const count = (outcome: string) => companies.filter((company) => company.outcome === outcome).length;
  const found = count("found_vendors");
  return {
    pilotId, generatedAt: new Date().toISOString(), cohortSize,
    coverage: {
      foundVendors: found, noPublicDisclosure: count("no_public_disclosure"),
      noWebsite: count("no_website"), crawlFailed: count("crawl_failed") + count("lease_expired"),
      running: count("running"), notAttempted: companies.filter((company) => !company.outcome).length,
      companiesWithVendorsShare: found / cohortSize,
    },
    totals, configurations, companies, evidence,
    interpretation: "Coverage describes public disclosures in this fixed cohort. No public disclosure means no validated relationship was found within the crawl budget. Missing mentions do not establish vendor removal. Accuracy requires manual evidence review; token counts exclude provider retries and are not a billing total.",
  };
}
