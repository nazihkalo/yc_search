import { pathToFileURL } from "node:url";

import pLimit from "p-limit";

import { closeDb, execute, initializeDatabase, query, queryOne } from "../lib/db";
import { sha256 } from "../lib/hash";
import { EMBEDDING_MODEL, getOpenAiClient } from "../lib/openai";
import { WEBSITE_SNAPSHOT_SOURCE, YC_PROFILE_SNAPSHOT_SOURCE } from "../lib/snapshot-source";
import { toVectorLiteral } from "../lib/vector-utils";

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
  website_content_markdown: string | null;
  yc_profile_content_markdown: string | null;
};

type FounderContextRow = {
  company_id: number;
  full_name: string;
  title: string | null;
  bio: string | null;
  background: unknown;
  github_username: string | null;
  github_bio: string | null;
  top_languages: unknown;
  mention_titles: string[] | null;
};

function formatFounderContext(rows: FounderContextRow[]): string {
  if (rows.length === 0) return "";
  const blocks = rows.map((row) => {
    const lines: string[] = [];
    lines.push(`Founder: ${row.full_name}${row.title ? ` — ${row.title}` : ""}`);
    if (row.bio) lines.push(`Bio: ${row.bio.slice(0, 800)}`);
    if (row.background && typeof row.background === "object") {
      const bg = row.background as Record<string, unknown>;
      if (typeof bg.summary === "string" && bg.summary) {
        lines.push(`Background: ${bg.summary.slice(0, 600)}`);
      }
      if (Array.isArray(bg.previous_companies)) {
        const prev = bg.previous_companies
          .map((entry) => {
            if (!entry || typeof entry !== "object") return null;
            const e = entry as Record<string, unknown>;
            const name = typeof e.name === "string" ? e.name : null;
            const role = typeof e.role === "string" ? e.role : null;
            return name ? (role ? `${name} (${role})` : name) : null;
          })
          .filter((value): value is string => Boolean(value));
        if (prev.length) lines.push(`Previous: ${prev.slice(0, 8).join(", ")}`);
      }
      if (Array.isArray(bg.education)) {
        const edu = bg.education
          .map((entry) => {
            if (!entry || typeof entry !== "object") return null;
            const e = entry as Record<string, unknown>;
            return typeof e.school === "string" ? e.school : null;
          })
          .filter((value): value is string => Boolean(value));
        if (edu.length) lines.push(`Education: ${edu.slice(0, 4).join(", ")}`);
      }
    }
    if (row.github_username) lines.push(`GitHub: @${row.github_username}`);
    if (row.github_bio) lines.push(`GitHub bio: ${row.github_bio.slice(0, 400)}`);
    const languages = Array.isArray(row.top_languages)
      ? (row.top_languages as Array<{ language?: string }>)
          .map((entry) => entry?.language)
          .filter((value): value is string => Boolean(value))
      : [];
    if (languages.length) lines.push(`Top languages: ${languages.join(", ")}`);
    if (row.mention_titles?.length) {
      lines.push(`Mentions: ${row.mention_titles.filter(Boolean).slice(0, 6).join(" | ")}`);
    }
    return lines.join("\n");
  });
  return blocks.join("\n\n");
}

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

function buildEmbeddingText(candidate: EmbedCandidate, founderContext: string): string {
  const tags = parseJsonArray(candidate.tags).join(", ");
  const industries = parseJsonArray(candidate.industries).join(", ");
  const regions = parseJsonArray(candidate.regions).join(", ");
  const websiteContent = (candidate.website_content_markdown ?? "").slice(0, 8_000);
  const ycProfileContent = (candidate.yc_profile_content_markdown ?? "").slice(0, 8_000);

  const joined = [
    `Company: ${candidate.name}`,
    `One liner: ${candidate.one_liner ?? ""}`,
    `Description: ${(candidate.long_description ?? "").slice(0, 4_000)}`,
    `Search text: ${candidate.search_text.slice(0, 2_000)}`,
    `Tags: ${tags}`,
    `Industries: ${industries}`,
    `Regions: ${regions}`,
    `Batch: ${candidate.batch ?? ""}`,
    `Stage: ${candidate.stage ?? ""}`,
    `Status: ${candidate.status ?? ""}`,
    `Location: ${candidate.all_locations ?? ""}`,
    `Website content: ${websiteContent}`,
    `YC profile content: ${ycProfileContent}`,
    `Founders:\n${founderContext.slice(0, 6_000)}`,
  ].join("\n");

  // Hard cap well under text-embedding-3-small's 8192-token window (~4 chars/token).
  return joined.length > 28_000 ? joined.slice(0, 28_000) : joined;
}

export type EmbedSummary = {
  requested: number;
  embeddedCount: number;
  skippedCount: number;
};

export async function embedCompanies(options?: { limit?: number }): Promise<EmbedSummary> {
  await initializeDatabase();
  const openai = getOpenAiClient();

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
        s_website.content_markdown AS website_content_markdown,
        s_yc_profile.content_markdown AS yc_profile_content_markdown
      FROM companies c
      LEFT JOIN website_snapshots s_website
        ON s_website.company_id = c.id AND s_website.source = @website_source
      LEFT JOIN website_snapshots s_yc_profile
        ON s_yc_profile.company_id = c.id AND s_yc_profile.source = @yc_profile_source
      WHERE c.needs_embed = 1
      ORDER BY c.id ASC
      LIMIT @limit
    `, {
    limit: batchLimit,
    website_source: WEBSITE_SNAPSHOT_SOURCE,
    yc_profile_source: YC_PROFILE_SNAPSHOT_SOURCE,
  });

  if (candidates.length === 0) {
    console.log("No companies need embeddings.");
    return {
      requested: 0,
      embeddedCount: 0,
      skippedCount: 0,
    };
  }

  const companyIds = candidates.map((candidate) => candidate.id);
  const founderRows = companyIds.length === 0 ? [] : await query<FounderContextRow>(`
      SELECT
        f.company_id,
        f.full_name,
        f.title,
        f.bio,
        f.background,
        fg.github_username,
        fg.bio AS github_bio,
        fg.top_languages,
        ARRAY(
          SELECT fm.title
          FROM founder_mentions fm
          WHERE fm.founder_id = f.id AND fm.title IS NOT NULL
          ORDER BY fm.discovered_at DESC
          LIMIT 6
        ) AS mention_titles
      FROM founders f
      LEFT JOIN founder_github fg ON fg.founder_id = f.id
      WHERE f.company_id = ANY(@company_ids::int[])
      ORDER BY f.company_id ASC, f.id ASC
    `, { company_ids: `{${companyIds.join(",")}}` });

  const foundersByCompany = new Map<number, FounderContextRow[]>();
  for (const row of founderRows) {
    const existing = foundersByCompany.get(row.company_id);
    if (existing) {
      existing.push(row);
    } else {
      foundersByCompany.set(row.company_id, [row]);
    }
  }

  const limit = pLimit(10);
  let embeddedCount = 0;
  let skippedCount = 0;

  await Promise.all(
    candidates.map((candidate: EmbedCandidate) =>
      limit(async () => {
        const founderContext = formatFounderContext(foundersByCompany.get(candidate.id) ?? []);
        const embeddingText = buildEmbeddingText(candidate, founderContext);
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
          vector: toVectorLiteral(vector),
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

  if (embeddedCount > 0) {
    try {
      const { revalidateTag } = await import("next/cache");
      revalidateTag("similar-companies", { expire: 0 });
    } catch {
      // Running outside the Next runtime (e.g. cron worker). Tag invalidation is best-effort.
    }
  }

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
