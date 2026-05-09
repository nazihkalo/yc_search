export const VENDOR_CATEGORIES = [
  "cloud",
  "AI/model provider",
  "data warehouse",
  "analytics",
  "observability",
  "security",
  "auth",
  "payments",
  "CRM",
  "support",
  "email",
  "HR",
  "legal",
  "infrastructure",
  "productivity",
  "other",
] as const;

export type VendorCategory = (typeof VENDOR_CATEGORIES)[number];

export type VendorRelationshipType =
  | "subprocessor"
  | "disclosed_vendor"
  | "detected_technology"
  | "inferred_technology";

export type VendorEntitySeed = {
  canonicalName: string;
  aliases: string[];
  domain: string | null;
  category: VendorCategory;
};

export type VendorMention = {
  rawName: string;
  canonicalName: string;
  normalizedName: string;
  domain: string | null;
  category: VendorCategory;
  aliases: string[];
  relationshipType: VendorRelationshipType;
  confidence: number;
  evidenceUrl: string;
  sourceType: string;
  evidenceSnippet: string;
};

const LEGAL_SUFFIX_PATTERN = /\b(incorporated|inc|llc|ltd|limited|corp|corporation|co|company|gmbh|sa|sas|plc|bv|ag|pte)\b\.?/gi;

export const COMMON_VENDOR_ENTITIES: VendorEntitySeed[] = [
  {
    canonicalName: "Amazon Web Services",
    aliases: ["AWS", "Amazon AWS", "Amazon Web Services", "Amazon S3", "Amazon EC2", "Amazon RDS"],
    domain: "aws.amazon.com",
    category: "cloud",
  },
  {
    canonicalName: "Google Cloud",
    aliases: ["GCP", "Google", "Google LLC", "Google Cloud Platform", "Google Cloud", "Google BigQuery", "BigQuery", "Firebase"],
    domain: "cloud.google.com",
    category: "cloud",
  },
  {
    canonicalName: "Microsoft Azure",
    aliases: ["Azure", "Microsoft", "Microsoft Azure", "Microsoft Cloud", "Microsoft Corporation"],
    domain: "azure.microsoft.com",
    category: "cloud",
  },
  {
    canonicalName: "OpenAI",
    aliases: ["OpenAI", "OpenAI LLC", "OpenAI, L.L.C.", "ChatGPT", "GPT-4", "GPT-5"],
    domain: "openai.com",
    category: "AI/model provider",
  },
  {
    canonicalName: "Anthropic",
    aliases: ["Anthropic", "Claude"],
    domain: "anthropic.com",
    category: "AI/model provider",
  },
  {
    canonicalName: "Mistral AI",
    aliases: ["Mistral", "Mistral AI"],
    domain: "mistral.ai",
    category: "AI/model provider",
  },
  {
    canonicalName: "Cohere",
    aliases: ["Cohere"],
    domain: "cohere.com",
    category: "AI/model provider",
  },
  {
    canonicalName: "ElevenLabs",
    aliases: ["ElevenLabs", "Eleven Labs"],
    domain: "elevenlabs.io",
    category: "AI/model provider",
  },
  {
    canonicalName: "Databricks",
    aliases: ["Databricks"],
    domain: "databricks.com",
    category: "data warehouse",
  },
  {
    canonicalName: "Snowflake",
    aliases: ["Snowflake"],
    domain: "snowflake.com",
    category: "data warehouse",
  },
  {
    canonicalName: "MongoDB",
    aliases: ["MongoDB", "MongoDB Atlas"],
    domain: "mongodb.com",
    category: "infrastructure",
  },
  {
    canonicalName: "PostgreSQL",
    aliases: ["PostgreSQL", "Postgres"],
    domain: "postgresql.org",
    category: "infrastructure",
  },
  {
    canonicalName: "Cloudflare",
    aliases: ["Cloudflare"],
    domain: "cloudflare.com",
    category: "infrastructure",
  },
  {
    canonicalName: "WorkOS",
    aliases: ["WorkOS"],
    domain: "workos.com",
    category: "auth",
  },
  {
    canonicalName: "Vercel",
    aliases: ["Vercel"],
    domain: "vercel.com",
    category: "infrastructure",
  },
  {
    canonicalName: "GitHub",
    aliases: ["GitHub", "GitHub Actions"],
    domain: "github.com",
    category: "productivity",
  },
  {
    canonicalName: "GitLab",
    aliases: ["GitLab"],
    domain: "gitlab.com",
    category: "productivity",
  },
  {
    canonicalName: "Sentry",
    aliases: ["Sentry", "Functional Software, dba Sentry"],
    domain: "sentry.io",
    category: "observability",
  },
  {
    canonicalName: "Datadog",
    aliases: ["Datadog"],
    domain: "datadoghq.com",
    category: "observability",
  },
  {
    canonicalName: "New Relic",
    aliases: ["New Relic"],
    domain: "newrelic.com",
    category: "observability",
  },
  {
    canonicalName: "Segment",
    aliases: ["Segment", "Twilio Segment"],
    domain: "segment.com",
    category: "analytics",
  },
  {
    canonicalName: "Amplitude",
    aliases: ["Amplitude"],
    domain: "amplitude.com",
    category: "analytics",
  },
  {
    canonicalName: "Mixpanel",
    aliases: ["Mixpanel"],
    domain: "mixpanel.com",
    category: "analytics",
  },
  {
    canonicalName: "Google Analytics",
    aliases: ["Google Analytics", "GA4"],
    domain: "analytics.google.com",
    category: "analytics",
  },
  {
    canonicalName: "Okta",
    aliases: ["Okta", "Auth0", "Okta Auth0"],
    domain: "okta.com",
    category: "auth",
  },
  {
    canonicalName: "Clerk",
    aliases: ["Clerk"],
    domain: "clerk.com",
    category: "auth",
  },
  {
    canonicalName: "Stripe",
    aliases: ["Stripe"],
    domain: "stripe.com",
    category: "payments",
  },
  {
    canonicalName: "PayPal",
    aliases: ["PayPal", "Braintree"],
    domain: "paypal.com",
    category: "payments",
  },
  {
    canonicalName: "Salesforce",
    aliases: ["Salesforce"],
    domain: "salesforce.com",
    category: "CRM",
  },
  {
    canonicalName: "HubSpot",
    aliases: ["HubSpot"],
    domain: "hubspot.com",
    category: "CRM",
  },
  {
    canonicalName: "Zendesk",
    aliases: ["Zendesk"],
    domain: "zendesk.com",
    category: "support",
  },
  {
    canonicalName: "Intercom",
    aliases: ["Intercom"],
    domain: "intercom.com",
    category: "support",
  },
  {
    canonicalName: "Nutun",
    aliases: ["Nutun"],
    domain: "nutun.com",
    category: "support",
  },
  {
    canonicalName: "Boldr",
    aliases: ["Boldr"],
    domain: "boldrimpact.com",
    category: "support",
  },
  {
    canonicalName: "SendGrid",
    aliases: ["SendGrid", "Twilio SendGrid"],
    domain: "sendgrid.com",
    category: "email",
  },
  {
    canonicalName: "Twilio",
    aliases: ["Twilio"],
    domain: "twilio.com",
    category: "email",
  },
  {
    canonicalName: "Iterable",
    aliases: ["Iterable"],
    domain: "iterable.com",
    category: "email",
  },
  {
    canonicalName: "Mailchimp",
    aliases: ["Mailchimp", "Intuit Mailchimp"],
    domain: "mailchimp.com",
    category: "email",
  },
  {
    canonicalName: "Slack",
    aliases: ["Slack", "Slack Technologies", "Slack Technologies, Inc."],
    domain: "slack.com",
    category: "productivity",
  },
  {
    canonicalName: "Notion",
    aliases: ["Notion"],
    domain: "notion.com",
    category: "productivity",
  },
  {
    canonicalName: "Workday",
    aliases: ["Workday"],
    domain: "workday.com",
    category: "HR",
  },
  {
    canonicalName: "Deel",
    aliases: ["Deel"],
    domain: "deel.com",
    category: "HR",
  },
  {
    canonicalName: "DocuSign",
    aliases: ["DocuSign"],
    domain: "docusign.com",
    category: "legal",
  },
  {
    canonicalName: "Ironclad",
    aliases: ["Ironclad"],
    domain: "ironcladapp.com",
    category: "legal",
  },
  {
    canonicalName: "HackerOne",
    aliases: ["HackerOne"],
    domain: "hackerone.com",
    category: "security",
  },
  {
    canonicalName: "Sift",
    aliases: ["Sift"],
    domain: "sift.com",
    category: "security",
  },
  {
    canonicalName: "Arkose Labs",
    aliases: ["Arkose", "Arkose Labs"],
    domain: "arkoselabs.com",
    category: "security",
  },
  {
    canonicalName: "Vanta",
    aliases: ["Vanta"],
    domain: "vanta.com",
    category: "security",
  },
  {
    canonicalName: "Brave Search",
    aliases: ["Brave Search", "Brave"],
    domain: "search.brave.com",
    category: "infrastructure",
  },
  {
    canonicalName: "Palantir Federal Cloud Service",
    aliases: ["Palantir Federal Cloud Service", "Palantir Federal Cloud Service PFCS", "PFCS"],
    domain: "palantir.com",
    category: "cloud",
  },
  {
    canonicalName: "Drata",
    aliases: ["Drata"],
    domain: "drata.com",
    category: "security",
  },
];

