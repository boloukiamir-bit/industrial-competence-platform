import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { resolveAuthFromRequest } from "@/lib/server/auth";

/**
 * GET /api/debug/auth
 * DEV only. Returns { ok, userId, email } for cookie or bearer auth.
 * Dev bearer bypasses Supabase session: match DEV_BEARER_TOKEN -> lookup profile by NEXT_PUBLIC_DEV_USER_EMAIL (or fallback).
 */
export async function GET(request: NextRequest) {
  if (
    process.env.NODE_ENV === "production" ||
    process.env.VERCEL_ENV === "production"
  ) {
    return NextResponse.json(null, { status: 404 });
  }

  const authHeader = request.headers.get("authorization") ?? null;
  let bearerToken: string | null = null;
  if (authHeader && /^Bearer\s+/i.test(authHeader)) {
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (token.length > 0) bearerToken = token;
  }

  const devBearerToken = process.env.DEV_BEARER_TOKEN;
  if (
    bearerToken !== null &&
    devBearerToken !== undefined &&
    devBearerToken !== "" &&
    bearerToken === devBearerToken
  ) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      return NextResponse.json(
        { ok: false, error: "Service role not configured" },
        { status: 500 }
      );
    }
    const admin = createClient(url, key);
    const devEmail =
      process.env.NEXT_PUBLIC_DEV_USER_EMAIL?.trim() || "amir@bolouki.se";
    const { data: profile, error } = await admin
      .from("profiles")
      .select("id, email, active_org_id, active_site_id")
      .eq("email", devEmail)
      .maybeSingle();

    if (error) {
      console.error("debug/auth dev_bearer profile lookup failed", error);
      return NextResponse.json(
        { ok: false, error: "Profile lookup failed" },
        { status: 500 }
      );
    }
    if (!profile) {
      return NextResponse.json(
        { ok: false, error: "Dev user profile not found", email: devEmail },
        { status: 401 }
      );
    }

    return NextResponse.json({
      ok: true,
      auth_mode: "dev_bearer",
      email: profile.email ?? devEmail,
      user_id: profile.id,
      active_org_id: profile.active_org_id ?? null,
      active_site_id: profile.active_site_id ?? null,
      role: "admin",
    });
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
