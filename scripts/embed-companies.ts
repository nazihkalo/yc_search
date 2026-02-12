import pLimit from "p-limit";

import { getDb, initializeDatabase } from "../lib/db";
import { sha256 } from "../lib/hash";
import { EMBEDDING_MODEL, getOpenAiClient } from "../lib/openai";

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

async function main() {
  initializeDatabase();
  const db = getDb();
  const openai = getOpenAiClient();

  const batchLimit = parseLimitArg();
  const candidates = db
    .prepare<[{ limit: number }], EmbedCandidate>(`
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
      LEFT JOIN website_snapshots s ON s.company_id = c.id
      WHERE c.needs_embed = 1
      ORDER BY c.id ASC
      LIMIT @limit
    `)
    .all({ limit: batchLimit });

  if (candidates.length === 0) {
    console.log("No companies need embeddings.");
    return;
  }

  const limit = pLimit(10);
  const upsertEmbedding = db.prepare(`
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
      CURRENT_TIMESTAMP,
      CURRENT_TIMESTAMP
    )
    ON CONFLICT(company_id) DO UPDATE SET
      model = excluded.model,
      dimensions = excluded.dimensions,
      vector = excluded.vector,
      source_hash = excluded.source_hash,
      embedded_at = CURRENT_TIMESTAMP,
      updated_at = CURRENT_TIMESTAMP
  `);

  const markEmbedded = db.prepare(`
    UPDATE companies
    SET needs_embed = 0, updated_at = CURRENT_TIMESTAMP
    WHERE id = @id
  `);

  let embeddedCount = 0;
  let skippedCount = 0;

  await Promise.all(
    candidates.map((candidate: EmbedCandidate) =>
      limit(async () => {
        const embeddingText = buildEmbeddingText(candidate);
        const sourceHash = sha256(embeddingText);
        const existing = db
          .prepare<[{ id: number }], { source_hash: string }>(
            "SELECT source_hash FROM company_embeddings WHERE company_id = @id",
          )
          .get({ id: candidate.id });

        if (existing && existing.source_hash === sourceHash) {
          markEmbedded.run({ id: candidate.id });
          skippedCount += 1;
          return;
        }

        const response = await openai.embeddings.create({
          model: EMBEDDING_MODEL,
          input: embeddingText,
        });
        const vector = response.data[0]?.embedding ?? [];

        upsertEmbedding.run({
          company_id: candidate.id,
          model: EMBEDDING_MODEL,
          dimensions: vector.length,
          vector: JSON.stringify(vector),
          source_hash: sourceHash,
        });
        markEmbedded.run({ id: candidate.id });
        embeddedCount += 1;
      }),
    ),
  );

  db.prepare(`
    INSERT INTO sync_state (key, value, updated_at)
    VALUES ('embed_last_sync_at', @value, CURRENT_TIMESTAMP)
    ON CONFLICT(key) DO UPDATE SET
      value = excluded.value,
      updated_at = CURRENT_TIMESTAMP
  `).run({ value: new Date().toISOString() });

  console.log(
    JSON.stringify(
      {
        requested: candidates.length,
        embeddedCount,
        skippedCount,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
