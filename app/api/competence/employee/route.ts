/**
 * GET /api/competence/employee?employee_id=... — Mandatory requirements + activity for Competence Matrix 2.0 drawer.
 * station_skill_requirements uses skill_id; join skills for code/name. current_level from employee_skill_ratings (skill_code = skills.code).
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseServerClient, applySupabaseCookies } from "@/lib/supabase/server";
import { getActiveOrgFromSession } from "@/lib/server/activeOrg";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function errorPayload(step: string, error: unknown) {
  const msg = error instanceof Error ? error.message : String(error);
  return { ok: false as const, step, error: msg };
}

export async function GET(request: NextRequest) {
  const { supabase, pendingCookies } = await createSupabaseServerClient();
  const org = await getActiveOrgFromSession(request, supabase);
  if (!org.ok) {
    const res = NextResponse.json(errorPayload("getActiveOrg", org.error), { status: org.status });
    applySupabaseCookies(res, pendingCookies);
    return res;
  }

  const { data: membership } = await supabase
    .from("memberships")
    .select("role")
    .eq("user_id", org.userId)
    .eq("org_id", org.activeOrgId)
    .eq("status", "active")
    .maybeSingle();
  if (!membership) {
    const res = NextResponse.json(errorPayload("forbidden", "Not an org member"), { status: 403 });
    applySupabaseCookies(res, pendingCookies);
    return res;
  }

  const employee_id = request.nextUrl.searchParams.get("employee_id")?.trim();
  if (!employee_id) {
    const res = NextResponse.json(errorPayload("validation", "employee_id is required"), { status: 400 });
    applySupabaseCookies(res, pendingCookies);
    return res;
  }

  const orgId = org.activeOrgId;
  const siteId = org.activeSiteId ?? null;

  try {
    const { data: emp, error: empErr } = await supabaseAdmin
      .from("employees")
      .select("id, name, first_name, last_name, employee_number, line, line_code")
      .eq("id", employee_id)
      .eq("org_id", orgId)
      .single();

    if (empErr || !emp) {
      const res = NextResponse.json(errorPayload("employee", empErr?.message ?? "Not found"), { status: 404 });
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const empName = emp.name ?? [emp.first_name, emp.last_name].filter(Boolean).join(" ") ?? "";
    const employee = {
      id: emp.id,
      employee_no: (emp.employee_number ?? "").trim(),
      name: empName || emp.employee_number || emp.id,
      line: (emp.line_code ?? emp.line ?? "").trim() || null,
    };

    const line = (emp.line_code ?? emp.line ?? "").trim();
    let stationIds: string[] = [];
    if (line) {
      const { data: st } = await supabaseAdmin
        .from("stations")
        .select("id")
        .eq("org_id", orgId)
        .eq("line", line)
        .eq("is_active", true);
      stationIds = (st ?? []).map((s: { id: string }) => s.id);
    }

    type ReqRow = { skill_id: string; required_level: number; is_mandatory?: boolean; requirement_type?: string | null };
    const reqList: Array<{ skill_id: string; skill_code: string; skill_name: string; required_level: number }> = [];
    if (stationIds.length > 0) {
      const reqQuery = supabaseAdmin
        .from("station_skill_requirements")
        .select("skill_id, required_level, is_mandatory, requirement_type")
        .eq("org_id", orgId)
        .in("station_id", stationIds);
      if (siteId) reqQuery.eq("site_id", siteId);
      const { data: req } = await reqQuery;
      const raw = (req ?? []) as ReqRow[];
      const mandatoryRaw = raw.filter(
        (r) => r.is_mandatory === true || (r.requirement_type ?? "").toUpperCase() === "MANDATORY"
      );
      const bySkillId = new Map<string, number>();
      for (const r of mandatoryRaw) {
        const cur = bySkillId.get(r.skill_id);
        if (cur == null || r.required_level > cur) bySkillId.set(r.skill_id, r.required_level);
      }
      const skillIds = [...bySkillId.keys()];
      if (skillIds.length > 0) {
        const { data: skillsData } = await supabaseAdmin
          .from("skills")
          .select("id, code, name")
          .eq("org_id", orgId)
          .in("id", skillIds);
        for (const s of skillsData ?? []) {
          const row = s as { id: string; code: string | null; name: string };
          const required_level = bySkillId.get(row.id);
          if (required_level != null && row.code)
            reqList.push({
              skill_id: row.id,
              skill_code: row.code,
              skill_name: row.name ?? row.code,
              required_level,
            });
        }
      }
    }

    const empNo = employee.employee_no;
    const levelMap = new Map<string, number>();
    if (stationIds.length > 0 && empNo) {
      const ratingQuery = supabaseAdmin
        .from("employee_skill_ratings")
        .select("skill_code, level, valid_to")
        .eq("org_id", orgId)
        .in("station_id", stationIds)
        .eq("employee_anst_id", empNo);
      if (siteId) ratingQuery.eq("site_id", siteId);
      const { data: ratings } = await ratingQuery;
      const todayStr = new Date().toISOString().slice(0, 10);
      for (const r of ratings ?? []) {
        const row = r as { skill_code: string; level: number; valid_to: string | null };
        if (row.valid_to && row.valid_to < todayStr) continue;
        const cur = levelMap.get(row.skill_code);
        if (cur == null || row.level > cur) levelMap.set(row.skill_code, row.level ?? 0);
      }
    }

    const mandatory: Array<{
      skill_code: string;
      skill_name: string;
      required_level: number;
      current_level: number | null;
      status: "OK" | "RISK" | "CRITICAL";
    }> = [];
    for (const req of reqList) {
      const current_level = levelMap.get(req.skill_code) ?? null;
      const lvl = current_level ?? 0;
      let status: "OK" | "RISK" | "CRITICAL" = "OK";
      if (lvl === 0) status = "CRITICAL";
      else if (lvl < req.required_level) status = "RISK";
      mandatory.push({
        skill_code: req.skill_code,
        skill_name: req.skill_name,
        required_level: req.required_level,
        current_level: current_level ?? null,
        status,
      });
    }

    const { data: decisions } = await supabaseAdmin
      .from("execution_decisions")
      .select("id, created_at, root_cause, actions")
      .eq("org_id", orgId)
      .eq("decision_type", "competence_action")
      .order("created_at", { ascending: false })
      .limit(100);

    const activity: Array<{ id: string; created_at: string; action_type: string; payload: Record<string, unknown> }> = [];
    for (const d of decisions ?? []) {
      const row = d as {
        id: string;
        created_at: string;
        root_cause: { employee_id?: string } | null;
        actions: { action_type?: string; payload?: { employee_id?: string } } | null;
      };
      const rc = row.root_cause;
      const payloadEmpId = rc?.employee_id ?? (row.actions?.payload as { employee_id?: string } | undefined)?.employee_id;
      if (payloadEmpId !== employee_id) continue;
      const act = row.actions as { action_type?: string; payload?: Record<string, unknown> } | null;
      activity.push({
        id: row.id,
        created_at: row.created_at,
        action_type: act?.action_type ?? "log_decision",
        payload: act?.payload ?? {},
      });
    }
    activity.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    activity.splice(50);

    const res = NextResponse.json({
      ok: true,
      employee,
      mandatory,
      activity,
    });
    applySupabaseCookies(res, pendingCookies);
    return res;
  } catch (err) {
    console.error("GET /api/competence/employee failed:", err);
    const res = NextResponse.json(errorPayload("unexpected", err), { status: 500 });
    applySupabaseCookies(res, pendingCookies);
    return res;
  }
}
