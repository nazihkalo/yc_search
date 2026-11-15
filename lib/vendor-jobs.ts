import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";

import { execute, query, queryOne, withTransaction } from "./db";

export type VendorJob = {
  company_id: number;
  name: string;
  website: string | null;
  attempts: number;
  lease_token: string;
};

export type VendorOutcome = "found_vendors" | "no_public_disclosure" | "no_website";

export function vendorJobSettings() {
  const positive = (key: string, fallback: number) => {
    const value = Number(process.env[key]);
    return Number.isSafeInteger(value) && value > 0 ? value : fallback;
  };
  return {
    maxAttempts: positive("VENDOR_MAX_ATTEMPTS", 4),
    leaseSeconds: positive("VENDOR_LEASE_SECONDS", 300),
    refreshDays: positive("VENDOR_REFRESH_DAYS", 30),
    retrySeconds: positive("VENDOR_RETRY_SECONDS", 60),
    companyTimeoutMs: positive("VENDOR_COMPANY_TIMEOUT_MS", 180_000),
  };
}

// The old enrichment flag becomes an enqueue request. Consuming it here means a
// company update during a crawl remains queued for the next pass.
export async function enqueueVendorJobs(limit: number, pilotId: string | null = null) {
  return withTransaction(async (client) => {
    const rows = await query<{ id: number }>(`
      SELECT c.id FROM companies c
      LEFT JOIN vendor_jobs j ON j.company_id = c.id
      WHERE (j.company_id IS NULL OR j.status IN ('succeeded', 'dead'))
        AND (j.company_id IS NULL OR c.needs_vendor_enrichment = 1
          OR (j.status = 'succeeded' AND j.refresh_at <= NOW())
          OR (@pilot_id::text IS NOT NULL AND NOT EXISTS (
            SELECT 1 FROM vendor_runs r JOIN vendor_pilot_companies p ON p.company_id = r.company_id
            WHERE p.pilot_id = @pilot_id AND r.company_id = c.id AND r.started_at >= p.baseline_at
          )))
        AND (@pilot_id::text IS NULL OR EXISTS (
          SELECT 1 FROM vendor_pilot_companies p WHERE p.company_id = c.id AND p.pilot_id = @pilot_id
        ))
      ORDER BY c.source_kind, c.source_rank NULLS LAST, c.id
      LIMIT @limit FOR UPDATE OF c SKIP LOCKED
    `, { limit, pilot_id: pilotId }, client);
    for (const row of rows) {
      await execute(`
        INSERT INTO vendor_jobs (company_id) VALUES (@id)
        ON CONFLICT (company_id) DO UPDATE SET status = 'pending', attempts = 0,
          available_at = NOW(), refresh_at = NULL, lease_token = NULL,
          lease_expires_at = NULL, last_error = NULL, updated_at = NOW()
      `, { id: row.id }, client);
      await execute("UPDATE companies SET needs_vendor_enrichment = 0 WHERE id = @id", { id: row.id }, client);
    }
    return rows.length;
  });
}

export async function claimVendorJob(pilotId: string | null = null): Promise<VendorJob | null> {
  const settings = vendorJobSettings();
  return withTransaction(async (client) => {
    // A crashed final attempt must become terminal rather than remaining running.
    const exhausted = await query<{ lease_token: string }>(`
      UPDATE vendor_jobs SET status = 'dead', last_outcome = 'crawl_failed',
        last_error = 'Worker lease expired after final attempt', updated_at = NOW()
      WHERE status = 'running' AND lease_expires_at <= NOW() AND attempts >= @max
      RETURNING lease_token
    `, { max: settings.maxAttempts }, client);
    for (const job of exhausted) {
      await execute(`UPDATE vendor_runs SET outcome = 'crawl_failed', finished_at = NOW(),
        error = 'Worker lease expired after final attempt' WHERE id = @token AND outcome = 'running'`,
      { token: job.lease_token }, client);
    }
    const job = await queryOne<VendorJob>(`
      SELECT j.company_id, c.name, c.website, j.attempts, j.lease_token
      FROM vendor_jobs j JOIN companies c ON c.id = j.company_id
      WHERE ((j.status = 'pending' AND j.available_at <= NOW())
        OR (j.status = 'running' AND j.lease_expires_at <= NOW())) AND j.attempts < @max
        AND (@pilot_id::text IS NULL OR EXISTS (
          SELECT 1 FROM vendor_pilot_companies p WHERE p.company_id = c.id AND p.pilot_id = @pilot_id
        ))
      ORDER BY j.available_at, j.company_id
      LIMIT 1 FOR UPDATE OF j SKIP LOCKED
    `, { max: settings.maxAttempts, pilot_id: pilotId }, client);
    if (!job) return null;
    if (job.lease_token) {
      await execute(`UPDATE vendor_runs SET outcome = 'lease_expired', finished_at = NOW(),
        error = 'Worker lease expired' WHERE id = @token AND outcome = 'running'`,
      { token: job.lease_token }, client);
    }
    job.lease_token = randomUUID();
    job.attempts += 1;
    await execute(`UPDATE vendor_jobs SET status = 'running', attempts = @attempts,
      lease_token = @token, lease_expires_at = NOW() + make_interval(secs => @lease), updated_at = NOW()
      WHERE company_id = @id`, {
      id: job.company_id, attempts: job.attempts, token: job.lease_token, lease: settings.leaseSeconds,
    }, client);
    await execute(`INSERT INTO vendor_runs (id, company_id, attempt) VALUES (@token, @id, @attempt)`,
      { token: job.lease_token, id: job.company_id, attempt: job.attempts }, client);
    return job;
  });
}

