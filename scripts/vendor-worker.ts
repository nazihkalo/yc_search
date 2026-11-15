import { setTimeout as sleep } from "node:timers/promises";
import { closeDb, initializeDatabase } from "../lib/db";
import { getVendorQueueStatus } from "../lib/vendor-jobs";
import { requireVendorPilot } from "../lib/vendor-pilot";
import { enrichCompanyVendors } from "./enrich-company-vendors";

async function main() {
  const args = process.argv.slice(2);
  const unknown = args.filter((arg) => arg !== "--continuous" && arg !== "--status" && !arg.startsWith("--limit=") && !arg.startsWith("--pilot="));
  if (unknown.length) throw new Error(`Unknown arguments: ${unknown.join(", ")}`);
  const limit = Number(args.find((arg) => arg.startsWith("--limit="))?.slice(8) ?? 25);
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 1000) throw new Error("Limit must be between 1 and 1000");
  const pilotId = args.find((arg) => arg.startsWith("--pilot="))?.slice(8) ?? process.env.VENDOR_PILOT_ID;
  if (pilotId === "") throw new Error("Pilot name is required");
  await initializeDatabase();
  if (args.includes("--status")) {
    console.log(JSON.stringify(await getVendorQueueStatus(), null, 2));
    return;
  }
  if (pilotId) await requireVendorPilot(pilotId);
  let stopping = false;
  const stop = new AbortController();
  const handleStop = () => { stopping = true; stop.abort(); };
  process.once("SIGTERM", handleStop);
  process.once("SIGINT", handleStop);
  try {
    do {
      const summary = await enrichCompanyVendors({ limit, pilotId, shouldStop: () => stopping });
      console.log(JSON.stringify({ event: "vendor_batch", ...summary, queue: await getVendorQueueStatus() }));
      if (!args.includes("--continuous") || stopping) break;
      // Keep idle workers cheap; ready jobs continue immediately after a full batch.
      if (summary.requested < limit) await sleep(15_000, undefined, { signal: stop.signal }).catch((error) => {
        if (!stopping) throw error;
      });
    } while (!stopping);
  } finally {
    process.removeListener("SIGTERM", handleStop);
    process.removeListener("SIGINT", handleStop);
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(closeDb);
