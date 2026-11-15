import type { PoolClient } from "pg";
import { getDb, withTransaction } from "../db";
import { sha256 } from "../hash";
import { companyDomain, canonicalCompanyProfile, normalizedName, EXTRACTION_VERSION, type ExtractedList } from "./extract";
import { canonicalListUrl, publisherOf } from "./sources";

export async function enqueueSource(url: string, kind: "hub" | "list", discoveredFrom: string | null = null, client = getDb()) {
  const canonical = canonicalListUrl(url);
  if (!canonical) return false;
  const result = await client.query(`INSERT INTO company_list_sources(url,publisher,kind,discovered_from)
    VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING`, [canonical, publisherOf(url), kind, discoveredFrom]);
  return Boolean(result.rowCount);
}

export async function persistList(url: string, content: string, list: ExtractedList) {
  return withTransaction(async (client: PoolClient) => {
    // All discovery imports serialize identity allocation/resolution. The cron
    // holds a separate session lock to prevent overlapping scheduled runs.
    await client.query("SELECT pg_advisory_xact_lock(hashtext('company-list-import'))");
    const hash = sha256(content);
    const document = await client.query<{ id: string }>(`INSERT INTO company_list_documents
      (source_url,content_hash,content,extractor_version,extracted) VALUES ($1,$2,$3,$4,$5::jsonb)
      ON CONFLICT(source_url,content_hash,extractor_version) DO UPDATE SET fetched_at=NOW() RETURNING id`,
    [url, hash, content, EXTRACTION_VERSION, JSON.stringify(list)]);
    const existing = (await client.query<{ id: number; name: string; website: string | null }>("SELECT id,name,website FROM companies")).rows;
    const byDomain = new Map<string, typeof existing>();
    const byId = new Map(existing.map((row) => [row.id, row]));
    const names = new Set(existing.map((row) => normalizedName(row.name)));
    const indexDomain = (row: typeof existing[number]) => {
      const domain = companyDomain(row.website);
      if (domain) { const group = byDomain.get(domain) ?? []; group.push(row); byDomain.set(domain, group); }
    };
    for (const row of existing) indexDomain(row);
    let inserted = 0;
    let linked = 0;
    let unresolved = 0;
    for (const member of list.members) {
      const profile = canonicalCompanyProfile(member.profile_url);
      if (profile) await client.query("INSERT INTO company_profile_websites(profile_url) VALUES ($1) ON CONFLICT DO NOTHING", [profile]);
      const resolvedProfile = profile ? (await client.query<{ website: string | null }>("SELECT website FROM company_profile_websites WHERE profile_url=$1", [profile])).rows[0] : null;
      const website = member.website ?? resolvedProfile?.website ?? null;
      const domain = companyDomain(website);
      const matches = domain ? byDomain.get(domain) ?? [] : [];
      const profileId = profile ? (await client.query<{ company_id: number }>("SELECT company_id FROM company_discovery_identities WHERE profile_url=$1", [profile])).rows[0]?.company_id : undefined;
      let companyId: number | null = matches.length === 1 ? matches[0].id : profileId ?? null;
      let resolution = matches.length > 1 ? "ambiguous_domain" : "missing_website";
      if (matches.length > 1 || (profileId !== undefined && companyId !== profileId)) {
        companyId = null;
        resolution = matches.length > 1 ? "ambiguous_domain" : "ambiguous_identity";
      }
      const knownProfileDomain = companyDomain((profileId === undefined ? null : byId.get(profileId)?.website) ?? null);
      if (domain && knownProfileDomain && domain !== knownProfileDomain) { companyId = null; resolution = "domain_conflict"; }
      if ((domain || profile) && matches.length === 0 && profileId === undefined) {
        // A name match with a different/missing domain needs reconciliation,
        // rather than silently duplicating or merging potentially distinct firms.
        if (names.has(normalizedName(member.name))) {
          resolution = "name_conflict";
        } else {
          let allocated: number | null = null;
          for (let attempt = 0; attempt < 100; attempt++) {
            const id = Number((await client.query("SELECT nextval('discovered_company_id_seq') AS id")).rows[0].id);
            const result = await client.query(`INSERT INTO companies
              (id,name,slug,website,source_kind,source_url,source_list_name,source_year,source_rank,
               search_text,company_hash,needs_scrape,needs_website_scrape,needs_yc_profile_scrape,needs_vendor_enrichment,needs_embed)
              VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$12,0,$12,1) ON CONFLICT(id) DO NOTHING RETURNING id`,
            [id, member.name, `discovered-${domain ?? sha256(profile!).slice(0, 16)}`, website, `${publisherOf(url)}_lists`, url, list.title, list.year, member.rank,
              `${member.name} ${domain ?? ""} ${list.title} ${list.year ?? ""} ${list.region ?? ""}`, sha256(`${member.name}:${domain ?? profile}`), domain ? 1 : 0]);
            if (result.rowCount) { allocated = id; break; }
          }
          if (allocated === null) throw new Error("Could not allocate company ID");
          companyId = allocated;
          const added = { id: companyId, name: member.name, website };
          byId.set(companyId, added); names.add(normalizedName(member.name)); indexDomain(added);
          inserted++;
        }
      }
      if (companyId !== null) {
        resolution = domain ? "domain" : "profile_needs_website";
        if (domain && profileId === companyId) {
          const changed = await client.query(`UPDATE companies SET website=$2,needs_scrape=1,needs_website_scrape=1,
            needs_vendor_enrichment=1,needs_embed=1 WHERE id=$1 AND (website IS NULL OR TRIM(website)='')`, [companyId, website]);
          if (changed.rowCount) {
            const known = byId.get(companyId);
            if (known) { known.website = website; indexDomain(known); }
          }
        }
        if (profile) await client.query("INSERT INTO company_discovery_identities(profile_url,company_id) VALUES ($1,$2) ON CONFLICT DO NOTHING", [profile, companyId]);
        linked++;
      } else unresolved++;
      const key = normalizedName(member.name);
      const previous = (await client.query<{ company_id: number | null; document_id: string }>(
        "SELECT company_id,document_id FROM company_list_memberships WHERE source_url=$1 AND member_key=$2", [url, key])).rows[0];
      await client.query(`INSERT INTO company_list_memberships
        (source_url,member_key,company_id,company_name,website,rank,evidence,document_id,resolution,profile_url)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT(source_url,member_key) DO UPDATE SET
        company_id=EXCLUDED.company_id,company_name=EXCLUDED.company_name,website=EXCLUDED.website,rank=EXCLUDED.rank,
        evidence=EXCLUDED.evidence,document_id=EXCLUDED.document_id,resolution=EXCLUDED.resolution,profile_url=EXCLUDED.profile_url,last_seen_at=NOW()`,
      [url, key, companyId, member.name, website, member.rank, member.evidence, document.rows[0].id, resolution, profile]);
      if (companyId !== null && (previous?.company_id !== companyId || previous?.document_id !== document.rows[0].id)) {
        // List context is queried independently from mutable YC metadata.
        await client.query("UPDATE companies SET needs_embed=1 WHERE id=$1", [companyId]);
      }
    }
    await client.query(`UPDATE company_list_sources SET title=$2,list_year=$3,region=$4,content_hash=$5 WHERE url=$1`,
      [url, list.title, list.year, list.region, hash]);
    return { inserted, linked, unresolved };
  });
}