export async function renewVendorLease(job: VendorJob) {
  return (await execute(`UPDATE vendor_jobs
    SET lease_expires_at = NOW() + make_interval(secs => @lease), updated_at = NOW()
    WHERE company_id = @id AND lease_token = @token AND status = 'running' AND lease_expires_at > NOW()`, {
    id: job.company_id, token: job.lease_token, lease: vendorJobSettings().leaseSeconds,
  })) === 1;
}

// Lock and fence the final transaction. An expired worker cannot publish data
// after another worker has reclaimed the company.
export async function lockVendorJob(job: VendorJob, client: PoolClient) {
  const owned = await queryOne(`SELECT company_id FROM vendor_jobs
    WHERE company_id = @id AND lease_token = @token AND status = 'running'
      AND lease_expires_at > NOW() FOR UPDATE`, { id: job.company_id, token: job.lease_token }, client);
  if (!owned) throw new Error("Vendor job lease lost");
}

export async function completeVendorJob(
  job: VendorJob, outcome: VendorOutcome, relationships: number, metrics: Record<string, number>, client: PoolClient,
) {
  await execute(`UPDATE vendor_runs SET outcome = @outcome, finished_at = NOW(),
    duration_ms = (EXTRACT(EPOCH FROM (NOW() - started_at)) * 1000)::int,
    relationships = @relationships, metrics = @metrics::jsonb WHERE id = @token`, {
    token: job.lease_token, outcome, relationships, metrics: JSON.stringify(metrics),
  }, client);
  await execute(`UPDATE vendor_jobs SET status = 'succeeded', last_outcome = @outcome,
    last_error = NULL, lease_token = NULL, lease_expires_at = NULL,
    refresh_at = NOW() + make_interval(days => @days), updated_at = NOW()
    WHERE company_id = @id AND lease_token = @token`, {
    id: job.company_id, token: job.lease_token, outcome, days: vendorJobSettings().refreshDays,
  }, client);
}

export async function failVendorJob(job: VendorJob, error: string, metrics: Record<string, number>) {
  const settings = vendorJobSettings();
  const delay = Math.max(Math.min(86_400, settings.retrySeconds * 2 ** (job.attempts - 1)), Math.min(86_400, Math.max(0, metrics.retry_after_seconds ?? 0)));
  return withTransaction(async (client) => {
    const updated = await execute(`UPDATE vendor_jobs SET
      status = CASE WHEN attempts >= @max THEN 'dead' ELSE 'pending' END,
      available_at = NOW() + make_interval(secs => @delay),
      last_outcome = 'crawl_failed', last_error = @error,
      lease_token = NULL, lease_expires_at = NULL, updated_at = NOW()
      WHERE company_id = @id AND lease_token = @token AND status = 'running'`, {
      id: job.company_id, token: job.lease_token, max: settings.maxAttempts, delay, error: error.slice(0, 2000),
    }, client);
    if (updated) await execute(`UPDATE vendor_runs SET outcome = 'crawl_failed', finished_at = NOW(),
      duration_ms = (EXTRACT(EPOCH FROM (NOW() - started_at)) * 1000)::int,
      error = @error, metrics = @metrics::jsonb WHERE id = @token`, {
      token: job.lease_token, error: error.slice(0, 2000), metrics: JSON.stringify(metrics),
    }, client);
    return updated === 1;
  });
}

export async function getVendorQueueStatus() {
  return queryOne(`SELECT
    COUNT(*) FILTER (WHERE status = 'pending')::int AS pending,
    COUNT(*) FILTER (WHERE status = 'pending' AND available_at <= NOW())::int AS ready,
    COUNT(*) FILTER (WHERE status = 'running')::int AS running,
    COUNT(*) FILTER (WHERE status = 'running' AND lease_expires_at <= NOW())::int AS expired,
    COUNT(*) FILTER (WHERE status = 'succeeded')::int AS succeeded,
    COUNT(*) FILTER (WHERE status = 'dead')::int AS dead
    FROM vendor_jobs`);
}
