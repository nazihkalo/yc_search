import { pathToFileURL } from "node:url";

import { closeDb, execute, initializeDatabase, query, withTransaction } from "../lib/db";
import { YC_PROFILE_SNAPSHOT_SOURCE } from "../lib/snapshot-source";
import { parseYcCompanyProfileSnapshotMarkdown } from "../lib/yc-company-page";

type CandidateRow = {
  id: number;
  top_company: number;
  content_markdown: string;
};

function parseLimitArg(defaultLimit = 0): number {
  const argument = process.argv.find((value) => value.startsWith("--limit="));
  if (!argument) {
    return defaultLimit;
  }
  const parsed = Number(argument.split("=")[1]);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : defaultLimit;
}

function extractUrlsByHost(bio: string | null) {
  if (!bio) {
    return { github: null, personal: null, wikipedia: null };
  }

  const markdownLinks = [...bio.matchAll(/\[[^\]]*?\]\((https?:\/\/[^\s)]+)\)/g)].map((match) => match[1]);
  const bareUrls = [...bio.matchAll(/https?:\/\/[^\s<>"')\]]+/g)].map((match) => match[0]);
  const urls = [...new Set([...markdownLinks, ...bareUrls])];

  let github: string | null = null;
  let wikipedia: string | null = null;
  let personal: string | null = null;

  for (const raw of urls) {
    let parsed: URL;
    try {
      parsed = new URL(raw);
    } catch {
      continue;
    }

    const host = parsed.hostname.toLowerCase().replace(/^www\./, "");

    if (host === "github.com" && !github) {
      const segment = parsed.pathname.split("/").filter(Boolean)[0];
      if (segment && !["orgs", "topics", "collections", "sponsors"].includes(segment.toLowerCase())) {
        github = `https://github.com/${segment}`;
      }
      continue;
    }

    if (host.endsWith("wikipedia.org") && !wikipedia) {
      wikipedia = parsed.toString();
      continue;
    }

    const socialHosts = new Set([
      "linkedin.com",
      "twitter.com",
      "x.com",
      "facebook.com",
      "instagram.com",
      "youtube.com",
      "youtu.be",
      "medium.com",
      "substack.com",
      "crunchbase.com",
      "angel.co",
      "wellfound.com",
      "ycombinator.com",
      "goodreads.com",
      "tiktok.com",
    ]);

    if (socialHosts.has(host)) {
      continue;
    }

    if (!personal) {
      personal = `${parsed.protocol}//${parsed.host}`;
    }
  }

  return { github, personal, wikipedia };
}

export type ExtractFoundersSummary = {
  companiesProcessed: number;
  foundersExtracted: number;
  foundersUpserted: number;
  foundersFlaggedForGithub: number;
  foundersFlaggedForSiteCrawl: number;
  foundersFlaggedForExa: number;
};

export async function extractFounders(options?: { limit?: number; companyId?: number | null }): Promise<ExtractFoundersSummary> {
  await initializeDatabase();

  const companyIdFilter = options?.companyId ?? null;
  const effectiveLimit = options?.limit ?? parseLimitArg();
  const limitClause = (!companyIdFilter && effectiveLimit > 0)
    ? `LIMIT ${Math.floor(effectiveLimit)}`
    : "";
  const whereClause = companyIdFilter ? "AND c.id = @company_id" : "";

  const candidates = await query<CandidateRow>(`
      SELECT c.id, c.top_company, s.content_markdown
      FROM companies c
      INNER JOIN website_snapshots s
        ON s.company_id = c.id AND s.source = @source
      WHERE s.content_markdown IS NOT NULL
        AND s.content_markdown <> ''
        ${whereClause}
      ORDER BY c.id ASC
      ${limitClause}
    `, companyIdFilter
      ? { source: YC_PROFILE_SNAPSHOT_SOURCE, company_id: companyIdFilter }
      : { source: YC_PROFILE_SNAPSHOT_SOURCE });

  let foundersExtracted = 0;
  let foundersUpserted = 0;
  let foundersFlaggedForGithub = 0;
  let foundersFlaggedForSiteCrawl = 0;
  let foundersFlaggedForExa = 0;

  for (const candidate of candidates) {
    const { founders } = parseYcCompanyProfileSnapshotMarkdown(candidate.content_markdown);
    if (founders.length === 0) {
      continue;
    }

    foundersExtracted += founders.length;

    await withTransaction(async (client) => {
      for (const founder of founders) {
        if (!founder.fullName) {
          continue;
        }

        const { github, personal, wikipedia } = extractUrlsByHost(founder.bio);
        const flagGithub = Boolean(github);
        const flagSiteCrawl = Boolean(personal);
        const flagExa = Boolean(candidate.top_company);

        if (flagGithub) foundersFlaggedForGithub += 1;
        if (flagSiteCrawl) foundersFlaggedForSiteCrawl += 1;
        if (flagExa) foundersFlaggedForExa += 1;

        await execute(`
          INSERT INTO founders (
            company_id,
            full_name,
            title,
            bio,
            linkedin_url,
            twitter_url,
            github_url,
            personal_site_url,
            wikipedia_url,
            source,
            needs_github_enrich,
            needs_site_crawl,
            needs_exa_enrich,
            created_at,
            updated_at
          ) VALUES (
            @company_id,
            @full_name,
            @title,
            @bio,
            @linkedin_url,
            @twitter_url,
            @github_url,
            @personal_site_url,
            @wikipedia_url,
            'yc_profile',
            @needs_github_enrich,
            @needs_site_crawl,
            @needs_exa_enrich,
            NOW(),
            NOW()
          )
          ON CONFLICT (company_id, full_name) DO UPDATE SET
            title = EXCLUDED.title,
            bio = EXCLUDED.bio,
            linkedin_url = COALESCE(EXCLUDED.linkedin_url, founders.linkedin_url),
            twitter_url = COALESCE(EXCLUDED.twitter_url, founders.twitter_url),
            github_url = COALESCE(EXCLUDED.github_url, founders.github_url),
            personal_site_url = COALESCE(EXCLUDED.personal_site_url, founders.personal_site_url),
            wikipedia_url = COALESCE(EXCLUDED.wikipedia_url, founders.wikipedia_url),
            needs_github_enrich = CASE
              WHEN EXCLUDED.github_url IS NOT NULL
                AND (founders.github_url IS DISTINCT FROM EXCLUDED.github_url
                  OR founders.needs_github_enrich = 1)
              THEN 1
              ELSE founders.needs_github_enrich
            END,
            needs_site_crawl = CASE
              WHEN EXCLUDED.personal_site_url IS NOT NULL
                AND (founders.personal_site_url IS DISTINCT FROM EXCLUDED.personal_site_url
                  OR founders.needs_site_crawl = 1)
              THEN 1
              ELSE founders.needs_site_crawl
            END,
            needs_exa_enrich = GREATEST(founders.needs_exa_enrich, EXCLUDED.needs_exa_enrich),
            updated_at = NOW()
        `, {
          company_id: candidate.id,
          full_name: founder.fullName,
          title: founder.title,
          bio: founder.bio,
          linkedin_url: founder.linkedinUrl,
          twitter_url: founder.twitterUrl,
          github_url: github,
          personal_site_url: personal,
          wikipedia_url: wikipedia,
          needs_github_enrich: flagGithub ? 1 : 0,
          needs_site_crawl: flagSiteCrawl ? 1 : 0,
          needs_exa_enrich: flagExa ? 1 : 0,
        }, client);

        foundersUpserted += 1;
      }

      await execute(`
        UPDATE companies
        SET needs_embed = 1, updated_at = NOW()
        WHERE id = @id
      `, { id: candidate.id }, client);
    });
  }

  await execute(`
    INSERT INTO sync_state (key, value, updated_at)
    VALUES ('founders_extract_last_sync_at', @value, NOW())
    ON CONFLICT(key) DO UPDATE SET
      value = EXCLUDED.value,
      updated_at = NOW()
  `, { value: new Date().toISOString() });

  return {
    companiesProcessed: candidates.length,
    foundersExtracted,
    foundersUpserted,
    foundersFlaggedForGithub,
    foundersFlaggedForSiteCrawl,
    foundersFlaggedForExa,
  };
}

async function main() {
  const summary = await extractFounders();
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
