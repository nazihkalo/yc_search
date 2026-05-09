import { pathToFileURL } from "node:url";

import pLimit from "p-limit";

import { closeDb, execute, initializeDatabase, query, queryOne, withTransaction } from "../lib/db";
import { shouldValidateNetNewVendors, getVendorValidationModel } from "../lib/env";
import { exaSearch } from "../lib/exa";
import { renderWebsiteMarkdown } from "../lib/browser-render";
import { scrapeWebsiteMarkdown } from "../lib/crawl4ai";
import { sha256 } from "../lib/hash";
import { getOpenAiClient } from "../lib/openai";
import {
  VENDOR_CATEGORIES,
  getVendorCandidateRejectionReason,
  extractLikelyTrustLinks,
  extractVendorMentionsFromMarkdown,
  normalizeDomain,
  normalizeVendorName,
  type VendorCategory,
  type VendorMention,
} from "../lib/vendor-intelligence";

type VendorCandidate = {
  id: number;
  name: string;
  website: string | null;
};

type CrawlResult = {
  url: string;
  sourceType: string;
  markdown: string;
};

type CrawlError = {
  url: string;
  sourceType: string;
  error: string;
};

type ExistingVendor = {
  id: string | number;
};

type VendorValidationResponse = {
  is_vendor_entity?: unknown;
  canonical_name?: unknown;
  category?: unknown;
  confidence?: unknown;
  reason?: unknown;
};

export type VendorEnrichmentSummary = {
  requested: number;
  successCount: number;
  failureCount: number;
  relationshipsUpserted: number;
};

const TRUST_PATHS = [
  "/subprocessors",
  "/legal/subprocessors",
  "/security",
  "/trust",
  "/sub-processors",
  "/legal/sub-processors",
  "/privacy",
  "/legal/privacy",
  "/dpa",
  "/legal/dpa",
  "/data-processing-addendum",
];

function parseLimitArg(defaultLimit = 50): number {
  const argument = process.argv.find((value) => value.startsWith("--limit="));
  if (!argument) {
    return defaultLimit;
  }
  const parsed = Number(argument.split("=")[1]);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : defaultLimit;
}

function normalizeWebsiteUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    return new URL(/^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`);
  } catch {
    return null;
  }
}

function buildDiscoveryUrls(website: string) {
  const url = normalizeWebsiteUrl(website);
  if (!url) return [];

  const host = url.hostname.toLowerCase().replace(/^www\./, "");
  const origin = `${url.protocol}//${host}`;
  const trustOrigin = `https://trust.${host}`;
  const urls = new Set<string>();
  urls.add(trustOrigin);
  urls.add(`${trustOrigin}/subprocessors`);
  urls.add(`${trustOrigin}/security`);
  for (const path of TRUST_PATHS) {
    urls.add(`${origin}${path}`);
  }
  return [...urls];
}

function classifyTrustUrl(url: string) {
  const lower = url.toLowerCase();
  if (lower.includes("subprocessor") || lower.includes("sub-processor")) return "subprocessorsUrl";
  if (lower.includes("security")) return "securityUrl";
  if (lower.includes("privacy")) return "privacyUrl";
  if (lower.includes("/dpa") || lower.includes("data-processing")) return "dpaUrl";
  if (lower.includes("trust")) return "trustUrl";
  return "primaryUrl";
}

function shouldUseBrowserFallback(markdown: string) {
  const trimmed = markdown.replace(/\s+/g, " ").trim();
  if (trimmed.length < 400) return true;
  return trimmed.length < 2_000 &&
    /(enable javascript|checking your browser|please wait|vanta|trust center)/i.test(trimmed) &&
    !/(subprocessor|service provider|data processing|privacy|security)/i.test(trimmed);
}

async function upsertVendorSnapshot(companyId: number, result: CrawlResult | CrawlError) {
  const markdown = "markdown" in result ? result.markdown : "";
  const error = "error" in result ? result.error : null;
  await execute(`
    INSERT INTO vendor_snapshots (
      company_id,
      url,
      source_type,
      content_markdown,
      content_hash,
      error,
      checked_at,
      updated_at
    ) VALUES (
      @company_id,
      @url,
      @source_type,
      @content_markdown,
      @content_hash,
      @error,
      NOW(),
      NOW()
    )
    ON CONFLICT(company_id, url, source_type) DO UPDATE SET
      content_markdown = EXCLUDED.content_markdown,
      content_hash = EXCLUDED.content_hash,
      error = EXCLUDED.error,
      checked_at = NOW(),
      updated_at = NOW()
  `, {
    company_id: companyId,
    url: result.url,
    source_type: result.sourceType,
    content_markdown: markdown,
    content_hash: markdown ? sha256(markdown) : "",
    error,
  });
}

