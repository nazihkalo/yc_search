import { exec } from "node:child_process";
import { promisify } from "node:util";

import { NextResponse } from "next/server";

const execAsync = promisify(exec);

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get("authorization");
    const token = process.env.SYNC_TOKEN;

    if (token) {
      const expected = `Bearer ${token}`;
      if (authHeader !== expected) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }

    const { stdout, stderr } = await execAsync("npm run sync:all", {
      cwd: process.cwd(),
      env: process.env,
      timeout: 1000 * 60 * 15,
      maxBuffer: 1024 * 1024 * 10,
    });

    return NextResponse.json({
      ok: true,
      stdout,
      stderr,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
