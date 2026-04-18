import { execute, withTransaction } from "./db";
import type { PoolClient } from "pg";
import type { YcProfileFounder } from "./yc-company-page";

export type FounderUpsertStats = {
  foundersUpserted: number;
  foundersFlaggedForGithub: number;
  foundersFlaggedForSiteCrawl: number;
  foundersFlaggedForExa: number;
};

const SOCIAL_HOSTS = new Set([
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

export function extractFounderUrlsFromBio(bio: string | null) {
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

    if (SOCIAL_HOSTS.has(host)) continue;

    if (!personal) {
      personal = `${parsed.protocol}//${parsed.host}`;
    }
  }

  return { github, personal, wikipedia };
}

/**
 * Upsert founders for a single company. Mutates the founders and companies tables.
 * Returns counters for logging.
 *
 * Accepts a structured `YcProfileFounder[]` (authoritative path — from YC JSON)
 * and the company's `top_company` flag (used to prioritize Exa enrichment).
 *
 * Callable with an external PoolClient (from an already-open transaction) OR
 * without one (in which case it opens its own transaction).
 */
export async function upsertFoundersForCompany(params: {
  companyId: number;
  topCompany: boolean;
  founders: YcProfileFounder[];
  client?: PoolClient;
}): Promise<FounderUpsertStats> {
  const { companyId, topCompany, founders, client } = params;

  const run = async (conn: PoolClient | undefined): Promise<FounderUpsertStats> => {
    let foundersUpserted = 0;
    let foundersFlaggedForGithub = 0;
    let foundersFlaggedForSiteCrawl = 0;
    let foundersFlaggedForExa = 0;

    for (const founder of founders) {
      if (!founder.fullName) continue;

      const { github, personal, wikipedia } = extractFounderUrlsFromBio(founder.bio);
      const flagGithub = Boolean(github);
      const flagSiteCrawl = Boolean(personal);
      const flagExa = topCompany;

      if (flagGithub) foundersFlaggedForGithub += 1;
      if (flagSiteCrawl) foundersFlaggedForSiteCrawl += 1;
      if (flagExa) foundersFlaggedForExa += 1;

      await execute(
        `
          INSERT INTO founders (
            company_id, full_name, title, bio,
            linkedin_url, twitter_url, github_url, personal_site_url, wikipedia_url,
            source, needs_github_enrich, needs_site_crawl, needs_exa_enrich,
            created_at, updated_at
          ) VALUES (
            @company_id, @full_name, @title, @bio,
            @linkedin_url, @twitter_url, @github_url, @personal_site_url, @wikipedia_url,
            'yc_profile', @needs_github_enrich, @needs_site_crawl, @needs_exa_enrich,
            NOW(), NOW()
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
        `,
        {
          company_id: companyId,
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
        },
        conn,
      );

      foundersUpserted += 1;
    }

    if (foundersUpserted > 0) {
      await execute(
        `UPDATE companies SET needs_embed = 1, updated_at = NOW() WHERE id = @id`,
        { id: companyId },
        conn,
      );
    }

    return { foundersUpserted, foundersFlaggedForGithub, foundersFlaggedForSiteCrawl, foundersFlaggedForExa };
  };

  if (client) {
    return run(client);
  }
  return withTransaction(async (conn) => run(conn));
}