async function crawlForVendors(companyId: number, url: string, sourceType = "crawl4ai_trust"): Promise<CrawlResult | CrawlError> {
  let crawlError: string | null = null;
  try {
    const markdown = await scrapeWebsiteMarkdown(url);
    if (!shouldUseBrowserFallback(markdown)) {
      const result = { url, sourceType, markdown };
      await upsertVendorSnapshot(companyId, result);
      return result;
    }
    crawlError = `Crawl4AI returned thin content (${markdown.trim().length} chars)`;
  } catch (error) {
    crawlError = error instanceof Error ? error.message : String(error);
  }

  try {
    const markdown = await renderWebsiteMarkdown(url);
    const result = { url, sourceType: `${sourceType}_browser`, markdown };
    await upsertVendorSnapshot(companyId, result);
    return result;
  } catch (browserError) {
    const result = {
      url,
      sourceType,
      error: [
        crawlError,
        browserError instanceof Error ? browserError.message : String(browserError),
      ].join("\n"),
    };
    await upsertVendorSnapshot(companyId, result);
    return result;
  }
}

async function searchVendorPages(company: VendorCandidate) {
  if (process.env.VENDOR_EXA_FALLBACK !== "1") {
    return [];
  }

  const queries = [
    `"${company.name}" subprocessors`,
    `"${company.name}" trust center`,
    `"${company.name}" data processing addendum`,
  ];
  const results: CrawlResult[] = [];

  for (const searchQuery of queries) {
    try {
      const response = await exaSearch(searchQuery, {
        numResults: 3,
        type: "auto",
        contents: { text: { maxCharacters: 12_000, verbosity: "compact" } },
      });
      for (const item of response.results) {
        if (!item.url || !item.text) continue;
        const result = {
          url: item.url,
          sourceType: "exa_search",
          markdown: item.text,
        };
        await upsertVendorSnapshot(company.id, result);
        results.push(result);
      }
    } catch {
      break;
    }
  }

  return results;
}

