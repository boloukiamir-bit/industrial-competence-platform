/**
 * GET /api/debug/station-employee-skills
 * Dev-only. Returns required_skill_ids count, employee_skill_ids count, intersection count
 * for a given station and employee. Uses public.employee_skills as single source of truth;
 * scope by employees.org_id.
 *
 * Query: machineCode (stations.code) or stationId, employeeId or employeeCode (employees.employee_number).
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseServerClient, applySupabaseCookies } from "@/lib/supabase/server";
import { getActiveOrgFromSession } from "@/lib/server/activeOrg";

export const runtime = "nodejs";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

export async function GET(request: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not available" }, { status: 404 });
  }

  try {
    const { supabase, pendingCookies } = await createSupabaseServerClient();
    const org = await getActiveOrgFromSession(request, supabase);
    if (!org.ok) {
      const res = NextResponse.json({ error: org.error }, { status: org.status });
      applySupabaseCookies(res, pendingCookies);
      return res;
    }
    const activeOrgId = org.activeOrgId;

    const { searchParams } = new URL(request.url);
    const machineCode = searchParams.get("machineCode");
    const stationIdParam = searchParams.get("stationId");
    const employeeIdParam = searchParams.get("employeeId");
    const employeeCode = searchParams.get("employeeCode");

    if ((!machineCode && !stationIdParam) || (!employeeIdParam && !employeeCode)) {
      const res = NextResponse.json(
        { error: "Provide (machineCode or stationId) and (employeeId or employeeCode)" },
        { status: 400 }
      );
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    let stationId: string | null = null;
    if (stationIdParam) {
      const { data: st } = await supabaseAdmin
        .from("stations")
        .select("id")
        .eq("org_id", activeOrgId)
        .eq("id", stationIdParam)
        .maybeSingle();
      stationId = (st as { id?: string } | null)?.id ?? null;
    } else if (machineCode) {
      const { data: st } = await supabaseAdmin
        .from("stations")
        .select("id")
        .eq("org_id", activeOrgId)
        .eq("is_active", true)
        .eq("code", machineCode)
        .maybeSingle();
      stationId = (st as { id?: string } | null)?.id ?? null;
    }

    if (!stationId) {
      const res = NextResponse.json(
        { error: "Station not found", machineCode: machineCode ?? undefined, stationId: stationIdParam ?? undefined },
        { status: 404 }
      );
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    let employeeId: string | null = null;
    if (employeeIdParam) {
      const { data: emp } = await supabaseAdmin
        .from("employees")
        .select("id")
        .eq("org_id", activeOrgId)
        .eq("id", employeeIdParam)
        .maybeSingle();
      employeeId = (emp as { id?: string } | null)?.id ?? null;
    } else if (employeeCode) {
      const { data: emp } = await supabaseAdmin
        .from("employees")
        .select("id")
        .eq("org_id", activeOrgId)
        .eq("employee_number", employeeCode)
        .maybeSingle();
      employeeId = (emp as { id?: string } | null)?.id ?? null;
    }

    if (!employeeId) {
      const res = NextResponse.json(
        { error: "Employee not found", employeeId: employeeIdParam ?? undefined, employeeCode: employeeCode ?? undefined },
        { status: 404 }
      );
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    // Required skill_ids for station (station_skill_requirements.skill_id -> skills.id); tenant-safe via station org
    const { data: reqRows, error: reqErr } = await supabaseAdmin
      .from("station_skill_requirements")
      .select("skill_id")
      .eq("station_id", stationId)
      .eq("org_id", activeOrgId);

    if (reqErr) {
      const res = NextResponse.json({ error: "Failed to load requirements", details: reqErr.message }, { status: 500 });
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const requiredSkillIds = Array.from(
      new Set((reqRows || []).map((r: { skill_id?: string }) => r.skill_id).filter(Boolean))
    ) as string[];

    // Optional: restrict to skills that belong to org (same skills.id as used by station_skill_requirements)
    let orgScopedRequired: string[] = requiredSkillIds;
    if (requiredSkillIds.length > 0) {
      const { data: orgSkills } = await supabaseAdmin
        .from("skills")
        .select("id")
        .eq("org_id", activeOrgId)
        .in("id", requiredSkillIds);
      orgScopedRequired = (orgSkills || []).map((s: { id: string }) => s.id);
    }

    // Employee skills: public.employee_skills, scope via employees.org_id (employee already resolved in this org)
    const { data: esRows, error: esErr } = await supabaseAdmin
      .from("employee_skills")
      .select("skill_id")
      .eq("employee_id", employeeId);

    if (esErr) {
      const res = NextResponse.json({ error: "Failed to load employee skills", details: esErr.message }, { status: 500 });
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const employeeSkillIds = Array.from(
      new Set((esRows || []).map((r: { skill_id?: string }) => r.skill_id).filter(Boolean))
    ) as string[];

    const requiredSet = new Set(orgScopedRequired);
    const employeeSet = new Set(employeeSkillIds);
    const intersection = orgScopedRequired.filter((id) => employeeSet.has(id));

    const payload = {
      stationId,
      employeeId,
      required_skill_ids_count: orgScopedRequired.length,
      employee_skill_ids_count: employeeSkillIds.length,
      intersection_count: intersection.length,
      required_skill_ids: orgScopedRequired,
      employee_skill_ids: employeeSkillIds,
      intersection_skill_ids: intersection,
    };

    const res = NextResponse.json(payload);
    applySupabaseCookies(res, pendingCookies);
    return res;
  } catch (error) {
    console.error("GET /api/debug/station-employee-skills failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal error" },
      { status: 500 }
    );
  }
}
