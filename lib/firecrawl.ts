import { getFirecrawlApiKey } from "./env";

type FirecrawlScrapeResponse = {
  success?: boolean;
  data?: {
    markdown?: string;
  };
  markdown?: string;
  error?: string;
};

const FIRECRAWL_SCRAPE_URL = "https://api.firecrawl.dev/v1/scrape";

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

export async function scrapeWebsiteMarkdown(url: string): Promise<string> {
  const apiKey = getFirecrawlApiKey();
  const maxAttempts = 3;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const response = await fetch(FIRECRAWL_SCRAPE_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          url,
          formats: ["markdown"],
          onlyMainContent: true,
        }),
      });

      if (!response.ok) {
        const bodyText = await response.text();
        throw new Error(`Firecrawl scrape failed (${response.status}): ${bodyText}`);
      }

      const payload = (await response.json()) as FirecrawlScrapeResponse;
      const markdown = payload.data?.markdown ?? payload.markdown ?? "";
      return markdown.trim();
    } catch (error) {
      const lastAttempt = attempt === maxAttempts;
      if (lastAttempt) {
        throw error;
      }
      await sleep(attempt * 750);
    }
  }

  return "";
}
