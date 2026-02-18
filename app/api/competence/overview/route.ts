/**
 * GET /api/competence/overview — Competence Matrix 2.0 Executive Board.
 * station_skill_requirements uses skill_id (uuid); join skills for code/name.
 * employee_skill_ratings uses skill_code (matches skills.code). Mandatory: is_mandatory=true OR requirement_type='MANDATORY'.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseServerClient, applySupabaseCookies } from "@/lib/supabase/server";
import { getActiveOrgFromSession } from "@/lib/server/activeOrg";
import { getActiveSiteName } from "@/lib/server/siteName";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function errorPayload(step: string, error: unknown) {
  const msg = error instanceof Error ? error.message : String(error);
  return { ok: false as const, step, error: msg };
}

type Row = {
  employee_id: string;
  employee_no: string;
  name: string;
  line: string | null;
  missing_count: number;
  below_required_count: number;
  status: "CRITICAL" | "RISK" | "OK";
};

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

  const orgId = org.activeOrgId;
  const siteId = org.activeSiteId ?? null;
  const { searchParams } = new URL(request.url);
  const lineParam = searchParams.get("line")?.trim() || "all";
  const q = searchParams.get("q")?.trim() || "";
  const criticalOnly = searchParams.get("critical") === "1";

  try {
    const siteName = siteId ? await getActiveSiteName(supabaseAdmin, siteId, orgId) : null;

    const empQuery = supabaseAdmin
      .from("employees")
      .select("id, name, first_name, last_name, employee_number, line, line_code, site_id")
      .eq("org_id", orgId)
      .eq("is_active", true)
      .order("name");
    if (siteId) empQuery.eq("site_id", siteId);
    const { data: employees, error: empErr } = await empQuery;

    if (empErr) {
      console.error("competence/overview employees", empErr);
      const res = NextResponse.json(errorPayload("employees", empErr.message), { status: 500 });
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const empList = (employees ?? []) as Array<{
      id: string;
      name: string | null;
      first_name: string | null;
      last_name: string | null;
      employee_number: string | null;
      line: string | null;
      line_code?: string | null;
      site_id?: string | null;
    }>;

    if (empList.length === 0) {
      const res = NextResponse.json({
        ok: true,
        site: siteId ? { id: siteId, name: siteName ?? "Unknown" } : null,
        kpis: { critical_gaps: 0, at_risk: 0, coverage_percent: 100, top_missing_skills: [] },
        rows: [],
      });
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const reqQuery = supabaseAdmin
      .from("station_skill_requirements")
      .select("station_id, skill_id, required_level, is_mandatory, requirement_type")
      .eq("org_id", orgId);
    if (siteId) reqQuery.eq("site_id", siteId);
    const { data: reqRows, error: reqErr } = await reqQuery;

    if (reqErr) {
      console.error("competence/overview station_skill_requirements", reqErr);
      const res = NextResponse.json(errorPayload("requirements", reqErr.message), { status: 500 });
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    type ReqRow = { station_id: string; skill_id: string; required_level: number; is_mandatory?: boolean; requirement_type?: string | null };
    const reqRaw = (reqRows ?? []) as ReqRow[];
    const mandatoryReq = reqRaw.filter(
      (r) => r.is_mandatory === true || (r.requirement_type ?? "").toUpperCase() === "MANDATORY"
    );
    const reqList = mandatoryReq.map((r) => ({
      station_id: r.station_id,
      skill_id: r.skill_id,
      required_level: r.required_level,
    }));
    const stationIds = [...new Set(reqList.map((r) => r.station_id))];
    const skillIds = [...new Set(reqList.map((r) => r.skill_id))];

    const lineToStationIds = new Map<string, string[]>();
    if (stationIds.length > 0) {
      const { data: stations } = await supabaseAdmin
        .from("stations")
        .select("id, line")
        .eq("org_id", orgId)
        .in("id", stationIds);
      for (const s of stations ?? []) {
        const st = s as { id: string; line: string | null };
        const line = (st.line ?? "").trim();
        if (!lineToStationIds.has(line)) lineToStationIds.set(line, []);
        lineToStationIds.get(line)!.push(st.id);
      }
    }

    const skillNameMap = new Map<string, string>();
    const skillIdToCode = new Map<string, string>();
    if (skillIds.length > 0) {
      const { data: skillsData } = await supabaseAdmin
        .from("skills")
        .select("id, code, name")
        .eq("org_id", orgId)
        .in("id", skillIds);
      for (const s of skillsData ?? []) {
        const row = s as { id: string; code: string | null; name: string };
        if (row.code) {
          skillIdToCode.set(row.id, row.code);
          skillNameMap.set(row.code, row.name ?? row.code);
        }
      }
    }

    const employeeNumbers = empList.map((e) => (e.employee_number ?? "").trim()).filter(Boolean);
    let ratingRows: Array<{ employee_anst_id: string; skill_code: string; level: number }> = [];
    const effectiveSiteId = siteId ?? undefined;
    if (stationIds.length > 0 && employeeNumbers.length > 0) {
      const ratingQuery = supabaseAdmin
        .from("employee_skill_ratings")
        .select("employee_anst_id, skill_code, level, valid_to, site_id")
        .eq("org_id", orgId)
        .in("station_id", stationIds)
        .in("employee_anst_id", employeeNumbers);
      if (effectiveSiteId) ratingQuery.eq("site_id", effectiveSiteId);
      const { data: ratings } = await ratingQuery;
      const todayStr = new Date().toISOString().slice(0, 10);
      for (const r of ratings ?? []) {
        const row = r as { employee_anst_id: string; skill_code: string; level: number; valid_to: string | null };
        if (row.valid_to && row.valid_to < todayStr) continue;
        ratingRows.push({
          employee_anst_id: row.employee_anst_id,
          skill_code: row.skill_code,
          level: row.level ?? 0,
        });
      }
    }

    const ratingMap = new Map<string, number>();
    for (const r of ratingRows) {
      const key = `${r.employee_anst_id}:${r.skill_code}`;
      const cur = ratingMap.get(key);
      if (cur == null || r.level > cur) ratingMap.set(key, r.level);
    }

    const missingCountBySkill = new Map<string, number>();

    const rows: Row[] = [];
    for (const emp of empList) {
      const empName = emp.name ?? [emp.first_name, emp.last_name].filter(Boolean).join(" ") ?? "";
      const empNo = (emp.employee_number ?? "").trim();
      const line = (emp.line_code ?? emp.line ?? "").trim() || null;
      const stationIdsForLine = line ? lineToStationIds.get(line) ?? [] : [];
      const reqsForLine = reqList.filter((r) => stationIdsForLine.includes(r.station_id));
      const reqBySkillId = new Map<string, number>();
      for (const r of reqsForLine) {
        const cur = reqBySkillId.get(r.skill_id);
        if (cur == null || r.required_level > cur) reqBySkillId.set(r.skill_id, r.required_level);
      }

      let missing_count = 0;
      let below_required_count = 0;
      for (const [skill_id, required_level] of reqBySkillId) {
        const skill_code = skillIdToCode.get(skill_id);
        const current_level = skill_code != null ? (ratingMap.get(`${empNo}:${skill_code}`) ?? 0) : 0;
        if (current_level === 0) {
          missing_count++;
          if (skill_code) missingCountBySkill.set(skill_code, (missingCountBySkill.get(skill_code) ?? 0) + 1);
        } else if (current_level < required_level) {
          below_required_count++;
        }
      }

      const status: Row["status"] =
        missing_count > 0 ? "CRITICAL" : below_required_count > 0 ? "RISK" : "OK";

      rows.push({
        employee_id: emp.id,
        employee_no: empNo || "",
        name: empName || empNo || emp.id,
        line: line || null,
        missing_count,
        below_required_count,
        status,
      });
    }

    let filtered = rows;
    if (lineParam !== "all") {
      filtered = filtered.filter((r) => r.line === lineParam);
    }
    if (q) {
      const qLower = q.toLowerCase();
      filtered = filtered.filter(
        (r) =>
          r.name.toLowerCase().includes(qLower) ||
          (r.employee_no && r.employee_no.toLowerCase().includes(qLower))
      );
    }
    if (criticalOnly) {
      filtered = filtered.filter((r) => r.status === "CRITICAL");
    }

    filtered.sort((a, b) => {
      const order = { CRITICAL: 0, RISK: 1, OK: 2 };
      if (order[a.status] !== order[b.status]) return order[a.status] - order[b.status];
      const aGap = a.missing_count + a.below_required_count;
      const bGap = b.missing_count + b.below_required_count;
      if (bGap !== aGap) return bGap - aGap;
      return a.name.localeCompare(b.name);
    });

    const critical = rows.filter((r) => r.status === "CRITICAL").length;
    const atRisk = rows.filter((r) => r.status === "RISK").length;
    const ok = rows.filter((r) => r.status === "OK").length;
    const total = rows.length;
    const coverage_percent = total > 0 ? Math.round((ok / total) * 100) : 100;

    const top_missing_skills = [...missingCountBySkill.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([skill_code, count]) => ({
        skill_code,
        skill_name: skillNameMap.get(skill_code) ?? skill_code,
        count,
      }));

    const res = NextResponse.json({
      ok: true,
      site: siteId ? { id: siteId, name: siteName ?? "Unknown" } : null,
      kpis: {
        critical_gaps: critical,
        at_risk: atRisk,
        coverage_percent,
        top_missing_skills,
      },
      rows: filtered,
    });
    applySupabaseCookies(res, pendingCookies);
    return res;
  } catch (err) {
    console.error("GET /api/competence/overview failed:", err);
    const res = NextResponse.json(errorPayload("unexpected", err), { status: 500 });
    applySupabaseCookies(res, pendingCookies);
    return res;
  }
}
