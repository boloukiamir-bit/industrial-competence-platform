/**
 * GET /api/employees/[id]/competence — employee competence profile.
 * Canonical: public.skills + public.employee_skills + public.station_skill_requirements.
 * Same logic as cockpit/line-overview. Tenant: org_id from session.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getActiveOrgFromSession } from "@/lib/server/activeOrg";
import { createSupabaseServerClient, applySupabaseCookies } from "@/lib/supabase/server";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type ProfileItem = {
  competenceId: string;
  competenceName: string;
  competenceCode: string | null;
  groupName: string | null;
  requiredLevel: number | null;
  mandatory: boolean;
  employeeLevel: number | null;
  validTo: string | null;
  status: "OK" | "GAP" | "RISK" | "N/A";
  riskReason: string | null;
  isSafetyCritical: boolean;
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: "Employee id required" }, { status: 400 });
    }

    const { supabase, pendingCookies } = await createSupabaseServerClient();
    const org = await getActiveOrgFromSession(request, supabase);
    if (!org.ok) {
      const res = NextResponse.json({ error: org.error }, { status: org.status });
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const profile = await buildProfile(supabaseAdmin, org.activeOrgId, id);
    if (!profile) {
      const res = NextResponse.json({ error: "Employee not found" }, { status: 404 });
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const res = NextResponse.json(profile);
    applySupabaseCookies(res, pendingCookies);
    return res;
  } catch (err) {
    console.error("[api/employees/[id]/competence] GET", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

async function buildProfile(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  orgId: string,
  employeeId: string
) {
  const effectiveDateStr = new Date().toISOString().slice(0, 10);

  const { data: empRow, error: empErr } = await supabase
    .from("employees")
    .select("id, name, position_id, line, line_code")
    .eq("id", employeeId)
    .eq("org_id", orgId)
    .single();

  if (empErr || !empRow) return null;

  let positionName: string | null = null;
  const positionId = empRow.position_id ?? null;
  if (positionId) {
    const { data: pos } = await supabase
      .from("positions")
      .select("name")
      .eq("id", positionId)
      .eq("org_id", orgId)
      .single();
    positionName = pos?.name ?? null;
  }

  const reqMap = new Map<string, number>();
  const lineCode = (empRow as { line_code?: string }).line_code ?? empRow.line ?? "";
  if (lineCode) {
    const { data: stationIds } = await supabase
      .from("stations")
      .select("id")
      .eq("org_id", orgId)
      .eq("line", lineCode)
      .eq("is_active", true);
    const ids = ((stationIds ?? []) as { id: string }[]).map((s) => s.id);
    if (ids.length > 0) {
      const { data: reqRows } = await supabase
        .from("station_skill_requirements")
        .select("skill_id, required_level")
        .eq("org_id", orgId)
        .in("station_id", ids);
      for (const r of reqRows ?? []) {
        const row = r as { skill_id: string; required_level: number };
        const cur = reqMap.get(row.skill_id);
        const lvl = typeof row.required_level === "number" ? row.required_level : 1;
        if (cur == null || lvl > cur) reqMap.set(row.skill_id, lvl);
      }
    }
  }

  const { data: skills } = await supabase
    .from("skills")
    .select("id, code, name, category")
    .eq("org_id", orgId)
    .order("category")
    .order("code");

  const skillRows = (skills ?? []) as { id: string; code: string | null; name: string; category: string | null }[];

  const { data: empSkills } = await supabase
    .from("employee_skills")
    .select("skill_id, level, valid_to")
    .eq("employee_id", employeeId);

  const empSkillMap = new Map<string, { level: number; valid_to: string | null }>();
  for (const r of empSkills ?? []) {
    const row = r as { skill_id: string; level: number; valid_to: string | null };
    empSkillMap.set(row.skill_id, { level: row.level, valid_to: row.valid_to ?? null });
  }

  function isExpired(validTo: string | null) {
    return validTo != null && validTo < effectiveDateStr;
  }

  const items: ProfileItem[] = [];
  let totalRequired = 0;
  let gapCount = 0;
  let expiredCount = 0;

  for (const sk of skillRows) {
    const requiredLevel = reqMap.get(sk.id) ?? null;
    const mandatory = requiredLevel != null && requiredLevel > 0;
    const ec = empSkillMap.get(sk.id);
    const empLevel = ec?.level ?? null;
    const validTo = ec?.valid_to ?? null;

    let status: ProfileItem["status"] = "N/A";
    let riskReason: string | null = null;

    if (mandatory && requiredLevel != null) {
      totalRequired += 1;
      if (!ec) {
        status = "RISK";
        riskReason = "Missing competence";
        gapCount += 1;
      } else if (isExpired(validTo)) {
        status = "RISK";
        riskReason = "Expired";
        gapCount += 1;
        expiredCount += 1;
      } else if (empLevel != null && empLevel < requiredLevel) {
        gapCount += 1;
        status = empLevel >= requiredLevel - 1 ? "GAP" : "RISK";
        riskReason = "Level below required";
      } else {
        status = "OK";
      }
    } else {
      status = ec ? "OK" : "N/A";
      if (ec && isExpired(validTo)) {
        status = "RISK";
        riskReason = "Expired";
        expiredCount += 1;
      }
    }

    items.push({
      competenceId: sk.id,
      competenceName: sk.name,
      competenceCode: sk.code ?? null,
      groupName: sk.category ?? null,
      requiredLevel,
      mandatory: mandatory ?? false,
      employeeLevel: empLevel,
      validTo,
      status,
      riskReason,
      isSafetyCritical: false,
    });
  }

  items.sort((a, b) => {
    const g1 = a.groupName ?? "";
    const g2 = b.groupName ?? "";
    if (g1 !== g2) return g1.localeCompare(g2);
    return a.competenceName.localeCompare(b.competenceName);
  });

  const coveragePercent =
    totalRequired === 0 ? 100 : Math.round(((totalRequired - gapCount) / totalRequired) * 100);
  let riskLevel: "LOW" | "MEDIUM" | "HIGH" = "LOW";
  if (gapCount > 2) riskLevel = "HIGH";
  else if (gapCount > 0) riskLevel = "MEDIUM";

  const { data: positions } = await supabase
    .from("positions")
    .select("id, name")
    .eq("org_id", orgId)
    .order("name");

  return {
    employee: { id: empRow.id, name: empRow.name ?? "Employee", positionName, positionId },
    summary: { riskLevel, gapCount, totalRequired, coveragePercent, expiredCount },
    items,
    positions: ((positions ?? []) as { id: string; name: string }[]).map((p) => ({ id: p.id, name: p.name })),
  };
}
