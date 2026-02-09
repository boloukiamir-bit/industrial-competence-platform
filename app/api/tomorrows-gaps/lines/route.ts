import { NextRequest, NextResponse } from "next/server";
import { getOrgIdFromSession } from "@/lib/orgSession";
import { createSupabaseServerClient, applySupabaseCookies } from "@/lib/supabase/server";
import { getActiveLines } from "@/lib/server/getActiveLines";
import { isLegacyLine } from "@/lib/shared/isLegacyLine";

export async function GET(request: NextRequest) {
  try {
    const { supabase, pendingCookies } = await createSupabaseServerClient();
    const session = await getOrgIdFromSession(request, supabase);
    if (!session.success) {
      const res = NextResponse.json({ error: session.error }, { status: session.status });
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("active_org_id")
      .eq("id", session.userId)
      .single();
    if (profileError) {
      throw profileError;
    }
    if (!profile?.active_org_id) {
      const res = NextResponse.json({ error: "No active organization" }, { status: 403 });
      applySupabaseCookies(res, pendingCookies);
      return res;
    }
    const activeOrgId = profile.active_org_id as string;

    const raw = await getActiveLines(activeOrgId);
    const lines = raw.filter((l) => !isLegacyLine(l));
    const res = NextResponse.json({ lines, source: "stations" });
    applySupabaseCookies(res, pendingCookies);
    return res;
  } catch (error) {
    console.error("GET /api/tomorrows-gaps/lines failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal error" },
      { status: 500 }
    );
  }
}
