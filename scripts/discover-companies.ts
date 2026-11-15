import "dotenv/config";
import { closeDb } from "../lib/db";
import { runCompanyDiscovery } from "../lib/company-discovery/job";

function integerArg(name: string, fallback: number) {
  const raw = process.argv.find((arg) => arg.startsWith(`--${name}=`))?.split("=")[1];
  return raw === undefined ? fallback : Number(raw);
}
runCompanyDiscovery({
  profileLimit: integerArg("profiles", 5),
  pageLimit: integerArg("pages", 20), searchLimit: integerArg("searches", 8),
  year: integerArg("year", new Date().getUTCFullYear()), lookback: integerArg("lookback", 4),
  browser: process.argv.includes("--browser"),
}).then((summary) => { console.log(JSON.stringify(summary)); })
  .catch(() => { console.error("Company discovery failed; inspect company_discovery_runs and source status."); process.exitCode = 1; })
  .finally(closeDb);
