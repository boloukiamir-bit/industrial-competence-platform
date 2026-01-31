import { NextRequest, NextResponse } from "next/server";
import { getActiveOrgFromSession } from "@/lib/server/activeOrg";
import { createSupabaseServerClient, applySupabaseCookies } from "@/lib/supabase/server";

/**
 * GET /api/skills
 * Returns skills catalog for the session's active_org_id only (tenant-scoped).
 * No demo or hardcoded skills; reads only from public.skills.
 */
export async function GET(request: NextRequest) {
  try {
    const { supabase, pendingCookies } = await createSupabaseServerClient();
    const org = await getActiveOrgFromSession(request, supabase);
    if (!org.ok) {
      const res = NextResponse.json({ error: org.error }, { status: org.status });
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const { data: skills, error: skillsError } = await supabase
      .from("skills")
      .select("id, code, name, category")
      .eq("org_id", org.activeOrgId)
      .order("category")
      .order("code");

    if (skillsError) {
      throw skillsError;
    }

    const res = NextResponse.json({ skills: skills ?? [] });
    applySupabaseCookies(res, pendingCookies);
    return res;
  } catch (err) {
    console.error("GET /api/skills failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch skills" },
      { status: 500 }
    );
  }
}