function stripJsonFence(value: string) {
  return value
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

function vendorCategoryFromUnknown(value: unknown): VendorCategory | null {
  if (typeof value !== "string") return null;
  return (VENDOR_CATEGORIES as readonly string[]).includes(value) ? value as VendorCategory : null;
}

function numericConfidence(value: unknown) {
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  if (!Number.isFinite(parsed)) return null;
  return Math.max(0, Math.min(1, parsed));
}

function isKnownSeedMention(mention: VendorMention) {
  return Boolean(mention.domain) || mention.aliases.length > 0;
}

function rejectionReasonForMention(mention: VendorMention) {
  return getVendorCandidateRejectionReason(mention.rawName) ??
    getVendorCandidateRejectionReason(mention.canonicalName);
}

async function findExistingVendor(mention: VendorMention, client?: Parameters<typeof queryOne>[2]) {
  const domain = mention.domain ? normalizeDomain(mention.domain) : null;
  return queryOne<ExistingVendor>(`
    SELECT id
    FROM vendors
    WHERE normalized_name = @normalized_name
      OR (@domain::text IS NOT NULL AND domain = @domain::text)
    LIMIT 1
  `, {
    normalized_name: mention.normalizedName,
    domain,
  }, client);
}

async function recordVendorCandidateRejection(
  companyId: number,
  mention: VendorMention,
  rejectionReason: string,
  validator = "deterministic",
  validatorModel: string | null = null,
  validatorResponse: unknown = null,
  client?: Parameters<typeof queryOne>[2],
) {
  await execute(`
    INSERT INTO vendor_candidate_rejections (
      company_id,
      raw_vendor_name,
      normalized_name,
      evidence_url,
      source_type,
      evidence_snippet,
      rejection_reason,
      validator,
      validator_model,
      validator_response,
      created_at,
      updated_at
    ) VALUES (
      @company_id,
      @raw_vendor_name,
      @normalized_name,
      @evidence_url,
      @source_type,
      @evidence_snippet,
      @rejection_reason,
      @validator,
      @validator_model,
      @validator_response::jsonb,
      NOW(),
      NOW()
    )
    ON CONFLICT(company_id, normalized_name, evidence_url, source_type) DO UPDATE SET
      raw_vendor_name = EXCLUDED.raw_vendor_name,
      evidence_snippet = EXCLUDED.evidence_snippet,
      rejection_reason = EXCLUDED.rejection_reason,
      validator = EXCLUDED.validator,
      validator_model = EXCLUDED.validator_model,
      validator_response = EXCLUDED.validator_response,
      updated_at = NOW()
  `, {
    company_id: companyId,
    raw_vendor_name: mention.rawName,
    normalized_name: mention.normalizedName,
    evidence_url: mention.evidenceUrl || "",
    source_type: mention.sourceType,
    evidence_snippet: mention.evidenceSnippet,
    rejection_reason: rejectionReason,
    validator,
    validator_model: validatorModel,
    validator_response: validatorResponse === null ? null : JSON.stringify(validatorResponse),
  }, client);
}

async function validateVendorWithLlm(company: VendorCandidate, mention: VendorMention) {
  const model = getVendorValidationModel();
  const openai = getOpenAiClient();
  const completion = await openai.chat.completions.create({
    model,
    response_format: { type: "json_object" },
    temperature: 0,
    messages: [
      {
        role: "system",
        content: [
          "You validate whether an extracted string is a real third-party vendor, subprocessor, service provider, or product/company entity.",
          "Reject data categories, personal-information categories, processing purposes, legal bases, countries/regions, headings, UI labels, table column names, and text fragments.",
          "Accept named external companies/products such as AWS, Stripe, Retool, Vercel, OpenAI, or similar entities when supported by the evidence.",
          `Return strict JSON only with shape: {"is_vendor_entity":true,"canonical_name":"...","category":"${VENDOR_CATEGORIES.join("|")}","confidence":0.0,"reason":"..."}`,
          "Use one of the provided categories exactly. Keep canonical_name concise and do not invent a domain.",
        ].join("\n"),
      },
      {
        role: "user",
        content: JSON.stringify({
          indexed_company: {
            id: company.id,
            name: company.name,
            website: company.website,
          },
          candidate: {
            raw_name: mention.rawName,
            proposed_canonical_name: mention.canonicalName,
            normalized_name: mention.normalizedName,
            relationship_type: mention.relationshipType,
            proposed_category: mention.category,
            confidence: mention.confidence,
            evidence_url: mention.evidenceUrl,
            source_type: mention.sourceType,
            evidence_snippet: mention.evidenceSnippet.slice(0, 1200),
          },
        }),
      },
    ],
  });

  const raw = completion.choices[0]?.message?.content ?? "{}";
  const parsed = JSON.parse(stripJsonFence(raw)) as VendorValidationResponse;
  return { model, raw: parsed };
}

async function vetVendorMentionForUpsert(company: VendorCandidate, mention: VendorMention) {
  const deterministicRejection = rejectionReasonForMention(mention);
  if (deterministicRejection) {
    await recordVendorCandidateRejection(company.id, mention, deterministicRejection);
    return null;
  }

  const existing = await findExistingVendor(mention);

  if (existing) {
    return mention;
  }

  if (isKnownSeedMention(mention) || !shouldValidateNetNewVendors()) {
    return mention;
  }

  try {
    const validation = await validateVendorWithLlm(company, mention);
    const response = validation.raw;
    const accepted = response.is_vendor_entity === true;
    const confidence = numericConfidence(response.confidence);
    const canonicalName = typeof response.canonical_name === "string" ? response.canonical_name.trim() : "";
    const category = vendorCategoryFromUnknown(response.category);
    const reason = typeof response.reason === "string" && response.reason.trim()
      ? response.reason.trim()
      : "llm rejected candidate";

    if (!accepted || !canonicalName || (confidence ?? 0) < 0.65) {
      await recordVendorCandidateRejection(
        company.id,
        mention,
        `llm_rejected: ${reason}`.slice(0, 500),
        "llm",
        validation.model,
        response,
      );
      return null;
    }

    const canonicalRejection = getVendorCandidateRejectionReason(canonicalName);
    if (canonicalRejection) {
      await recordVendorCandidateRejection(
        company.id,
        mention,
        `llm_canonical_rejected: ${canonicalRejection}`,
        "llm",
        validation.model,
        response,
      );
      return null;
    }

    return {
      ...mention,
      canonicalName,
      normalizedName: normalizeVendorName(canonicalName),
      category: category ?? mention.category,
      confidence: Math.max(mention.confidence, confidence ?? mention.confidence),
    };
  } catch (error) {
    await recordVendorCandidateRejection(
      company.id,
      mention,
      `llm_validation_error: ${error instanceof Error ? error.message : String(error)}`.slice(0, 500),
      "llm",
      getVendorValidationModel(),
      null,
    );
    return null;
  }
}

async function upsertVendor(mention: VendorMention, client: Parameters<typeof queryOne>[2]) {
  const domain = mention.domain ? normalizeDomain(mention.domain) : null;
  const existing = await findExistingVendor(mention, client);

  if (existing) {
    await execute(`
      UPDATE vendors
      SET
        canonical_name = @canonical_name,
        domain = COALESCE(vendors.domain, @domain::text),
        category = @category,
        aliases = @aliases::jsonb,
        updated_at = NOW()
      WHERE id = @id
    `, {
      id: Number(existing.id),
      canonical_name: mention.canonicalName,
      domain,
      category: mention.category,
      aliases: JSON.stringify(mention.aliases),
    }, client);
    return Number(existing.id);
  }

  const inserted = await queryOne<{ id: string | number }>(`
    INSERT INTO vendors (
      canonical_name,
      normalized_name,
      domain,
      category,
      aliases,
      created_at,
      updated_at
    ) VALUES (
      @canonical_name,
      @normalized_name,
      @domain::text,
      @category,
      @aliases::jsonb,
      NOW(),
      NOW()
    )
    ON CONFLICT(normalized_name) DO UPDATE SET
      canonical_name = EXCLUDED.canonical_name,
      domain = COALESCE(vendors.domain, EXCLUDED.domain),
      category = EXCLUDED.category,
      aliases = EXCLUDED.aliases,
      updated_at = NOW()
    RETURNING id
  `, {
    canonical_name: mention.canonicalName,
    normalized_name: mention.normalizedName,
    domain,
    category: mention.category,
    aliases: JSON.stringify(mention.aliases),
  }, client);

  if (!inserted) {
    throw new Error(`Failed to upsert vendor ${mention.canonicalName}`);
  }

  return Number(inserted.id);
}

async function upsertCompanyVendor(companyId: number, mention: VendorMention, client: Parameters<typeof queryOne>[2]) {
  const vendorId = await upsertVendor(mention, client);
  await execute(`
    INSERT INTO company_vendors (
      company_id,
      vendor_id,
      raw_vendor_name,
      relationship_type,
      category,
      confidence,
      evidence_url,
      source_type,
      evidence_snippet,
      last_checked_at,
      created_at,
      updated_at
    ) VALUES (
      @company_id,
      @vendor_id,
      @raw_vendor_name,
      @relationship_type,
      @category,
      @confidence,
      @evidence_url,
      @source_type,
      @evidence_snippet,
      NOW(),
      NOW(),
      NOW()
    )
    ON CONFLICT(company_id, vendor_id, relationship_type, evidence_url) DO UPDATE SET
      raw_vendor_name = EXCLUDED.raw_vendor_name,
      category = EXCLUDED.category,
      confidence = GREATEST(company_vendors.confidence, EXCLUDED.confidence),
      source_type = EXCLUDED.source_type,
      evidence_snippet = EXCLUDED.evidence_snippet,
      last_checked_at = NOW(),
      updated_at = NOW()
  `, {
    company_id: companyId,
    vendor_id: vendorId,
    raw_vendor_name: mention.rawName,
    relationship_type: mention.relationshipType,
    category: mention.category,
    confidence: mention.confidence,
    evidence_url: mention.evidenceUrl,
    source_type: mention.sourceType,
    evidence_snippet: mention.evidenceSnippet,
  }, client);
}

async function upsertTrustProfile(companyId: number, crawled: CrawlResult[], error: string | null) {
  const profileUrls: Record<string, string | null> = {
    primaryUrl: crawled[0]?.url ?? null,
    trustUrl: null,
    securityUrl: null,
    subprocessorsUrl: null,
    privacyUrl: null,
    dpaUrl: null,
  };

  for (const item of crawled) {
    const key = classifyTrustUrl(item.url);
    profileUrls[key] = profileUrls[key] ?? item.url;
  }

  await execute(`
    INSERT INTO vendor_trust_profiles (
      company_id,
      primary_url,
      trust_url,
      security_url,
      subprocessors_url,
      privacy_url,
      dpa_url,
      last_checked_at,
      error,
      created_at,
      updated_at
    ) VALUES (
      @company_id,
      @primary_url,
      @trust_url,
      @security_url,
      @subprocessors_url,
      @privacy_url,
      @dpa_url,
      NOW(),
      @error,
      NOW(),
      NOW()
    )
    ON CONFLICT(company_id) DO UPDATE SET
      primary_url = EXCLUDED.primary_url,
      trust_url = EXCLUDED.trust_url,
      security_url = EXCLUDED.security_url,
      subprocessors_url = EXCLUDED.subprocessors_url,
      privacy_url = EXCLUDED.privacy_url,
      dpa_url = EXCLUDED.dpa_url,
      last_checked_at = NOW(),
      error = EXCLUDED.error,
      updated_at = NOW()
  `, {
    company_id: companyId,
    primary_url: profileUrls.primaryUrl,
    trust_url: profileUrls.trustUrl,
    security_url: profileUrls.securityUrl,
    subprocessors_url: profileUrls.subprocessorsUrl,
    privacy_url: profileUrls.privacyUrl,
    dpa_url: profileUrls.dpaUrl,
    error,
  });
}

function dedupeMentions(mentions: VendorMention[]) {
  const byKey = new Map<string, VendorMention>();
  for (const mention of mentions) {
    const key = `${mention.normalizedName}:${mention.relationshipType}`;
    const existing = byKey.get(key);
    if (!existing || mentionScore(mention) > mentionScore(existing)) {
      byKey.set(key, mention);
    }
  }
  return [...byKey.values()];
}

function mentionScore(mention: VendorMention) {
  const evidence = mention.evidenceUrl.toLowerCase();
  const source = mention.sourceType.toLowerCase();
  let score = mention.confidence;
  if (evidence.includes("subprocessor") || evidence.includes("sub-processor")) score += 0.3;
  if (evidence.includes("trust")) score += 0.12;
  if (source.includes("browser")) score += 0.08;
  if (evidence.includes("privacy")) score -= 0.2;
  return score;
}

function hasStrongSubprocessorEvidence(mentions: VendorMention[]) {
  const subprocessorCount = dedupeMentions(mentions).filter((mention) => mention.relationshipType === "subprocessor").length;
  return subprocessorCount >= 3;
}

async function vendorRelationshipKeys(companyId: number) {
  const rows = await query<{
    normalized_name: string;
    relationship_type: string;
    evidence_url: string | null;
  }>(`
    SELECT v.normalized_name, cv.relationship_type, cv.evidence_url
    FROM company_vendors cv
    INNER JOIN vendors v ON v.id = cv.vendor_id
    WHERE cv.company_id = @company_id
  `, { company_id: companyId });

  return new Set(rows.map((row) => `${row.normalized_name}:${row.relationship_type}:${row.evidence_url ?? ""}`));
}

function mentionRelationshipKeys(mentions: VendorMention[]) {
  return new Set(mentions.map((mention) => `${mention.normalizedName}:${mention.relationshipType}:${mention.evidenceUrl}`));
}

function setsDiffer(left: Set<string>, right: Set<string>) {
  if (left.size !== right.size) return true;
  for (const value of left) {
    if (!right.has(value)) return true;
  }
  return false;
}

async function enrichOneCompany(company: VendorCandidate) {
  const website = company.website?.trim();
  if (!website) {
    await execute(`
      UPDATE companies
      SET needs_vendor_enrichment = 0, updated_at = NOW()
      WHERE id = @id
    `, { id: company.id });
    return { ok: true, relationshipsUpserted: 0 };
  }

  const discoveryUrls = buildDiscoveryUrls(website);
  const crawled: CrawlResult[] = [];
  const errors: CrawlError[] = [];
  const mentions: VendorMention[] = [];

  for (const url of discoveryUrls.slice(0, 7)) {
    const result = await crawlForVendors(company.id, url);
    if ("markdown" in result && result.markdown.trim()) {
      crawled.push(result);
      mentions.push(...extractVendorMentionsFromMarkdown(result.markdown, result.url, result.sourceType));
      if (/(subprocessor|sub-processor|vendor)/i.test(result.url) && hasStrongSubprocessorEvidence(mentions)) {
        break;
      }
    } else {
      errors.push(result as CrawlError);
    }
  }

  const linkedUrls = new Set<string>();
  for (const item of crawled) {
    for (const link of extractLikelyTrustLinks(item.markdown, item.url)) {
      linkedUrls.add(link);
    }
  }

  const strongSubprocessorEvidence = hasStrongSubprocessorEvidence(mentions);
  const linksToCrawl = [...linkedUrls]
    .filter((url) => !strongSubprocessorEvidence || /(subprocessor|sub-processor|vendor)/i.test(url))
    .slice(0, 5);

  for (const url of linksToCrawl) {
    if (crawled.some((item) => item.url === url) || errors.some((item) => item.url === url)) continue;
    const result = await crawlForVendors(company.id, url, "crawl4ai_discovered_link");
    if ("markdown" in result && result.markdown.trim()) {
      crawled.push(result);
      mentions.push(...extractVendorMentionsFromMarkdown(result.markdown, result.url, result.sourceType));
    } else {
      errors.push(result as CrawlError);
    }
  }

  if (mentions.length === 0) {
    const searchResults = await searchVendorPages(company);
    crawled.push(...searchResults);
    for (const result of searchResults) {
      mentions.push(...extractVendorMentionsFromMarkdown(result.markdown, result.url, result.sourceType));
    }
  }

  const companyName = normalizeVendorName(company.name);
  const dedupedMentions = dedupeMentions(mentions).filter((mention) =>
    mention.normalizedName !== companyName &&
    !mention.normalizedName.startsWith(`${companyName} `),
  );
  const vettedMentions: VendorMention[] = [];
  for (const mention of dedupedMentions) {
    const vetted = await vetVendorMentionForUpsert(company, mention);
    if (vetted) {
      vettedMentions.push(vetted);
    }
  }
  const existingRelationshipKeys = await vendorRelationshipKeys(company.id);
  const nextRelationshipKeys = mentionRelationshipKeys(vettedMentions);
  const vendorDataChanged = vettedMentions.length > 0 && setsDiffer(existingRelationshipKeys, nextRelationshipKeys);
  await withTransaction(async (client) => {
    for (const mention of vettedMentions) {
      await upsertCompanyVendor(company.id, mention, client);
    }

    await execute(`
      UPDATE companies
      SET
        needs_vendor_enrichment = 0,
        needs_embed = CASE WHEN @changed = 1 THEN 1 ELSE needs_embed END,
        updated_at = NOW()
      WHERE id = @id
    `, {
      id: company.id,
      changed: vendorDataChanged ? 1 : 0,
    }, client);
  });

  const profileError = crawled.length === 0 && errors.length > 0
    ? errors.map((item) => `${item.url}: ${item.error}`).join("\n").slice(0, 1200)
    : null;
  await upsertTrustProfile(company.id, crawled, profileError);

  return { ok: true, relationshipsUpserted: vettedMentions.length };
}

export async function enrichCompanyVendors(options?: { limit?: number }): Promise<VendorEnrichmentSummary> {
  await initializeDatabase();
  const batchLimit = options?.limit ?? parseLimitArg();

  const candidates = await query<VendorCandidate>(`
    SELECT id, name, website
    FROM companies
    WHERE needs_vendor_enrichment = 1
      AND website IS NOT NULL
      AND TRIM(website) != ''
    ORDER BY source_kind ASC, source_rank ASC NULLS LAST, id ASC
    LIMIT @limit
  `, { limit: batchLimit });

  if (candidates.length === 0) {
    console.log("No companies need vendor enrichment.");
    return {
      requested: 0,
      successCount: 0,
      failureCount: 0,
      relationshipsUpserted: 0,
    };
  }

  const limit = pLimit(3);
  let successCount = 0;
  let failureCount = 0;
  let relationshipsUpserted = 0;

  await Promise.all(
    candidates.map((candidate) =>
      limit(async () => {
        try {
          const result = await enrichOneCompany(candidate);
          successCount += 1;
          relationshipsUpserted += result.relationshipsUpserted;
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          await upsertTrustProfile(candidate.id, [], message);
          await execute(`
            UPDATE companies
            SET needs_vendor_enrichment = 0, updated_at = NOW()
            WHERE id = @id
          `, { id: candidate.id });
          failureCount += 1;
        }
      }),
    ),
  );

  await execute(`
    INSERT INTO sync_state (key, value, updated_at)
    VALUES ('vendor_enrichment_last_sync_at', @value, NOW())
    ON CONFLICT(key) DO UPDATE SET
      value = EXCLUDED.value,
      updated_at = NOW()
  `, { value: new Date().toISOString() });

  return {
    requested: candidates.length,
    successCount,
    failureCount,
    relationshipsUpserted,
  };
}

async function main() {
  const summary = await enrichCompanyVendors();
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
