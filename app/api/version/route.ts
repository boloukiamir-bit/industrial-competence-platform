/**
 * GET /api/version — build and environment fingerprint. No keys or sensitive data.
 * Used to verify deploy (git SHA, Vercel env, Supabase host) when debugging "old" behavior.
 */
import { NextResponse } from "next/server";

function hostFromUrl(url: string | undefined): string {
  if (!url || typeof url !== "string") return "unknown";
  try {
    const u = new URL(url.trim());
    return u.hostname || "unknown";
  } catch {
    return "unknown";
  }
}

export async function GET() {
  const gitSha =
    process.env.VERCEL_GIT_COMMIT_SHA ??
    process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA ??
    "unknown";
  const vercelEnv = process.env.VERCEL_ENV ?? "unknown";
  const nodeEnv = process.env.NODE_ENV ?? "unknown";
  const pilotMode = process.env.NEXT_PUBLIC_PILOT_MODE === "true";
  const supabaseUrlHost = hostFromUrl(process.env.NEXT_PUBLIC_SUPABASE_URL);

  return NextResponse.json({
    gitSha,
    vercelEnv,
    nodeEnv,
    pilotMode,
    supabaseUrlHost,
  });
}
