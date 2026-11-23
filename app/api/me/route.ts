import { getCurrentUser } from "../../../lib/auth";
export async function POST() {
  const user = await getCurrentUser();
  return Response.json({ ok: Boolean(user) }, { status: user ? 200 : 401 });
}
