import { auth } from "@clerk/nextjs/server";

import { execute, queryOne } from "./db";

export type AppUser = {
  id: string;
  email: string;
  name: string | null;
  image_url: string | null;
  plan: "free" | "pro" | "team";
  created_at: string;
};

const PLAN_RANK: Record<AppUser["plan"], number> = {
  free: 0,
  pro: 1,
  team: 2,
};

export async function getCurrentUserId(): Promise<string | null> {
  const { userId } = await auth();
  return userId;
}

export async function getCurrentUser(): Promise<AppUser | null> {
  const userId = await getCurrentUserId();
  if (!userId) return null;
  const row = await queryOne<AppUser>(
    "SELECT id, email, name, image_url, plan, created_at FROM users WHERE id = @id",
    { id: userId },
  );
  return row ?? null;
}

export function recordUsage(userId: string, endpoint: string, costUnits = 1): void {
  execute(
    "INSERT INTO usage_events (user_id, endpoint, cost_units) VALUES (@userId, @endpoint, @costUnits)",
    { userId, endpoint, costUnits },
  ).catch((error) => {
    console.error("[usage] failed to record", { userId, endpoint, error });
  });
}

export function userMeetsPlan(user: AppUser | null, minPlan: AppUser["plan"]): boolean {
  if (!user) return false;
  return PLAN_RANK[user.plan] >= PLAN_RANK[minPlan];
}

export async function requirePlan(_minPlan: AppUser["plan"]): Promise<{ userId: string | null; allowed: boolean }> {
  // Monetization hook: during beta every authenticated user is allowed on every endpoint.
  // Flip this to check the users.plan column once Clerk Billing is enabled.
  const userId = await getCurrentUserId();
  return { userId, allowed: Boolean(userId) };
}
