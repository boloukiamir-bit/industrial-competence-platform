import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

/**
 * GET /api/debug/bearer
 * DEV only. Returns booleans + lengths for Authorization header and dev bearer env vars (no token values).
 */
export async function GET(request: NextRequest) {
  if (
    process.env.NODE_ENV === "production" ||
    process.env.VERCEL_ENV === "production"
  ) {
    return NextResponse.json(null, { status: 404 });
  }

  const authHeader = request.headers.get("authorization") ?? null;
  const hasAuthHeader = authHeader !== null && authHeader.length > 0;

  let authScheme: "Bearer" | "Other" | null = null;
  let authTokenLength = 0;
  if (authHeader) {
    const parts = authHeader.trim().split(/\s+/);
    if (parts.length >= 1) {
      const scheme = parts[0].toLowerCase();
      authScheme = scheme === "bearer" ? "Bearer" : "Other";
      authTokenLength = parts.length >= 2 ? parts.slice(1).join(" ").length : 0;
    }
  }

  const devBearer = process.env.DEV_BEARER_TOKEN;
  const nextPublicDevBearer = process.env.NEXT_PUBLIC_DEV_BEARER_TOKEN;

  const body = {
    ok: true,
    hasAuthHeader,
    authScheme,
    authTokenLength,
    hasDevBearerTokenEnv: !!devBearer,
    devBearerTokenEnvLength: (devBearer ?? "").length,
    hasNextPublicDevBearerTokenEnv: !!nextPublicDevBearer,
    nextPublicDevBearerTokenEnvLength: (nextPublicDevBearer ?? "").length,
  };

  return NextResponse.json(body);
}
