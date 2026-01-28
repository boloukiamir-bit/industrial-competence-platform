import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseServerClient, applySupabaseCookies } from "@/lib/supabase/server";
import { getOrgIdFromSession } from "@/lib/orgSession";
import { pool } from "@/lib/db/pool";

export const runtime = "nodejs";

const DEMO_CODES = ["PRESS_A", "PRESS_B", "5S", "SAFETY_BASIC", "TRUCK_A1"] as const;

export async function GET(request: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not available" }, { status: 404 });
  }

  try {
    const { supabase, pendingCookies } = await createSupabaseServerClient();
    const session = await getOrgIdFromSession(request, supabase);
    if (!session.success) {
      const res = NextResponse.json({ error: session.error }, { status: session.status });
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    );

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("active_org_id")
      .eq("id", session.userId)
      .maybeSingle();

    const activeOrgId = profile?.active_org_id || null;
    const orgId = activeOrgId ?? session.orgId;

    const employeeCountRes = await pool.query(
      "SELECT COUNT(*)::int AS count FROM employees WHERE org_id = $1",
      [orgId]
    );

    const topSkillsRes = await pool.query(
      `SELECT s.code, COUNT(*)::int AS count
       FROM employee_skills es
       JOIN employees e ON e.id = es.employee_id
       JOIN skills s ON s.id = es.skill_id
       WHERE e.org_id = $1
       GROUP BY s.code
       ORDER BY count DESC, s.code ASC
       LIMIT 50`,
      [orgId]
    );

    const demoCountsRes = await pool.query(
      `SELECT s.code, COUNT(*)::int AS count
       FROM employee_skills es
       JOIN employees e ON e.id = es.employee_id
       JOIN skills s ON s.id = es.skill_id
       WHERE e.org_id = $1
         AND s.code = ANY($2::text[])
       GROUP BY s.code`,
      [orgId, DEMO_CODES]
    );

    const demoCounts = DEMO_CODES.reduce<Record<string, number>>((acc, code) => {
      acc[code] = 0;
      return acc;
    }, {});
    for (const row of demoCountsRes.rows) {
      demoCounts[row.code] = row.count;
    }

    const res = NextResponse.json({
      active_org_id: activeOrgId,
      org_id_used: orgId,
      employee_count: employeeCountRes.rows[0]?.count ?? 0,
      top_skill_codes: topSkillsRes.rows,
      demo_code_counts: demoCounts,
    });
    applySupabaseCookies(res, pendingCookies);
    return res;
  } catch (error) {
    console.error("GET /api/debug/competence-provenance failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal error" },
      { status: 500 }
    );
  }
}