const aliasToSeed = new Map<string, VendorEntitySeed>();
const domainToSeed = new Map<string, VendorEntitySeed>();

for (const seed of COMMON_VENDOR_ENTITIES) {
  for (const alias of [seed.canonicalName, ...seed.aliases]) {
    aliasToSeed.set(normalizeVendorName(alias), seed);
  }
  if (seed.domain) {
    domainToSeed.set(normalizeDomain(seed.domain), seed);
  }
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function rootDomainFromHost(hostname: string) {
  const parts = hostname.toLowerCase().replace(/^www\./, "").split(".").filter(Boolean);
  return parts.length >= 2 ? parts.slice(-2).join(".") : parts.join(".");
}

export function normalizeDomain(value: string | null | undefined) {
  if (!value) return "";
  try {
    const withProtocol = /^https?:\/\//i.test(value) ? value : `https://${value}`;
    return new URL(withProtocol).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return value.toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0] ?? "";
  }
}

export function normalizeVendorName(value: string) {
  return value
    .replace(/\[[^\]]+\]\([^)]+\)/g, " ")
    .replace(/https?:\/\/\S+/gi, " ")
    .replace(/[`*_~|()[\]{}:,;]/g, " ")
    .replace(LEGAL_SUFFIX_PATTERN, " ")
    .replace(/&/g, " and ")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .toLowerCase();
}

function displayNameFromNormalized(value: string) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function resolveVendorEntity(rawName: string, rawDomain?: string | null): VendorEntitySeed {
  const domain = normalizeDomain(rawDomain);
  const domainSeed = domain ? domainToSeed.get(domain) ?? [...domainToSeed.entries()].find(([key]) => domain.endsWith(`.${key}`))?.[1] : null;
  if (domainSeed) {
    return domainSeed;
  }

  const normalizedName = normalizeVendorName(rawName);
  const aliasSeed = aliasToSeed.get(normalizedName);
  if (aliasSeed) {
    return aliasSeed;
  }

  return {
    canonicalName: rawName.trim() || displayNameFromNormalized(normalizedName),
    aliases: [],
    domain: domain || null,
    category: categorizeVendor(rawName, domain),
  };
}

export function categorizeVendor(rawName: string, rawDomain?: string | null): VendorCategory {
  const text = `${rawName} ${rawDomain ?? ""}`.toLowerCase();
  if (/(openai|anthropic|mistral|cohere|hugging\s*face|model|llm|language model)/.test(text)) return "AI/model provider";
  if (/(aws|amazon web services|google cloud|gcp|azure|cloud provider|data center)/.test(text)) return "cloud";
  if (/(snowflake|databricks|bigquery|redshift|warehouse|data lake)/.test(text)) return "data warehouse";
  if (/(analytics|amplitude|mixpanel|segment|heap|fullstory|plausible)/.test(text)) return "analytics";
  if (/(datadog|sentry|new relic|observability|monitoring|logging|logrocket)/.test(text)) return "observability";
  if (/(security|vanta|drata|hackerone|crowdstrike|snyk|wiz|cyera)/.test(text)) return "security";
  if (/(auth|okta|auth0|clerk|login|identity)/.test(text)) return "auth";
  if (/(stripe|paypal|braintree|payment|billing)/.test(text)) return "payments";
  if (/(salesforce|hubspot|crm)/.test(text)) return "CRM";
  if (/(zendesk|intercom|support|customer service)/.test(text)) return "support";
  if (/(sendgrid|mailchimp|postmark|email|mailgun)/.test(text)) return "email";
  if (/(workday|deel|rippling|greenhouse|ashby|hr|payroll)/.test(text)) return "HR";
  if (/(docusign|ironclad|legal|contract)/.test(text)) return "legal";
  if (/(github|gitlab|vercel|cloudflare|mongodb|postgres|redis|infrastructure|hosting|cdn)/.test(text)) return "infrastructure";
  if (/(slack|notion|google workspace|microsoft 365|productivity)/.test(text)) return "productivity";
  return "other";
}

function relationshipTypeFor(markdown: string, evidenceUrl: string): VendorRelationshipType {
  const lowerEvidenceUrl = evidenceUrl.toLowerCase();
  const text = markdown.slice(0, 30_000).toLowerCase();
  const hasListSignals = /(^|\n)\s*(all\s+)?subprocessors\b/.test(text) ||
    /\bsubprocessors\b[\s\S]{0,600}\b(products?:|purpose|service|location)\b/.test(text) ||
    /\b(products?:|purpose|service|location)\b[\s\S]{0,600}\bsubprocessors\b/.test(text);
  if (hasListSignals && !/(privacy|dpa)/.test(lowerEvidenceUrl)) {
    return "subprocessor";
  }
  if (/(privacy|dpa|data processing|service provider|vendor|processor)/.test(text)) return "disclosed_vendor";
  if (/(built with|powered by|uses|technology|integrations)/.test(text)) return "detected_technology";
  return "inferred_technology";
}

function snippetAround(markdown: string, needle: string) {
  const lower = markdown.toLowerCase();
  const index = lower.indexOf(needle.toLowerCase());
  if (index < 0) {
    return markdown.replace(/\s+/g, " ").trim().slice(0, 500);
  }
  const start = Math.max(0, index - 180);
  const end = Math.min(markdown.length, index + needle.length + 260);
  return markdown.slice(start, end).replace(/\s+/g, " ").trim().slice(0, 600);
}

const PRIVACY_DATA_CATEGORY_PATTERN = new RegExp([
  "identity\\s+and\\s+contact\\s+data",
  "payment\\s+information",
  "communication\\s+information",
  "publicly\\s+available\\s+information",
  "materials?\\s+flagged\\s+for\\s+safety",
  "data\\s+that\\s+we\\s+generate",
  "data\\s+we\\s+(collect|generate|process|use|share|store)",
  "personal\\s+(data|information)",
  "customer\\s+data",
  "account\\s+information",
  "profile\\s+information",
  "contact\\s+information",
  "usage\\s+data",
  "device\\s+information",
  "log\\s+data",
  "cookie\\s+data",
  "marketing\\s+information",
  "billing\\s+information",
  "transaction\\s+information",
  "content\\s+data",
  "sensitive\\s+information",
].join("|"), "i");

const PRIVACY_PURPOSE_PATTERN = new RegExp([
  "^to\\s+",
  "^provide\\b",
  "^communicate\\b",
  "^prevent\\b",
  "^investigate\\b",
  "^detect\\b",
  "^protect\\b",
  "^improve\\b",
  "^maintain\\b",
  "^operate\\b",
  "^comply\\b",
  "^send\\b",
  "^market\\b",
  "prevent\\s+and\\s+investigate\\s+fraud",
  "provide\\s+(the\\s+)?services?",
  "communicate\\s+with\\s+you",
].join("|"), "i");

export function getVendorCandidateRejectionReason(value: string) {
  const cleaned = value
    .replace(/\[([^\]]*)\]\([^)]+\)/g, "$1")
    .replace(/!\[[^\]]*]\([^)]+\)/g, " ")
    .replace(/^["'`]+|["'`]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleaned) return "empty_candidate";
  if (cleaned.includes("![")) return "markdown_image_fragment";
  if (cleaned.length > 90) return "candidate_too_long";
  if (/^(https?:\/\/|www\.)/i.test(cleaned)) return "url_fragment";
  if (PRIVACY_DATA_CATEGORY_PATTERN.test(cleaned)) return "privacy_data_category";
  if (PRIVACY_PURPOSE_PATTERN.test(cleaned)) return "privacy_processing_purpose";
  if (/^(about|all|blog|blog and podcasts|careers|company|compliance and ethics|cross industry solutions|customers|data \+ ai summit.*|discover|dive deep|events|faq|get help|integrations and data|learn|learning|migration [&+a-z ]*deployment|open source|overview|partners|platform|press|pricing|privacy|product|resources|security|security and trust|show|solutions|solution accelerators|subprocessors|all subprocessors|terms|updates|view all|why\b.*|more information|next|previous|filter by|results per page|us|usa|uk|eu)$/i.test(cleaned)) {
    return "navigation_or_heading";
  }
  if (/^(cloud infrastructure|cloud|billing|security|traffic routing|traffic|user support|analytics|email|fraud|web search|text to speech|text-to-speech|speech-to-text|machine translation|content moderation|fedramp)$/i.test(cleaned)) {
    return "service_or_category_label";
  }
  if (/^(worldwide|global|united states|canada|south africa|united kingdom|european union|india|germany|france|ireland|netherlands|australia|singapore)$/i.test(cleaned)) {
    return "location_label";
  }
  return null;
}

function isRejectedVendorCandidate(value: string) {
  return getVendorCandidateRejectionReason(value) !== null;
}

function candidateNameFromTableLine(line: string) {
  const cells = line
    .split("|")
    .map((cell) => cell.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1").trim())
    .filter(Boolean);
  if (cells.length < 2) return null;
  const first = cells[0]?.replace(/^[-: ]+|[-: ]+$/g, "").trim() ?? "";
  if (!first || /^(name|vendor|subprocessor|entity|company|provider|service|purpose|location)$/i.test(first) || isRejectedVendorCandidate(first)) {
    return null;
  }
  if (first.length > 80 || first.split(/\s+/).length > 6) {
    return null;
  }
  if (!/[A-Z0-9]/.test(first.charAt(0))) {
    return null;
  }
  return first;
}

function candidateNameFromBullet(line: string) {
  const cleaned = line.replace(/^[-*+\d.\s]+/, "").trim();
  const firstPart = cleaned.split(/\s+-\s+|\s+–\s+|:|\(|,/)[0]?.trim() ?? "";
  if (!firstPart || firstPart.length > 80 || firstPart.split(/\s+/).length > 6) return null;
  if (isRejectedVendorCandidate(firstPart)) return null;
  if (/^(and|or|the|we|our|service|subprocessor|vendor|processor)$/i.test(firstPart)) return null;
  if (!/[A-Z0-9]/.test(firstPart.charAt(0))) return null;
  return firstPart;
}

function candidateNameFromStandaloneLine(lines: string[], index: number) {
  const current = lines[index]?.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1").trim() ?? "";
  const next = lines[index + 1]?.trim() ?? "";
  const afterNext = lines[index + 2]?.trim() ?? "";

  if (!current || current.length > 90 || current.split(/\s+/).length > 7) return null;
  if (isRejectedVendorCandidate(current)) return null;
  if (/^\d+-\d+\s+of\s+\d+\s+results$/i.test(current)) return null;
  if (/^(products?|product)\s*:/i.test(current)) return null;
  if (/^(worldwide|united states|canada|south africa|united kingdom|european union|india|germany|france|ireland|netherlands|australia|singapore)(\b|\s|\()/i.test(current)) {
    return null;
  }
  if (/^(cloud infrastructure|cloud|billing|security|traffic routing|traffic|user support|analytics|email|fraud|web search|text to speech|fedramp)/i.test(current)) {
    return null;
  }
  if (/^(https?:\/\/|www\.)/i.test(current) || /^[a-z0-9.-]+\.[a-z]{2,}($|\/)/i.test(current)) return null;
  if (!/[A-Z0-9]/.test(current.charAt(0))) return null;

  const looksLikeVantaListItem =
    next === "•" ||
    /^products?:/i.test(next) ||
    /^products?:/i.test(afterNext) ||
    /^(cloud|billing|security|traffic|user support|analytics|email|fraud|web search|text to speech|fedramp)/i.test(next);

  return looksLikeVantaListItem ? current : null;
}

function addMention(
  mentions: Map<string, VendorMention>,
  rawName: string,
  markdown: string,
  evidenceUrl: string,
  sourceType: string,
  confidence: number,
) {
  const entity = resolveVendorEntity(rawName);
  const normalizedName = normalizeVendorName(entity.canonicalName);
  if (!normalizedName || normalizedName.length < 2) return;

  const relationshipType = relationshipTypeFor(markdown, evidenceUrl);
  const key = `${normalizedName}:${relationshipType}:${evidenceUrl}`;
  if (mentions.has(key)) return;

  mentions.set(key, {
    rawName,
    canonicalName: entity.canonicalName,
    normalizedName,
    domain: entity.domain ? normalizeDomain(entity.domain) : null,
    category: entity.category,
    aliases: entity.aliases,
    relationshipType,
    confidence,
    evidenceUrl,
    sourceType,
    evidenceSnippet: snippetAround(markdown, rawName),
  });
}

export function extractVendorMentionsFromMarkdown(markdown: string, evidenceUrl: string, sourceType: string) {
  const mentions = new Map<string, VendorMention>();
  const text = markdown.slice(0, 120_000);
  const lowerEvidenceUrl = evidenceUrl.toLowerCase();
  const likelyVendorPage = /(subprocessor|sub-processor|vendor|privacy|dpa|security|trust)/i.test(text) ||
    /(subprocessor|vendor|privacy|dpa|security|trust)/.test(lowerEvidenceUrl);
  const hasListSignals = /(^|\n)\s*(all\s+)?subprocessors\b/i.test(text) ||
    /\bsubprocessors\b[\s\S]{0,600}\b(products?:|purpose|service|location)\b/i.test(text) ||
    /\b(products?:|purpose|service|location)\b[\s\S]{0,600}\bsubprocessors\b/i.test(text);
  const structuredVendorListPage = /(subprocessor|sub-processor|vendor)/.test(lowerEvidenceUrl) &&
    text.length > 1_000 &&
    hasListSignals;

  for (const seed of COMMON_VENDOR_ENTITIES) {
    for (const alias of [seed.canonicalName, ...seed.aliases]) {
      const pattern = new RegExp(`(^|[^a-zA-Z0-9])${escapeRegExp(alias)}([^a-zA-Z0-9]|$)`, "i");
      if (pattern.test(text)) {
        addMention(mentions, alias, text, evidenceUrl, sourceType, likelyVendorPage ? 0.82 : 0.58);
        break;
      }
    }
    if (seed.domain && text.toLowerCase().includes(seed.domain)) {
      addMention(mentions, seed.canonicalName, text, evidenceUrl, sourceType, likelyVendorPage ? 0.85 : 0.6);
    }
  }

  if (structuredVendorListPage) {
    const lines = text.split(/\r?\n/);
    for (const [index, line] of lines.entries()) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.length > 500) continue;
      const tableCandidate = trimmed.includes("|") ? candidateNameFromTableLine(trimmed) : null;
      if (tableCandidate) {
        addMention(mentions, tableCandidate, text, evidenceUrl, sourceType, 0.72);
        continue;
      }
      if (/^[-*+\d.]\s+/.test(trimmed)) {
        const bulletCandidate = candidateNameFromBullet(trimmed);
        if (bulletCandidate) {
          addMention(mentions, bulletCandidate, text, evidenceUrl, sourceType, 0.62);
        }
      }
      const standaloneCandidate = candidateNameFromStandaloneLine(lines, index);
      if (standaloneCandidate) {
        addMention(mentions, standaloneCandidate, text, evidenceUrl, sourceType, 0.66);
      }
    }
  }

  return [...mentions.values()];
}

export function extractLikelyTrustLinks(markdown: string, baseUrl: string) {
  const candidates = new Set<string>();
  const linkPattern = /\[([^\]]+)\]\(([^)]+)\)/g;
  let match: RegExpExecArray | null;
  while ((match = linkPattern.exec(markdown)) !== null) {
    const linkText = match[1]?.trim() ?? "";
    const href = match[2]?.trim();
    if (!href || href.startsWith("#") || href.startsWith("mailto:")) continue;
    try {
      const candidate = new URL(href, baseUrl);
      const base = new URL(baseUrl);
      const baseRootDomain = rootDomainFromHost(base.hostname);
      const candidateRootDomain = rootDomainFromHost(candidate.hostname);
      const companyVantaTrustUrl = candidateRootDomain === "vanta.com" &&
        candidate.pathname.toLowerCase().includes(baseRootDomain);
      if (candidateRootDomain !== baseRootDomain && !companyVantaTrustUrl) {
        continue;
      }
      if (/requestAccessOpen/i.test(candidate.search) || /\/(faq|resources)(\/|$)/i.test(candidate.pathname)) {
        continue;
      }
      const signal = `${linkText} ${candidate.pathname} ${candidate.search}`;
      if (!/(trust|security|subprocessor|sub-processor|privacy|dpa|data processing|legal|gdpr|vendor)/i.test(signal)) {
        continue;
      }
      const candidateWithoutHash = `${candidate.origin}${candidate.pathname}${candidate.search}`;
      const baseWithoutHash = `${base.origin}${base.pathname}${base.search}`;
      if (candidateWithoutHash === baseWithoutHash) continue;
      if (candidate.pathname === "/" && !/(trust|security|privacy|legal|dpa|subprocessor|sub-processor|vendor)/i.test(candidate.hostname)) {
        continue;
      }
      candidate.hash = "";
      candidates.add(candidate.toString());
    } catch {
      // Ignore malformed markdown links.
    }
  }
  return [...candidates];
}
