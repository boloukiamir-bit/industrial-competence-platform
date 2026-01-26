import { NextResponse } from "next/server";
import { cookies } from "next/headers";

/**
 * GET /api/debug/auth
 * DEV only. Returns { hasCookieSession, cookieKeys } for the current request.
 * Use to verify sb-* cookies exist after login.
 */
export async function GET() {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "Not available outside development" }, { status: 404 });
  }

  const cookieStore = await cookies();
  const all = cookieStore.getAll();
  const cookieKeys = all.map((c) => c.name).filter((n) => n.startsWith("sb-"));
  const hasCookieSession = cookieKeys.length > 0;

  return NextResponse.json({ hasCookieSession, cookieKeys });
}
