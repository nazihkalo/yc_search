import { createHash } from "crypto";

import { initializeDatabase, queryOne } from "./db";
import { getAppSalt } from "./env";

const WINDOW_HOURS = 24;
const ANON_CHAT_LIMIT_PER_WINDOW = 1;

export function hashIp(ip: string): string {
  return createHash("sha256").update(`${getAppSalt()}::${ip}`).digest("hex");
}

export function extractClientIp(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const first = forwardedFor.split(",")[0]?.trim();
    if (first) return first;
  }
  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp;
  return "unknown";
}

export type RateLimitDecision = {
  allowed: boolean;
  remaining: number;
  resetAt: string | null;
};

/**
 * Increments the anonymous chat counter for this IP.
 * Returns whether the call is allowed under the current window.
 * Atomic via a single INSERT ... ON CONFLICT statement.
 */
export async function checkAndIncrementAnonChat(
  ipHash: string,
): Promise<RateLimitDecision> {
  await initializeDatabase();
  const row = await queryOne<{
    call_count: number;
    window_start: string;
  }>(
    `
      INSERT INTO anon_chat_calls (ip_hash, call_count, window_start, updated_at)
      VALUES (@ip_hash, 1, NOW(), NOW())
      ON CONFLICT (ip_hash) DO UPDATE
      SET
        call_count = CASE
          WHEN anon_chat_calls.window_start < NOW() - INTERVAL '${WINDOW_HOURS} hours' THEN 1
          ELSE anon_chat_calls.call_count + 1
        END,
        window_start = CASE
          WHEN anon_chat_calls.window_start < NOW() - INTERVAL '${WINDOW_HOURS} hours' THEN NOW()
          ELSE anon_chat_calls.window_start
        END,
        updated_at = NOW()
      RETURNING call_count, window_start
    `,
    { ip_hash: ipHash },
  );

  if (!row) {
    return { allowed: false, remaining: 0, resetAt: null };
  }

  const callCount = Number(row.call_count);
  const windowStart = new Date(row.window_start);
  const resetAt = new Date(windowStart.getTime() + WINDOW_HOURS * 60 * 60 * 1000);

  return {
    allowed: callCount <= ANON_CHAT_LIMIT_PER_WINDOW,
    remaining: Math.max(0, ANON_CHAT_LIMIT_PER_WINDOW - callCount),
    resetAt: resetAt.toISOString(),
  };
}
