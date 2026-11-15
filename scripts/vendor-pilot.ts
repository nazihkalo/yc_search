import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { closeDb, initializeDatabase } from "../lib/db";
import { createVendorPilot, getVendorPilotReport } from "../lib/vendor-pilot";

async function main() {
  const args = process.argv.slice(2);
  const unknown = args.filter((arg) => !["--create=", "--report=", "--limit=", "--output="].some((prefix) => arg.startsWith(prefix)));
  if (unknown.length) throw new Error(`Unknown arguments: ${unknown.join(", ")}`);
  const get = (key: string) => args.find((arg) => arg.startsWith(`--${key}=`))?.split("=").slice(1).join("=");
  const create = get("create");
  const report = get("report");
  if (Boolean(create) === Boolean(report)) throw new Error("Use either --create=NAME or --report=NAME");
  await initializeDatabase();
  if (create) {
    const count = await createVendorPilot(create, Number(get("limit") ?? 100));
    console.log(JSON.stringify({ pilotId: create, cohortSize: count }));
  } else if (report) {
    const result = await getVendorPilotReport(report);
    const output = resolve(get("output") ?? `data/vendor-pilot-${report.replace(/[^a-zA-Z0-9_-]/g, "_")}.json`);
    await mkdir(dirname(output), { recursive: true });
    await writeFile(output, `${JSON.stringify(result, null, 2)}\n`);
    console.log(JSON.stringify({ output, coverage: result.coverage, totals: result.totals }, null, 2));
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(closeDb);
