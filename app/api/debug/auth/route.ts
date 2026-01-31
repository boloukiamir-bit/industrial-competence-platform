import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { resolveAuthFromRequest } from "@/lib/server/auth";

/**
 * GET /api/debug/auth
 * DEV only. Returns { ok, userId, email } for cookie or bearer auth.
 */
export async function GET(request: NextRequest) {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "Not available outside development" }, { status: 404 });
  }

  const resolved = await resolveAuthFromRequest(request);
  if (!resolved.ok) {
    return NextResponse.json({ ok: false, error: resolved.error }, { status: 401 });
  }

  return NextResponse.json({
    ok: true,
    userId: resolved.user.id,
    email: resolved.user.email ?? null,
  });
}
