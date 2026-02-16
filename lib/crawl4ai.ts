import { execFile as execFileCallback } from "node:child_process";
import { promisify } from "node:util";

import { getCrawl4AiPageTimeoutMs, getCrawl4AiPythonBin } from "./env";

const execFile = promisify(execFileCallback);

type Crawl4AiOutput = {
  success?: boolean;
  markdown?: string;
  error?: string;
};

const CRAWL4AI_BRIDGE_SCRIPT = `
import asyncio
import json
import sys

from crawl4ai import AsyncWebCrawler, BrowserConfig, CrawlerRunConfig

async def main():
    url = sys.argv[1]
    page_timeout = int(sys.argv[2])

    browser_config = BrowserConfig(
        headless=True,
        viewport_width=1440,
        viewport_height=900
    )
    run_config = CrawlerRunConfig(
        page_timeout=page_timeout,
        remove_overlay_elements=True
    )

    async with AsyncWebCrawler(config=browser_config) as crawler:
        result = await crawler.arun(url=url, config=run_config)

    markdown_value = ""
    markdown_obj = getattr(result, "markdown", "")
    if isinstance(markdown_obj, str):
        markdown_value = markdown_obj
    else:
        markdown_value = (
            getattr(markdown_obj, "fit_markdown", None)
            or getattr(markdown_obj, "raw_markdown", None)
            or str(markdown_obj)
        )

    print(json.dumps({
        "success": bool(getattr(result, "success", False)),
        "markdown": markdown_value,
        "error": getattr(result, "error_message", None),
    }))

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except Exception as exc:
        print(json.dumps({
            "success": False,
            "markdown": "",
            "error": str(exc),
        }))
        sys.exit(1)
`;

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

function isMissingCrawl4AiModule(stderr: string, errorMessage: string) {
  const combined = `${stderr}\n${errorMessage}`;
  return combined.includes("ModuleNotFoundError: No module named 'crawl4ai'");
}

function parseJsonFromStdout(stdout: string): Crawl4AiOutput {
  const lines = stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  for (let index = lines.length - 1; index >= 0; index -= 1) {
    const line = lines[index];
    if (!line.startsWith("{") || !line.endsWith("}")) {
      continue;
    }

    try {
      return JSON.parse(line) as Crawl4AiOutput;
    } catch {
      // Keep searching for the last valid JSON line.
    }
  }

  throw new Error(`Crawl4AI returned an unexpected response: ${stdout.slice(0, 500)}`);
}

export async function scrapeWebsiteMarkdown(url: string): Promise<string> {
  const pythonBin = getCrawl4AiPythonBin();
  const pageTimeoutMs = getCrawl4AiPageTimeoutMs();
  const maxAttempts = 3;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const { stdout, stderr } = await execFile(
        pythonBin,
        ["-c", CRAWL4AI_BRIDGE_SCRIPT, url, String(pageTimeoutMs)],
        {
          timeout: pageTimeoutMs + 30_000,
          maxBuffer: 10 * 1024 * 1024,
        },
      );

      const output = parseJsonFromStdout(stdout);
      if (!output.success) {
        const details = output.error ?? stderr ?? "Unknown Crawl4AI error";
        throw new Error(`Crawl4AI scrape failed: ${details}`);
      }

      return (output.markdown ?? "").trim();
    } catch (error) {
      if (error instanceof Error) {
        const execError = error as Error & { stderr?: string };
        const stderr = execError.stderr ?? "";
        if (isMissingCrawl4AiModule(stderr, error.message)) {
          throw new Error(
            [
              `Crawl4AI is not installed in the Python runtime: ${pythonBin}`,
              "Install it in that interpreter and rerun:",
              `  ${pythonBin} -m pip install -U crawl4ai`,
              `  ${pythonBin} -m crawl4ai.install`,
              "If Crawl4AI is installed in a different interpreter, set CRAWL4AI_PYTHON_BIN in .env.",
            ].join("\n"),
          );
        }
      }
      if (attempt === maxAttempts) {
        throw error;
      }
      await sleep(attempt * 1000);
    }
  }

  return "";
}
