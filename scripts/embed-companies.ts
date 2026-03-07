import { pathToFileURL } from "node:url";

import pLimit from "p-limit";

import { closeDb, execute, initializeDatabase, query, queryOne } from "../lib/db";
import { sha256 } from "../lib/hash";
import { EMBEDDING_MODEL, getOpenAiClient } from "../lib/openai";
import { ACTIVE_SNAPSHOT_SOURCE } from "../lib/snapshot-source";

type EmbedCandidate = {
  id: number;
  name: string;
  one_liner: string | null;
  long_description: string | null;
  search_text: string;
  tags: string;
  industries: string;
  regions: string;
  stage: string | null;
  batch: string | null;
  status: string | null;
  all_locations: string | null;
  content_markdown: string | null;
};

function parseLimitArg(defaultLimit = 500): number {
  const argument = process.argv.find((value) => value.startsWith("--limit="));
  if (!argument) {
    return defaultLimit;
  }
  const parsed = Number(argument.split("=")[1]);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : defaultLimit;
}

function parseJsonArray(value: string): string[] {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item) => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function buildEmbeddingText(candidate: EmbedCandidate): string {
  const tags = parseJsonArray(candidate.tags).join(", ");
  const industries = parseJsonArray(candidate.industries).join(", ");
  const regions = parseJsonArray(candidate.regions).join(", ");
  const websiteContent = (candidate.content_markdown ?? "").slice(0, 10_000);

  return [
    `Company: ${candidate.name}`,
    `One liner: ${candidate.one_liner ?? ""}`,
    `Description: ${candidate.long_description ?? ""}`,
    `Search text: ${candidate.search_text}`,
    `Tags: ${tags}`,
    `Industries: ${industries}`,
    `Regions: ${regions}`,
    `Batch: ${candidate.batch ?? ""}`,
    `Stage: ${candidate.stage ?? ""}`,
    `Status: ${candidate.status ?? ""}`,
    `Location: ${candidate.all_locations ?? ""}`,
    `Website content: ${websiteContent}`,
  ].join("\n");
}

export type EmbedSummary = {
  requested: number;
  embeddedCount: number;
  skippedCount: number;
};

export async function embedCompanies(options?: { limit?: number }): Promise<EmbedSummary> {
  await initializeDatabase();
  const openai = getOpenAiClient();
  const source = ACTIVE_SNAPSHOT_SOURCE;

  const batchLimit = options?.limit ?? parseLimitArg();
  const candidates = await query<EmbedCandidate>(`
      SELECT
        c.id,
        c.name,
        c.one_liner,
        c.long_description,
        c.search_text,
        c.tags,
        c.industries,
        c.regions,
        c.stage,
        c.batch,
        c.status,
        c.all_locations,
        s.content_markdown
      FROM companies c
      LEFT JOIN website_snapshots s ON s.company_id = c.id AND s.source = @source
      WHERE c.needs_embed = 1
      ORDER BY c.id ASC
      LIMIT @limit
    `, { limit: batchLimit, source });

  if (candidates.length === 0) {
    console.log("No companies need embeddings.");
    return {
      requested: 0,
      embeddedCount: 0,
      skippedCount: 0,
    };
  }

  const limit = pLimit(10);
  let embeddedCount = 0;
  let skippedCount = 0;

  await Promise.all(
    candidates.map((candidate: EmbedCandidate) =>
      limit(async () => {
        const embeddingText = buildEmbeddingText(candidate);
        const sourceHash = sha256(embeddingText);
        const existing = await queryOne<{ source_hash: string }>(
          "SELECT source_hash FROM company_embeddings WHERE company_id = @id",
          { id: candidate.id },
        );

        if (existing && existing.source_hash === sourceHash) {
          await execute(`
            UPDATE companies
            SET needs_embed = 0, updated_at = NOW()
            WHERE id = @id
          `, { id: candidate.id });
          skippedCount += 1;
          return;
        }

        const response = await openai.embeddings.create({
          model: EMBEDDING_MODEL,
          input: embeddingText,
        });
        const vector = response.data[0]?.embedding ?? [];

        await execute(`
          INSERT INTO company_embeddings (
            company_id,
            model,
            dimensions,
            vector,
            source_hash,
            embedded_at,
            updated_at
          ) VALUES (
            @company_id,
            @model,
            @dimensions,
            @vector,
            @source_hash,
            NOW(),
            NOW()
          )
          ON CONFLICT(company_id) DO UPDATE SET
            model = EXCLUDED.model,
            dimensions = EXCLUDED.dimensions,
            vector = EXCLUDED.vector,
            source_hash = EXCLUDED.source_hash,
            embedded_at = NOW(),
            updated_at = NOW()
        `, {
          company_id: candidate.id,
          model: EMBEDDING_MODEL,
          dimensions: vector.length,
          vector: JSON.stringify(vector),
          source_hash: sourceHash,
        });
        await execute(`
          UPDATE companies
          SET needs_embed = 0, updated_at = NOW()
          WHERE id = @id
        `, { id: candidate.id });
        embeddedCount += 1;
      }),
    ),
  );

  await execute(`
    INSERT INTO sync_state (key, value, updated_at)
    VALUES ('embed_last_sync_at', @value, NOW())
    ON CONFLICT(key) DO UPDATE SET
      value = EXCLUDED.value,
      updated_at = NOW()
  `, { value: new Date().toISOString() });

  return {
    requested: candidates.length,
    embeddedCount,
    skippedCount,
  };
}

async function main() {
  const summary = await embedCompanies();
  console.log(JSON.stringify(summary, null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main()
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    })
    .finally(async () => {
      await closeDb();
    });
}
