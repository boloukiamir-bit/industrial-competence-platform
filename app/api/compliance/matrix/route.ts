/**
 * GET /api/compliance/matrix — Per-employee per–compliance-item matrix for HR.
 * Tenant: activeOrgId + optional siteId (query). Params: category, line, q, asOf, expiringDays, actionOnly.
 * Status: waived | missing | overdue | expiring | valid (consistent with spec).
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseServerClient, applySupabaseCookies } from "@/lib/supabase/server";
import { getActiveOrgFromSession } from "@/lib/server/activeOrg";
import { getActiveSiteName } from "@/lib/server/siteName";
import { normalizeProfileActiveSiteIfStale } from "@/lib/server/validateActiveSite";
import { getActiveLines } from "@/lib/server/getActiveLines";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function errorPayload(step: string, error: unknown, details?: string) {
  const msg = error instanceof Error ? error.message : String(error);
  return { ok: false as const, step, error: msg, ...(details != null && { details }) };
}

export type MatrixCellStatus = "waived" | "missing" | "overdue" | "expiring" | "valid";

function computeStatus(
  validTo: string | null,
  waived: boolean,
  asOf: Date,
  expiringDays: number
): MatrixCellStatus {
  if (waived) return "waived";
  if (!validTo) return "missing";
  const to = new Date(validTo);
  to.setHours(0, 0, 0, 0);
  const asOfNorm = new Date(asOf);
  asOfNorm.setHours(0, 0, 0, 0);
  const expiringEnd = new Date(asOfNorm);
  expiringEnd.setDate(expiringEnd.getDate() + expiringDays);
  if (to < asOfNorm) return "overdue";
  if (to <= expiringEnd) return "expiring";
  return "valid";
}

function daysLeft(validTo: string | null, asOf: Date): number | null {
  if (!validTo) return null;
  const to = new Date(validTo);
  to.setHours(0, 0, 0, 0);
  const a = new Date(asOf);
  a.setHours(0, 0, 0, 0);
  return Math.ceil((to.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
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

  const { searchParams } = new URL(request.url);
  const siteId = searchParams.get("siteId")?.trim() || null;
  const categoryParam = searchParams.get("category")?.trim() || "all";
  const category = categoryParam === "all" ? null : categoryParam;
  const line = searchParams.get("line")?.trim() || null;
  const q = searchParams.get("q")?.trim() || null;
  const asOfParam = searchParams.get("asOf")?.trim() || null;
  const expiringDaysParam = searchParams.get("expiringDays");
  const expiringDays = expiringDaysParam != null ? parseInt(expiringDaysParam, 10) : 30;
  const expiringDaysSafe = Number.isFinite(expiringDays) && expiringDays >= 0 ? expiringDays : 30;
  const actionOnly = searchParams.get("actionOnly") === "1";

  const asOf = asOfParam
    ? (() => {
        const d = new Date(asOfParam);
        return isNaN(d.getTime()) ? new Date() : d;
      })()
    : new Date();

  try {
    const orgId = org.activeOrgId;
    const activeSiteIdRaw = org.activeSiteId ?? null;
    const activeSiteNameRaw =
      activeSiteIdRaw != null ? await getActiveSiteName(supabaseAdmin, activeSiteIdRaw, orgId) : null;
    const { activeSiteId, activeSiteName } = await normalizeProfileActiveSiteIfStale(
      supabaseAdmin,
      org.userId,
      activeSiteIdRaw,
      activeSiteNameRaw
    );
    const effectiveSiteId = siteId || activeSiteId;

    const linesList = await getActiveLines(orgId);

    const employeesQuery = supabaseAdmin
      .from("employees")
      .select("id, name, first_name, last_name, employee_number, line, line_code, team, site_id")
      .eq("org_id", orgId)
      .eq("is_active", true);
    if (effectiveSiteId) employeesQuery.eq("site_id", effectiveSiteId);
    if (line) employeesQuery.eq("line_code", line);
    const { data: employees, error: empErr } = await employeesQuery.order("name");

    if (empErr) {
      console.error("compliance/matrix employees", empErr);
      const res = NextResponse.json(errorPayload("employees", empErr.message), { status: 500 });
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const catalogQuery = supabaseAdmin
      .from("compliance_catalog")
      .select("id, category, code, name")
      .eq("org_id", orgId)
      .eq("is_active", true);
    if (category) catalogQuery.eq("category", category);
    const { data: catalog, error: catErr } = await catalogQuery.order("category").order("code");

    if (catErr) {
      console.error("compliance/matrix catalog", catErr);
      const res = NextResponse.json(errorPayload("catalog", catErr.message), { status: 500 });
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const { data: assigned, error: assErr } = await supabaseAdmin
      .from("employee_compliance")
      .select("employee_id, compliance_id, valid_to, waived, notes, evidence_url")
      .eq("org_id", orgId);

    if (assErr) {
      console.error("compliance/matrix assigned", assErr);
      const res = NextResponse.json(errorPayload("assigned", assErr.message), { status: 500 });
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const catalogList = catalog ?? [];
    const empList = employees ?? [];
    const assignedMap = new Map<
      string,
      { valid_to: string | null; waived: boolean; notes: string | null; evidence_url: string | null }
    >();
    for (const a of assigned ?? []) {
      assignedMap.set(`${a.employee_id}:${a.compliance_id}`, {
        valid_to: a.valid_to ?? null,
        waived: a.waived ?? false,
        notes: a.notes ?? null,
        evidence_url: a.evidence_url ?? null,
      });
    }

    const searchLower = q ? q.toLowerCase() : "";
    const employeesOut: Array<{
      id: string;
      name: string;
      employee_number: string;
      line: string | null;
      line_code: string | null;
    }> = [];
    const cellsOut: Array<{
      employee_id: string;
      compliance_id: string;
      status: MatrixCellStatus;
      valid_to: string | null;
      days_left: number | null;
      notes: string | null;
      evidence_url: string | null;
    }> = [];

    const employeesNeedingAction = new Set<string>();

    for (const emp of empList) {
      const empName =
        emp.name ?? [emp.first_name, emp.last_name].filter(Boolean).join(" ") ?? "";
      const empCode = emp.employee_number ?? "";
      if (
        searchLower &&
        !empName.toLowerCase().includes(searchLower) &&
        !empCode.toLowerCase().includes(searchLower)
      )
        continue;

      let hasAction = false;
      for (const c of catalogList) {
        const key = `${emp.id}:${c.id}`;
        const a = assignedMap.get(key);
        const validTo = a?.valid_to ?? null;
        const waived = a?.waived ?? false;
        const status = a
          ? computeStatus(validTo, waived, asOf, expiringDaysSafe)
          : "missing";
        const days = validTo ? daysLeft(validTo, asOf) : null;
        if (status === "missing" || status === "overdue") hasAction = true;

        cellsOut.push({
          employee_id: emp.id,
          compliance_id: c.id,
          status,
          valid_to: validTo,
          days_left: days,
          notes: a?.notes ?? null,
          evidence_url: a?.evidence_url ?? null,
        });
      }
      if (hasAction) employeesNeedingAction.add(emp.id);

      const includeEmployee = !actionOnly || employeesNeedingAction.has(emp.id);
      if (includeEmployee && !employeesOut.some((e) => e.id === emp.id)) {
        employeesOut.push({
          id: emp.id,
          name: empName || empCode || emp.id,
          employee_number: empCode,
          line: emp.line ?? null,
          line_code: emp.line_code ?? emp.line ?? null,
        });
      }
    }

    if (actionOnly) {
      const actionSet = employeesNeedingAction;
      const filtered = employeesOut.filter((e) => actionSet.has(e.id));
      const filteredIds = new Set(filtered.map((e) => e.id));
      const cellsFiltered = cellsOut.filter((c) => filteredIds.has(c.employee_id));
      const res = NextResponse.json({
        ok: true,
        employees: filtered,
        catalog: catalogList,
        cells: cellsFiltered,
        lines: linesList,
        source: "stations",
        activeSiteId,
        activeSiteName,
      });
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const res = NextResponse.json({
      ok: true,
      employees: employeesOut,
      catalog: catalogList,
      cells: cellsOut,
      lines: linesList,
      source: "stations",
      activeSiteId,
      activeSiteName,
    });
    applySupabaseCookies(res, pendingCookies);
    return res;
  } catch (err) {
    console.error("GET /api/compliance/matrix failed:", err);
    const res = NextResponse.json(errorPayload("unexpected", err), { status: 500 });
    applySupabaseCookies(res, pendingCookies);
    return res;
  }
}
