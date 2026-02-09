/**
 * GET /api/lines — canonical line list for the active org (public.stations).
 * Returns { lines: string[], source: "stations" } for UI line selectors.
 */
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient, applySupabaseCookies } from "@/lib/supabase/server";
import { getActiveOrgFromSession } from "@/lib/server/activeOrg";
import { getActiveLines } from "@/lib/server/getActiveLines";
import { isLegacyLine } from "@/lib/shared/isLegacyLine";

export async function GET(request: NextRequest) {
  try {
    const { supabase, pendingCookies } = await createSupabaseServerClient();
    const org = await getActiveOrgFromSession(request, supabase);
    if (!org.ok) {
      const res = NextResponse.json({ error: org.error }, { status: org.status });
      applySupabaseCookies(res, pendingCookies);
      return res;
    }
    const raw = await getActiveLines(org.activeOrgId);
    const lines = raw.filter((l) => !isLegacyLine(l));
    const res = NextResponse.json({ lines, source: "stations" });
    applySupabaseCookies(res, pendingCookies);
    return res;
  } catch (err) {
    console.error("GET /api/lines failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch lines" },
      { status: 500 }
    );
  }
}
