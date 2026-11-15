import { redactScrapeError } from "./scrape-proxy";

export function formatVendorError(error: unknown) {
  const redact = (message: string) => redactScrapeError(message)
    .replace(/\b(?:sk|rk)-[a-zA-Z0-9_-]+/g, "[redacted]")
    .replace(/Bearer\s+\S+/gi, "Bearer [redacted]")
    .slice(0, 2000);
  if (error && typeof error === "object") {
    const child = error as { stdout?: string; stderr?: string; killed?: boolean; code?: string | number; signal?: string };
    if (typeof child.stdout === "string") {
      for (const line of child.stdout.trim().split(/\r?\n/).reverse()) {
        try {
          const output = JSON.parse(line);
          if (typeof output.error === "string") return redact(`Crawler failed: ${output.error}`);
        } catch { /* Look for the bridge's final JSON response. */ }
      }
    }
    if (child.killed) return `Crawler process timed out or was terminated (${child.signal ?? "unknown signal"})`;
    if (typeof child.stderr === "string") {
      return redact(`Crawler process failed (${child.code ?? "unknown exit"}): ${child.stderr.trim().slice(-1200)}`);
    }
  }
  return redact(error instanceof Error ? error.message : String(error));
}
