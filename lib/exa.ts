import { getExaApiKey } from "./env";

export type ExaSearchResult = {
  title: string | null;
  url: string;
  publishedDate: string | null;
  author: string | null;
  text: string | null;
  score: number | null;
};

export type ExaOutputGrounding = {
  field: string;
  citations: Array<{ url: string; title?: string | null }>;
  confidence?: string;
};

export type ExaSearchResponse<T = unknown> = {
  results: ExaSearchResult[];
  output?: {
    content: T;
    grounding?: ExaOutputGrounding[];
  };
  costDollars?: {
    total?: number;
  };
  searchType?: string;
};

type ExaSearchType = "auto" | "fast" | "instant" | "deep-lite" | "deep" | "deep-reasoning" | "neural" | "keyword";
type ExaCategory = "people" | "company" | "news" | "research paper" | "github" | "tweet" | "pdf" | "movie" | "song" | "personal site" | "linkedin profile" | "financial report";

type ExaContents = {
  text?: { maxCharacters?: number; verbosity?: "compact" | "full"; includeHtmlTags?: boolean };
  highlights?: { maxCharacters?: number; query?: string };
  summary?: true | { query?: string };
};

type ExaSearchOptions = {
  numResults?: number;
  type?: ExaSearchType;
  category?: ExaCategory;
  contents?: ExaContents;
  includeDomains?: string[];
  excludeDomains?: string[];
  outputSchema?: Record<string, unknown>;
};

export async function exaSearch<T = unknown>(query: string, options: ExaSearchOptions = {}): Promise<ExaSearchResponse<T>> {
  const apiKey = getExaApiKey();
  if (!apiKey) {
    throw new Error("EXA_API_KEY is not set");
  }

  const body: Record<string, unknown> = {
    query,
    type: options.type ?? "auto",
    numResults: options.numResults ?? 5,
  };
  if (options.category) body.category = options.category;
  if (options.contents) body.contents = options.contents;
  if (options.includeDomains?.length) body.includeDomains = options.includeDomains;
  if (options.excludeDomains?.length) body.excludeDomains = options.excludeDomains;
  if (options.outputSchema) body.outputSchema = options.outputSchema;

  const response = await fetch("https://api.exa.ai/search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const details = await response.text().catch(() => "");
    throw new Error(`Exa search failed (${response.status}): ${details.slice(0, 500)}`);
  }

  return (await response.json()) as ExaSearchResponse<T>;
}

export function classifyMentionKind(url: string, title: string | null): "interview" | "podcast" | "article" | "launch" | "profile" | "other" {
  const host = (() => {
    try {
      return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
    } catch {
      return "";
    }
  })();
  const lowerTitle = (title ?? "").toLowerCase();
  const lowerUrl = url.toLowerCase();

  const podcastHosts = ["podcasts.apple.com", "open.spotify.com", "spotify.com", "soundcloud.com", "overcast.fm", "pca.st", "transistor.fm", "simplecast.com", "buzzsprout.com"];
  if (podcastHosts.some((h) => host.endsWith(h)) || lowerTitle.includes("podcast") || /\bpodcast\b/.test(lowerUrl)) {
    return "podcast";
  }

  if (host.endsWith("youtube.com") || host === "youtu.be" || lowerTitle.includes("interview") || /\binterview\b/.test(lowerUrl)) {
    return "interview";
  }

  if (host.endsWith("producthunt.com") || lowerTitle.includes("launch")) {
    return "launch";
  }

  if (host.endsWith("linkedin.com") || host.endsWith("github.com") || host.endsWith("wikipedia.org")) {
    return "profile";
  }

  const articleHosts = ["techcrunch.com", "forbes.com", "bloomberg.com", "wsj.com", "nytimes.com", "ft.com", "theverge.com", "businessinsider.com", "medium.com", "substack.com"];
  if (articleHosts.some((h) => host.endsWith(h))) {
    return "article";
  }

  return "other";
}

export type FounderBackground = {
  summary: string | null;
  previous_companies: Array<{ name: string; role?: string | null; years?: string | null }>;
  education: Array<{ school: string; degree?: string | null; field?: string | null }>;
  notable_activities: string[];
};

export const FOUNDER_BACKGROUND_SCHEMA: Record<string, unknown> = {
  type: "object",
  description: "Structured background for a startup founder synthesized from public sources",
  required: ["summary", "previous_companies", "education", "notable_activities"],
  properties: {
    summary: {
      type: "string",
      description: "2-3 sentence career summary covering what the person has worked on and is known for",
    },
    previous_companies: {
      type: "array",
      description: "Prior companies or organizations the founder worked at, excluding the current YC company",
      items: {
        type: "object",
        required: ["name"],
        properties: {
          name: { type: "string", description: "Company or organization name" },
          role: { type: "string", description: "Role or title at that company" },
          years: { type: "string", description: "Time period, e.g., '2018-2021'" },
        },
      },
    },
    education: {
      type: "array",
      description: "Schools/universities attended and degrees earned",
      items: {
        type: "object",
        required: ["school"],
        properties: {
          school: { type: "string", description: "School or university name" },
          degree: { type: "string", description: "Degree type, e.g., BS, MS, PhD" },
          field: { type: "string", description: "Field of study" },
        },
      },
    },
    notable_activities: {
      type: "array",
      description: "Notable public activities: talks, papers, products shipped, awards, open-source projects",
      items: { type: "string" },
    },
  },
};
