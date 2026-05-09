import { execFile as execFileCallback } from "node:child_process";
import { promisify } from "node:util";

import { getCrawl4AiPageTimeoutMs, getCrawl4AiPythonBin } from "./env";

const execFile = promisify(execFileCallback);

type BrowserRenderOutput = {
  success?: boolean;
  title?: string;
  text?: string;
  links?: Array<{ text?: string; href?: string }>;
  error?: string;
};

const BROWSER_RENDER_SCRIPT = `
import asyncio
import json
import sys

from playwright.async_api import async_playwright

async def main():
    url = sys.argv[1]
    timeout_ms = int(sys.argv[2])

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(
            viewport={"width": 1440, "height": 1000},
            user_agent=(
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/122.0.0.0 Safari/537.36"
            ),
        )
        page = await context.new_page()
        await page.goto(url, wait_until="networkidle", timeout=timeout_ms)
        await page.wait_for_timeout(5000)

        # Many trust centers lazy-render while scrolling.
        for _ in range(3):
            await page.mouse.wheel(0, 1600)
            await page.wait_for_timeout(500)

        title = await page.title()
        text = await page.locator("body").inner_text(timeout=5000)
        links = await page.eval_on_selector_all(
            "a",
            "(els) => els.map((a) => ({ text: a.innerText || a.textContent || '', href: a.href || '' }))",
        )
        await browser.close()

    print(json.dumps({
        "success": True,
        "title": title,
        "text": text,
        "links": links,
    }))

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except Exception as exc:
        print(json.dumps({
            "success": False,
            "error": str(exc),
        }))
        sys.exit(1)
`;

function parseJsonFromStdout(stdout: string): BrowserRenderOutput {
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
      return JSON.parse(line) as BrowserRenderOutput;
    } catch {
      // Keep searching for the last valid JSON line.
    }
  }

  throw new Error(`Browser render returned an unexpected response: ${stdout.slice(0, 500)}`);
}

export async function renderWebsiteMarkdown(url: string): Promise<string> {
  const pythonBin = getCrawl4AiPythonBin();
  const pageTimeoutMs = getCrawl4AiPageTimeoutMs();
  const { stdout } = await execFile(
    pythonBin,
    ["-c", BROWSER_RENDER_SCRIPT, url, String(pageTimeoutMs + 15_000)],
    {
      timeout: pageTimeoutMs + 45_000,
      maxBuffer: 12 * 1024 * 1024,
    },
  );

  const output = parseJsonFromStdout(stdout);
  if (!output.success) {
    throw new Error(`Browser render failed: ${output.error ?? "Unknown error"}`);
  }

  const title = output.title?.trim();
  const text = output.text?.trim() ?? "";
  const links = (output.links ?? [])
    .map((link) => ({
      text: link.text?.replace(/\s+/g, " ").trim() ?? "",
      href: link.href?.trim() ?? "",
    }))
    .filter((link) => link.href && /^https?:\/\//i.test(link.href))
    .filter((link) => !/powered_by_vanta|vanta\.com\/products\/trust-center/i.test(link.href))
    .slice(0, 300);

  const linkMarkdown = links
    .map((link) => `- [${link.text || link.href}](${link.href})`)
    .join("\n");

  return [
    title ? `# ${title}` : "",
    `Source URL: ${url}`,
    text,
    linkMarkdown ? `\n## Links\n${linkMarkdown}` : "",
  ]
    .filter(Boolean)
    .join("\n\n")
    .trim();
}
