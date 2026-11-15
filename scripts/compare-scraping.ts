import "dotenv/config";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { z } from "zod";
import { closeDb, getDb } from "../lib/db";
import { SCRAPE_BUDGET_SCHEMA } from "../lib/scrape-schema";
import { benchmarkTargets, measureScrape, summarizeScrapeComparison, type ScrapeMode } from "../lib/scrape-benchmark";
import { closeScrapeBrowsers } from "../lib/scrape-browser";
import { proxyAllowed, proxyBudgetSettings, proxyConfiguration } from "../lib/scrape-proxy";

const Targets = z.array(z.object({ name: z.string(), url: z.url().refine((value) => ["https:", "http:"].includes(new URL(value).protocol) && !new URL(value).username && !new URL(value).password), kind: z.enum(["vendor", "company_list", "page"]).optional() })).min(1).max(100);
export async function main() {
  const args = process.argv.slice(2);
  const value = (name: string) => args.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
  const allowed = ["cohort", "from-pilot", "limit", "output", "summarize"];
  if (args.some((arg) => arg !== "--with-proxy" && !allowed.some((name) => arg.startsWith(`--${name}=`)))) throw new Error("Unknown comparison argument");
  if (value("summarize")) {
    if (args.some((arg) => !arg.startsWith("--summarize=") && !arg.startsWith("--output="))) throw new Error("Summary accepts only --summarize and optional --output");
    const report = JSON.parse(await readFile(value("summarize")!, "utf8"));
    report.summary = summarizeScrapeComparison(report.results, Number(process.env.SCRAPE_PROXY_USD_PER_GB ?? 4));
    const output = resolve(value("output") ?? value("summarize")!);
    await mkdir(dirname(output), { recursive: true });
    await writeFile(output, JSON.stringify(report, null, 2));
    console.log(JSON.stringify({ report: output, summary: report.summary }));
    return;
  }
  const limit = Number(value("limit") ?? 20);
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new Error("Limit must be 1–100");
  const input = value("cohort") ?? value("from-pilot");
  if (!input || Boolean(value("cohort")) === Boolean(value("from-pilot"))) throw new Error("Provide exactly one --cohort=JSON or --from-pilot=JSON");
  const contents = JSON.parse(await readFile(input, "utf8"));
  const targets = Targets.parse(value("from-pilot") ? benchmarkTargets(contents, limit) : contents).slice(0, limit);
  const output = resolve(value("output") ?? "data/scrape-comparison.json");
  const withProxy = args.includes("--with-proxy");
  if (withProxy) {
    if (!proxyConfiguration() || !targets.some((target) => proxyAllowed(target.url))) throw new Error("Configure SCRAPE_PROXY_URL, SCRAPE_PROXY_ENABLED=1, and SCRAPE_PROXY_DOMAINS for the cohort first");
    await getDb().query(SCRAPE_BUDGET_SCHEMA);
  }
  const report = {
    generatedAt: new Date().toISOString(), targets: targets.length, withProxy,
    budget: withProxy ? proxyBudgetSettings() : null,
    notes: ["Proxy usage requires --with-proxy and an explicit domain allowlist.", "Methods rotate order across targets; different sessions and changing site state can still affect results.", "Homepage targets measure accessibility. Use confirmed disclosure URLs and kind=vendor to inspect extracted vendor candidates.", "Candidate counts are not verified vendor relationships. Manual extraction review starts unset.", "Browser byte measurements exclude some startup traffic, in-flight transfers, and protocol overhead. Enforce the dollar limit at the provider too."],
    summary: [] as ReturnType<typeof summarizeScrapeComparison>,
    results: [] as Array<{ target: typeof targets[number]; measurements: Awaited<ReturnType<typeof measureScrape>>[] }>,
  };
  const save = async () => { report.summary = summarizeScrapeComparison(report.results, Number(process.env.SCRAPE_PROXY_USD_PER_GB ?? 4)); await mkdir(dirname(output), { recursive: true }); await writeFile(output, JSON.stringify(report, null, 2)); };
  for (const [index, target] of targets.entries()) {
    const methods: ScrapeMode[] = withProxy ? ["http", "browser", "residential"] : ["http", "browser"];
    const order = [...methods.slice(index % methods.length), ...methods.slice(0, index % methods.length)];
    const measurements = [];
    for (const method of order) {
      const result = await measureScrape(target, method);
      measurements.push(result);
      console.log(JSON.stringify({ name: target.name, mode: method, outcome: result.outcome, status: result.status, durationMs: result.durationMs }));
    }
    report.results.push({ target, measurements }); await save();
  }
  console.log(JSON.stringify({ report: output, targets: report.targets, proxyEnabled: withProxy }));
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main()
  .catch((error) => { console.error(error instanceof Error ? error.message : "Comparison failed"); process.exitCode = 1; })
  .finally(async () => { closeScrapeBrowsers(); await closeDb(); });
