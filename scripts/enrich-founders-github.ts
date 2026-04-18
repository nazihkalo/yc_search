import { pathToFileURL } from "node:url";

import pLimit from "p-limit";

import { closeDb, execute, initializeDatabase, query } from "../lib/db";
import { getGithubToken, getSyncGithubLimit } from "../lib/env";

type FounderRow = {
  id: number;
  full_name: string;
  github_url: string;
};

function parseLimitArg(defaultLimit: number): number {
  const argument = process.argv.find((value) => value.startsWith("--limit="));
  if (!argument) {
    return defaultLimit;
  }
  const parsed = Number(argument.split("=")[1]);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : defaultLimit;
}

function extractUsername(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (!parsed.hostname.toLowerCase().endsWith("github.com")) {
      return null;
    }
    const segment = parsed.pathname.split("/").filter(Boolean)[0];
    if (!segment) {
      return null;
    }
    if (["orgs", "topics", "collections", "sponsors", "about", "features"].includes(segment.toLowerCase())) {
      return null;
    }
    return segment;
  } catch {
    return null;
  }
}

async function githubFetch(url: string, token: string | null): Promise<Response> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "yc-search/1.0",
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return fetch(url, { headers });
}

type UserPayload = {
  login: string;
  name: string | null;
  bio: string | null;
  company: string | null;
  location: string | null;
  blog: string | null;
  public_repos: number | null;
  followers: number | null;
  following: number | null;
};

type RepoPayload = {
  name: string;
  description: string | null;
  stargazers_count: number | null;
  language: string | null;
  html_url: string;
  fork: boolean;
  archived: boolean;
};

async function fetchUser(username: string, token: string | null): Promise<UserPayload> {
  const response = await githubFetch(`https://api.github.com/users/${encodeURIComponent(username)}`, token);
  if (!response.ok) {
    throw new Error(`GitHub user fetch failed (${response.status}): ${await response.text().catch(() => "")}`);
  }
  return (await response.json()) as UserPayload;
}

async function fetchRepos(username: string, token: string | null): Promise<RepoPayload[]> {
  const response = await githubFetch(
    `https://api.github.com/users/${encodeURIComponent(username)}/repos?per_page=30&sort=updated`,
    token,
  );
  if (!response.ok) {
    throw new Error(`GitHub repos fetch failed (${response.status}): ${await response.text().catch(() => "")}`);
  }
  return (await response.json()) as RepoPayload[];
}

function summarizeRepos(repos: RepoPayload[]) {
  const publicRepos = repos.filter((repo) => !repo.fork && !repo.archived);
  const topRepos = [...publicRepos]
    .sort((a, b) => (b.stargazers_count ?? 0) - (a.stargazers_count ?? 0))
    .slice(0, 6)
    .map((repo) => ({
      name: repo.name,
      url: repo.html_url,
      description: repo.description,
      stars: repo.stargazers_count ?? 0,
      language: repo.language,
    }));

  const languageCounts = new Map<string, number>();
  for (const repo of publicRepos) {
    if (!repo.language) continue;
    languageCounts.set(repo.language, (languageCounts.get(repo.language) ?? 0) + 1);
  }
  const topLanguages = [...languageCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([language, count]) => ({ language, count }));

  return { topRepos, topLanguages };
}

export type GithubEnrichSummary = {
  requested: number;
  successCount: number;
  failureCount: number;
  skippedCount: number;
};

export async function enrichFoundersGithub(options?: { limit?: number }): Promise<GithubEnrichSummary> {
  await initializeDatabase();
  const token = getGithubToken();
  if (!token) {
    console.warn("GITHUB_TOKEN is not set; rate-limited at 60 req/hr.");
  }

  const batchLimit = options?.limit ?? parseLimitArg(getSyncGithubLimit());
  const candidates = await query<FounderRow>(`
      SELECT id, full_name, github_url
      FROM founders
      WHERE needs_github_enrich = 1
        AND github_url IS NOT NULL
      ORDER BY id ASC
      LIMIT @limit
    `, { limit: batchLimit });

  if (candidates.length === 0) {
    return { requested: 0, successCount: 0, failureCount: 0, skippedCount: 0 };
  }

  const limit = pLimit(token ? 6 : 1);
  let successCount = 0;
  let failureCount = 0;
  let skippedCount = 0;

  await Promise.all(
    candidates.map((founder) =>
      limit(async () => {
        const username = extractUsername(founder.github_url);
        if (!username) {
          skippedCount += 1;
          await execute(
            `UPDATE founders SET needs_github_enrich = 0, updated_at = NOW() WHERE id = @id`,
            { id: founder.id },
          );
          return;
        }

        try {
          const [user, repos] = await Promise.all([
            fetchUser(username, token),
            fetchRepos(username, token),
          ]);
          const { topRepos, topLanguages } = summarizeRepos(repos);

          await execute(`
            INSERT INTO founder_github (
              founder_id, github_username, name, bio, company, location, blog,
              public_repos, followers, following, top_languages, top_repos,
              error, fetched_at, updated_at
            ) VALUES (
              @founder_id, @github_username, @name, @bio, @company, @location, @blog,
              @public_repos, @followers, @following, @top_languages::jsonb, @top_repos::jsonb,
              NULL, NOW(), NOW()
            )
            ON CONFLICT(founder_id) DO UPDATE SET
              github_username = EXCLUDED.github_username,
              name = EXCLUDED.name,
              bio = EXCLUDED.bio,
              company = EXCLUDED.company,
              location = EXCLUDED.location,
              blog = EXCLUDED.blog,
              public_repos = EXCLUDED.public_repos,
              followers = EXCLUDED.followers,
              following = EXCLUDED.following,
              top_languages = EXCLUDED.top_languages,
              top_repos = EXCLUDED.top_repos,
              error = NULL,
              fetched_at = NOW(),
              updated_at = NOW()
          `, {
            founder_id: founder.id,
            github_username: user.login,
            name: user.name,
            bio: user.bio,
            company: user.company,
            location: user.location,
            blog: user.blog,
            public_repos: user.public_repos,
            followers: user.followers,
            following: user.following,
            top_languages: JSON.stringify(topLanguages),
            top_repos: JSON.stringify(topRepos),
          });

          await execute(`
            UPDATE founders
            SET needs_github_enrich = 0,
                last_enriched_at = NOW(),
                updated_at = NOW()
            WHERE id = @id
          `, { id: founder.id });

          successCount += 1;
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          await execute(`
            INSERT INTO founder_github (
              founder_id, github_username, error, fetched_at, updated_at
            ) VALUES (@founder_id, @github_username, @error, NOW(), NOW())
            ON CONFLICT(founder_id) DO UPDATE SET
              error = EXCLUDED.error,
              fetched_at = NOW(),
              updated_at = NOW()
          `, {
            founder_id: founder.id,
            github_username: username,
            error: message,
          });

          await execute(`
            UPDATE founders
            SET needs_github_enrich = 0, updated_at = NOW()
            WHERE id = @id
          `, { id: founder.id });

          failureCount += 1;
        }
      }),
    ),
  );

  await execute(`
    INSERT INTO sync_state (key, value, updated_at)
    VALUES ('founders_github_last_sync_at', @value, NOW())
    ON CONFLICT(key) DO UPDATE SET
      value = EXCLUDED.value,
      updated_at = NOW()
  `, { value: new Date().toISOString() });

  return {
    requested: candidates.length,
    successCount,
    failureCount,
    skippedCount,
  };
}

async function main() {
  const summary = await enrichFoundersGithub();
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
