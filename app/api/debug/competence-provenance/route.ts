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
    if (!activeOrgId) {
      const res = NextResponse.json({ error: "No active organization" }, { status: 403 });
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const smokeTest = {
      line: "Bearbetning",
      employee_number: "0001",
      expected: {
        stations_required: 23,
        stations_passed: 23,
        eligible: true,
      },
      actual: null as null | {
        stations_required: number;
        stations_passed: number;
        eligible: boolean;
      },
      pass: false,
      error: null as null | string,
    };
    try {
      const smokeRes = await pool.query(
        `WITH requirements AS (
           SELECT r.skill_id, r.required_level
           FROM public.station_skill_requirements r
           JOIN public.stations s ON s.id = r.station_id AND s.org_id = r.org_id
           WHERE r.org_id = $1
             AND s.org_id = $1
             AND s.line = $2
         ),
         target_employee AS (
           SELECT id
           FROM public.employees
           WHERE org_id = $1
             AND employee_number = $3
           LIMIT 1
         ),
         matched AS (
           SELECT 1
           FROM requirements req
           JOIN public.employee_skills es ON es.skill_id = req.skill_id
           JOIN target_employee te ON te.id = es.employee_id
           WHERE es.level >= req.required_level
         )
         SELECT
           (SELECT COUNT(*) FROM requirements)::int AS stations_required,
           (SELECT COUNT(*) FROM matched)::int AS stations_passed`,
        [activeOrgId, smokeTest.line, smokeTest.employee_number]
      );
      const stationsRequired = smokeRes.rows[0]?.stations_required ?? 0;
      const stationsPassed = smokeRes.rows[0]?.stations_passed ?? 0;
      smokeTest.actual = {
        stations_required: stationsRequired,
        stations_passed: stationsPassed,
        eligible: stationsRequired > 0 && stationsRequired === stationsPassed,
      };
      smokeTest.pass =
        smokeTest.actual.eligible === smokeTest.expected.eligible &&
        smokeTest.actual.stations_required === smokeTest.expected.stations_required &&
        smokeTest.actual.stations_passed === smokeTest.expected.stations_passed;
    } catch (error) {
      smokeTest.error = error instanceof Error ? error.message : "Smoke test failed";
    }

    const employeeCountRes = await pool.query(
      "SELECT COUNT(*)::int AS count FROM public.employees WHERE org_id = $1 AND is_active = true",
      [activeOrgId]
    );

    const topSkillsRes = await pool.query(
      `SELECT s.code, COUNT(*)::int AS count
       FROM public.employee_skills es
       JOIN public.employees e ON e.id = es.employee_id AND e.is_active = true
       JOIN public.skills s ON s.id = es.skill_id AND s.org_id = e.org_id
       WHERE e.org_id = $1
       GROUP BY s.code
       ORDER BY count DESC, s.code ASC
       LIMIT 50`,
      [activeOrgId]
    );

    const demoCountsRes = await pool.query(
      `SELECT s.code, COUNT(*)::int AS count
       FROM public.employee_skills es
       JOIN public.employees e ON e.id = es.employee_id
       JOIN public.skills s ON s.id = es.skill_id AND s.org_id = e.org_id
       WHERE e.org_id = $1
         AND s.code = ANY($2::text[])
       GROUP BY s.code`,
      [activeOrgId, DEMO_CODES]
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
      org_id_used: activeOrgId,
      employee_count: employeeCountRes.rows[0]?.count ?? 0,
      top_skill_codes: topSkillsRes.rows,
      demo_code_counts: demoCounts,
      eligibility_smoke_test: smokeTest,
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
