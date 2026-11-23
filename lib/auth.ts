import { auth, currentUser } from "@clerk/nextjs/server";

import { captureServerEvent } from "./analytics/server";
import { upsertUser } from "./user-sync";
import { execute, queryOne, initializeDatabase } from "./db";

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
  await initializeDatabase();
  let row = await queryOne<AppUser>(
    "SELECT id, email, name, image_url, plan, created_at FROM users WHERE id = @id",
    { id: userId },
  );
  if (!row) {
    const profile = await currentUser();
    if (!profile || profile.id !== userId) return null;
    await upsertUser({ id: profile.id,
      email: profile.primaryEmailAddress?.emailAddress ?? profile.emailAddresses[0]?.emailAddress ?? "",
      name: profile.fullName, imageUrl: profile.imageUrl, createdAt: new Date(profile.createdAt) });
    captureServerEvent(profile.id, "user_signed_up", { $insert_id: `signup:${profile.id}`,
      signup_method: "clerk", recovered_webhook: true,
      $set_once: { signed_up_at: new Date(profile.createdAt).toISOString() } }, new Date(profile.createdAt));
    row = await queryOne<AppUser>("SELECT id, email, name, image_url, plan, created_at FROM users WHERE id = @id", { id: userId });
  }
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
  void _minPlan;
  // Monetization hook: during beta every authenticated user is allowed on every endpoint.
  // Flip this to check the users.plan column once Clerk Billing is enabled.
  const user = await getCurrentUser();
  return { userId: user?.id ?? null, allowed: Boolean(user) };
}
