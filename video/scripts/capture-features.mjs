// Captures feature-specific screenshots for the hyperframes video.
// Grabs: semantic search active state, graph view, graph with hover tooltip,
// company profile page, and filter-open state.

import { chromium } from "playwright";
import path from "node:path";
import fs from "node:fs";

const BASE = process.env.YC_BASE_URL || "https://ycsearch-production.up.railway.app";
const OUT = path.resolve("captures/yc-search/screenshots/features");
fs.mkdirSync(OUT, { recursive: true });

const VIEWPORT = { width: 1920, height: 1080 };

async function main() {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: 2,
    colorScheme: "dark",
  });
  const page = await ctx.newPage();
  page.setDefaultTimeout(30000);

  // 1. Landing / table state (for consistency w/ features dir)
  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await page.waitForSelector("table", { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(OUT, "01-table.png"), fullPage: false });
  console.log("captured 01-table.png");

  // 2. Semantic search active — type query, wait for reranked results
  const searchInput = page.locator("input.h-16").first();
  await searchInput.waitFor({ state: "visible", timeout: 15000 });
  await searchInput.click();
  await searchInput.type("AI agents for healthcare workflows", { delay: 40 });
  // wait for debounce + results
  await page.waitForTimeout(2500);
  await page.screenshot({ path: path.join(OUT, "02-semantic-search.png") });
  console.log("captured 02-semantic-search.png");

  // 3. Filter sidebar/open chip — click a tag chip to apply a filter
  await page.goto(`${BASE}/?q=AI%20agents%20for%20healthcare&industries=Healthcare`, {
    waitUntil: "networkidle",
  });
  await page.waitForTimeout(1800);
  await page.screenshot({ path: path.join(OUT, "03-filtered.png") });
  console.log("captured 03-filtered.png");

  // 4. Graph view open (companion graph)
  await page.goto(`${BASE}/?graph=1`, { waitUntil: "networkidle" });
  await page.waitForSelector("canvas", { timeout: 20000 }).catch(() => {});
  // Let the 3D graph settle
  await page.waitForTimeout(5000);
  await page.screenshot({ path: path.join(OUT, "04-graph.png") });
  console.log("captured 04-graph.png");

  // 5. Graph with hover — move mouse over the center of the canvas repeatedly
  // to trigger a node hover tooltip with company image.
  const canvas = await page.locator("canvas").first();
  const box = await canvas.boundingBox();
  if (box) {
    // Spiral-ish hover pattern to land on a node
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    const points = [];
    for (let r = 30; r < 240; r += 15) {
      for (let t = 0; t < 6; t++) {
        const ang = (t / 6) * Math.PI * 2 + r * 0.05;
        points.push([cx + Math.cos(ang) * r, cy + Math.sin(ang) * r]);
      }
    }
    for (const [x, y] of points) {
      await page.mouse.move(x, y);
      await page.waitForTimeout(80);
      // if a tooltip appeared, capture & exit loop
      const hasTip = await page.locator('[data-graph-tooltip], .graph-tooltip, [role="tooltip"]').count();
      if (hasTip > 0) break;
    }
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(OUT, "05-graph-hover.png") });
    console.log("captured 05-graph-hover.png");
  }

  // 6. Company profile page — use Tsenta (id 31259)
  await page.goto(`${BASE}/companies/31259`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1800);
  await page.screenshot({ path: path.join(OUT, "06-company-profile.png"), fullPage: false });
  console.log("captured 06-company-profile.png");

  // 7. Company page scroll — grab similar companies / graph section
  await page.evaluate(() => window.scrollTo({ top: 900, behavior: "instant" }));
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(OUT, "07-company-profile-scroll.png") });
  console.log("captured 07-company-profile-scroll.png");

  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
