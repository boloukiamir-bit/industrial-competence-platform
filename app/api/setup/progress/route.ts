/**
 * GET /api/setup/progress — tenant-scoped by session (active_org_id) only.
 * Returns setup progress for the session org.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getActiveOrgFromSession } from "@/lib/server/activeOrg";
import { createSupabaseServerClient, applySupabaseCookies } from "@/lib/supabase/server";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  try {
    const { supabase, pendingCookies } = await createSupabaseServerClient();
    const org = await getActiveOrgFromSession(request, supabase);
    if (!org.ok) {
      const res = NextResponse.json(
        { hasActiveOrg: false, progress: { orgUnit: false, employees: false, skills: false, positions: false, gaps: false } },
        { status: 200 }
      );
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const [
      orgUnitsRes,
      employeesRes,
      skillsRes,
      positionsRes,
    ] = await Promise.all([
      supabaseAdmin.from("org_units").select("id", { count: "exact", head: true }).eq("org_id", org.activeOrgId),
      supabaseAdmin.from("employees").select("id", { count: "exact", head: true }).eq("org_id", org.activeOrgId).eq("is_active", true),
      supabaseAdmin.from("skills").select("id", { count: "exact", head: true }).eq("org_id", org.activeOrgId),
      supabaseAdmin.from("positions").select("id", { count: "exact", head: true }).eq("org_id", org.activeOrgId),
    ]);

    let hasRequirements = false;
    if ((positionsRes.count ?? 0) > 0) {
      const { data: sample } = await supabaseAdmin
        .from("positions")
        .select("id")
        .eq("org_id", org.activeOrgId)
        .limit(1)
        .maybeSingle();
      if (sample) {
        const { count: reqCount } = await supabaseAdmin
          .from("position_competence_requirements")
          .select("id", { count: "exact", head: true })
          .eq("position_id", sample.id);
        hasRequirements = (reqCount ?? 0) > 0;
      }
    }

    const progress = {
      orgUnit: (orgUnitsRes.count ?? 0) > 0,
      employees: (employeesRes.count ?? 0) > 0,
      skills: (skillsRes.count ?? 0) > 0,
      positions: (positionsRes.count ?? 0) > 0 || hasRequirements,
      gaps: false,
    };

    const res = NextResponse.json({ hasActiveOrg: true, progress });
    applySupabaseCookies(res, pendingCookies);
    return res;
  } catch (err) {
    console.error("[api/setup/progress]", err);
    return NextResponse.json(
      { hasActiveOrg: false, progress: { orgUnit: false, employees: false, skills: false, positions: false, gaps: false } },
      { status: 500 }
    );
  }
}
