import { getDb } from "../db";
import { scrapeWebsiteMarkdown } from "../crawl4ai";
import { sha256 } from "../hash";
import { canonicalCompanyProfile, companyDomain } from "./extract";

export function extractProfileWebsite(content: string) {
  const match = content.match(/\bWebsite\s*\n\s*\[\s*(https?:\/\/[^\]\s]+)\s*\]\((https?:\/\/[^)\s]+)\)/i);
  if (!match) return null;
  try {
    const link = new URL(match[2]);
    const target = link.hostname === "www.linkedin.com" && link.pathname === "/redir/redirect" ? link.searchParams.get("url") : link.href;
    if (!target || !companyDomain(target) || companyDomain(target) !== companyDomain(match[1])) return null;
    return { website: target, evidence: match[0] };
  } catch { return null; }
}

export async function resolveProfileWebsites(limit: number, fetchProfile = (url: string) => scrapeWebsiteMarkdown(url, { signal: AbortSignal.timeout(90_000), allowProxy: true })) {
  const db = getDb();
  const due = (await db.query<{ profile_url: string }>(`SELECT profile_url FROM company_profile_websites
    WHERE next_check_at<=NOW() AND website IS NULL ORDER BY next_check_at,profile_url LIMIT $1`, [limit])).rows;
  let resolved = 0;
  const sources = new Set<string>();
  for (const { profile_url: profile } of due) {
    try {
      if (!canonicalCompanyProfile(profile)) throw new Error("Invalid profile URL");
      const content = await fetchProfile(profile);
      const result = extractProfileWebsite(content);
      if (!result) throw new Error("No supported public Website field");
      await db.query(`UPDATE company_profile_websites SET website=$2,evidence=$3,content_hash=$4,
        checked_at=NOW(),last_error=NULL,next_check_at=NOW()+INTERVAL '180 days' WHERE profile_url=$1`,
      [profile, result.website, result.evidence, sha256(content)]);
      resolved++;
      const rows = (await db.query<{ source_url: string }>("SELECT DISTINCT source_url FROM company_list_memberships WHERE profile_url=$1", [profile])).rows;
      for (const row of rows) sources.add(row.source_url);
    } catch {
      await db.query(`UPDATE company_profile_websites SET checked_at=NOW(),last_error='Public profile website unavailable',
        next_check_at=NOW()+INTERVAL '7 days' WHERE profile_url=$1`, [profile]);
    }
  }
  return { attempted: due.length, resolved, sources };
}
