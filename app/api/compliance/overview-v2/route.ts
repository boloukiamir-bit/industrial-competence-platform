/**
 * GET /api/compliance/overview-v2
 * Roster-scoped compliance overview (Legal Stoppers / Expiring / Healthy). Requires date + shift_code.
 * Same response shape as legacy /api/compliance/overview; employees and employee_compliance filtered by roster.
 * ?debug=1 adds _debug with roster_scoping, roster_employee_ids_count, catalog_count, employees_count, employee_compliance_rows_count.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseServerClient, applySupabaseCookies } from "@/lib/supabase/server";
import { getActiveOrgFromSession } from "@/lib/server/activeOrg";
import { normalizeShiftParam } from "@/lib/server/normalizeShift";
import { getRosterEmployeeIdsForShift } from "@/lib/server/getRosterEmployeeIdsForShift";
import { getActiveSiteName } from "@/lib/server/siteName";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function errorPayload(step: string, error: unknown, details?: string) {
  const msg = error instanceof Error ? error.message : String(error);
  return { ok: false as const, step, error: msg, ...(details != null && { details }) };
}

function computeStatus(validTo: string | null, waived: boolean): "valid" | "expiring" | "expired" | "missing" | "waived" {
  if (waived) return "waived";
  if (!validTo) return "missing";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const to = new Date(validTo);
  to.setHours(0, 0, 0, 0);
  const days30 = new Date(today);
  days30.setDate(days30.getDate() + 30);
  if (to < today) return "expired";
  if (to <= days30) return "expiring";
  return "valid";
}

function daysLeft(validTo: string | null): number | null {
  if (!validTo) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const to = new Date(validTo);
  to.setHours(0, 0, 0, 0);
  return Math.ceil((to.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const date = (url.searchParams.get("date") ?? "").trim();
  const shiftCodeParam = (url.searchParams.get("shift_code") ?? url.searchParams.get("shift") ?? "").trim();
  const wantDebug = url.searchParams.get("debug") === "1";
  const category = url.searchParams.get("category")?.trim() || null;
  const statusFilter = url.searchParams.get("status")?.trim() || null;
  const search = url.searchParams.get("search")?.trim() || null;

  if (!date || !shiftCodeParam) {
    return NextResponse.json(
      { ok: false, error: "SHIFT_CONTEXT_REQUIRED", message: "date and shift_code are required" },
      { status: 400 }
    );
  }

  const normalized = normalizeShiftParam(shiftCodeParam);
  if (!normalized) {
    return NextResponse.json(
      { ok: false, error: "Invalid shift parameter", message: "shift_code must be one of Day, Evening, Night, S1, S2, S3" },
      { status: 400 }
    );
  }

  const { supabase, pendingCookies } = await createSupabaseServerClient(request);
  const org = await getActiveOrgFromSession(request, supabase);
  if (!org.ok) {
    const res = NextResponse.json(errorPayload("getActiveOrg", org.error), { status: org.status });
    applySupabaseCookies(res, pendingCookies);
    return res;
  }

  const orgId = org.activeOrgId;
  const siteId = org.activeSiteId ?? null;

  try {
    const rosterEmployeeIds = await getRosterEmployeeIdsForShift(supabaseAdmin, {
      orgId,
      siteId,
      date,
      shift_code: normalized,
    });

    const emptyKpis = {
      legal_stoppers: { employees: 0, total_items: 0 },
      expiring_soon: { employees: 0, total_items: 0 },
      healthy: { employees: 0, total_items: 0 },
    };
    const emptyRows: Array<{
      employee_id: string;
      employee_name: string;
      employee_number: string;
      line: string | null;
      department: string | null;
      site_id: string | null;
      site_name: string;
      compliance_id: string;
      compliance_code: string;
      compliance_name: string;
      category: string;
      status: string;
      valid_to: string | null;
      days_left: number | null;
    }> = [];

    if (rosterEmployeeIds.length === 0) {
      const body: {
        ok: boolean;
        kpis: typeof emptyKpis;
        rows: typeof emptyRows;
        catalog: Array<{ id: string; category: string; code: string; name: string }>;
        activeSiteId: string | null;
        activeSiteName: string | null;
        _debug?: {
          source: string;
          scope_inputs: { org_id: string; site_id: string | null; date: string; shift_code: string; roster_scoping: boolean; roster_employee_ids_count: number };
          catalog_count: number;
          employees_count: number;
          employee_compliance_rows_count: number;
        };
      } = {
        ok: true,
        kpis: emptyKpis,
        rows: emptyRows,
        catalog: [],
        activeSiteId: siteId,
        activeSiteName: siteId ? (await getActiveSiteName(supabaseAdmin, siteId, orgId)) ?? null : null,
      };
      if (wantDebug) {
        body._debug = {
          source: "tables:employees,compliance_catalog,employee_compliance,compliance_requirement_applicability",
          scope_inputs: {
            org_id: orgId,
            site_id: siteId,
            date,
            shift_code: normalized,
            roster_scoping: true,
            roster_employee_ids_count: 0,
          },
          catalog_count: 0,
          employees_count: 0,
          employee_compliance_rows_count: 0,
        };
      }
      const res = NextResponse.json(body);
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const employeesQuery = supabaseAdmin
      .from("employees")
      .select("id, name, first_name, last_name, employee_number, line, team, site_id")
      .eq("org_id", orgId)
      .eq("is_active", true)
      .in("id", rosterEmployeeIds);
    const { data: employees, error: empErr } = await employeesQuery.order("name");

    if (empErr) {
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
      const res = NextResponse.json(errorPayload("catalog", catErr.message), { status: 500 });
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const catalogList = catalog ?? [];
    const empList = employees ?? [];

    const { data: assigned, error: assErr } = await supabaseAdmin
      .from("employee_compliance")
      .select("employee_id, compliance_id, valid_to, waived")
      .eq("org_id", orgId)
      .in("employee_id", rosterEmployeeIds);

    if (assErr) {
      const res = NextResponse.json(errorPayload("assigned", assErr.message), { status: 500 });
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const assignedMap = new Map<string, { valid_to: string | null; waived: boolean }>();
    for (const a of assigned ?? []) {
      assignedMap.set(`${a.employee_id}:${a.compliance_id}`, {
        valid_to: a.valid_to ?? null,
        waived: a.waived ?? false,
      });
    }
    const employeeComplianceRowsCount = (assigned ?? []).length;

    const { data: applicabilityRows } = await supabaseAdmin
      .from("compliance_requirement_applicability")
      .select("compliance_id, applies_to_line, applies_to_role, applies_globally")
      .eq("org_id", orgId);
    const applicabilityByCompliance = new Map<
      string,
      Array<{ applies_to_line: string | null; applies_to_role: string | null; applies_globally: boolean }>
    >();
    for (const row of applicabilityRows ?? []) {
      const r = row as {
        compliance_id: string;
        applies_to_line: string | null;
        applies_to_role: string | null;
        applies_globally: boolean;
      };
      const list = applicabilityByCompliance.get(r.compliance_id) ?? [];
      list.push({
        applies_to_line: r.applies_to_line ?? null,
        applies_to_role: r.applies_to_role ?? null,
        applies_globally: r.applies_globally ?? false,
      });
      applicabilityByCompliance.set(r.compliance_id, list);
    }

    const employeeIds = empList.map((e) => e.id);
    const employeeRoleMap = new Map<string, string>();
    if (employeeIds.length > 0) {
      const { data: erRows } = await supabaseAdmin
        .from("employee_roles")
        .select("employee_id, role_id")
        .eq("org_id", orgId)
        .eq("is_primary", true)
        .in("employee_id", employeeIds);
      const roleIds = [...new Set((erRows ?? []).map((r: { role_id: string }) => r.role_id))];
      if (roleIds.length > 0) {
        const { data: roleRows } = await supabaseAdmin.from("roles").select("id, code").in("id", roleIds);
        const codeByRoleId = new Map<string, string>();
        for (const row of roleRows ?? []) {
          const r = row as { id: string; code: string };
          if (r.code != null) codeByRoleId.set(r.id, r.code);
        }
        for (const er of erRows ?? []) {
          const e = er as { employee_id: string; role_id: string };
          const code = codeByRoleId.get(e.role_id);
          if (code != null) employeeRoleMap.set(e.employee_id, code);
        }
      }
    }

    function requirementAppliesToEmployee(
      _complianceId: string,
      employee: { id: string; line: string | null },
      list: Array<{ applies_to_line: string | null; applies_to_role: string | null; applies_globally: boolean }> | undefined,
      roleByEmp: Map<string, string>
    ): boolean {
      if (!list || list.length === 0) return true;
      const empLine = employee.line?.trim() ?? null;
      const empRole = roleByEmp.get(employee.id) ?? null;
      for (const row of list) {
        if (row.applies_globally) return true;
        if (row.applies_to_line != null && (row.applies_to_line.trim() || "") === (empLine ?? "").trim()) return true;
        if (row.applies_to_role != null && (row.applies_to_role.trim() || "") === (empRole ?? "").trim()) return true;
      }
      return false;
    }

    const legalStoppersEmployees = new Set<string>();
    let legalStoppersItems = 0;
    const expiringSoonEmployees = new Set<string>();
    let expiringSoonItems = 0;
    const healthyEmployees = new Set<string>();
    let healthyItems = 0;

    const siteIds = [...new Set(empList.map((e) => e.site_id).filter((v): v is string => Boolean(v)))];
    const siteNameMap = new Map<string, string>();
    for (const sid of siteIds) {
      const name = await getActiveSiteName(supabaseAdmin, sid, orgId);
      siteNameMap.set(sid, name ?? "Unknown site");
    }

    const rows: Array<{
      employee_id: string;
      employee_name: string;
      employee_number: string;
      line: string | null;
      department: string | null;
      site_id: string | null;
      site_name: string;
      compliance_id: string;
      compliance_code: string;
      compliance_name: string;
      category: string;
      status: string;
      valid_to: string | null;
      days_left: number | null;
    }> = [];

    const searchLower = search ? search.toLowerCase() : "";
    for (const emp of empList) {
      const empName = emp.name ?? [emp.first_name, emp.last_name].filter(Boolean).join(" ") ?? "";
      const empCode = emp.employee_number ?? "";
      if (searchLower && !empName.toLowerCase().includes(searchLower) && !empCode.toLowerCase().includes(searchLower)) continue;

      for (const c of catalogList) {
        if (!requirementAppliesToEmployee(c.id, emp, applicabilityByCompliance.get(c.id), employeeRoleMap)) continue;

        const key = `${emp.id}:${c.id}`;
        const a = assignedMap.get(key);
        const validTo = a?.valid_to ?? null;
        const waived = a?.waived ?? false;
        const status = a ? computeStatus(validTo, waived) : "missing";
        const days = validTo ? daysLeft(validTo) : null;

        if (status === "missing" || status === "expired") {
          legalStoppersEmployees.add(emp.id);
          legalStoppersItems++;
        } else if (status === "expiring") {
          expiringSoonEmployees.add(emp.id);
          expiringSoonItems++;
        } else if (status === "valid" || status === "waived") {
          healthyEmployees.add(emp.id);
          healthyItems++;
        }

        if (statusFilter && status !== statusFilter) continue;

        const empSiteId = emp.site_id ?? null;
        rows.push({
          employee_id: emp.id,
          employee_name: empName || empCode || emp.id,
          employee_number: empCode,
          line: emp.line ?? null,
          department: emp.team ?? null,
          site_id: empSiteId,
          site_name: empSiteId ? siteNameMap.get(empSiteId) ?? "Unknown site" : "",
          compliance_id: c.id,
          compliance_code: c.code,
          compliance_name: c.name,
          category: c.category,
          status,
          valid_to: validTo,
          days_left: days,
        });
      }
    }

    const kpis = {
      legal_stoppers: { employees: legalStoppersEmployees.size, total_items: legalStoppersItems },
      expiring_soon: { employees: expiringSoonEmployees.size, total_items: expiringSoonItems },
      healthy: { employees: healthyEmployees.size, total_items: healthyItems },
    };

    const activeSiteName = siteId ? (await getActiveSiteName(supabaseAdmin, siteId, orgId)) ?? null : null;

    const body: {
      ok: boolean;
      kpis: typeof kpis;
      rows: typeof rows;
      catalog: typeof catalogList;
      activeSiteId: string | null;
      activeSiteName: string | null;
      _debug?: {
        source: string;
        scope_inputs: { org_id: string; site_id: string | null; date: string; shift_code: string; roster_scoping: boolean; roster_employee_ids_count: number };
        catalog_count: number;
        employees_count: number;
        employee_compliance_rows_count: number;
      };
    } = {
      ok: true,
      kpis,
      rows,
      catalog: catalogList,
      activeSiteId: siteId,
      activeSiteName,
    };
    if (wantDebug) {
      body._debug = {
        source: "tables:employees,compliance_catalog,employee_compliance,compliance_requirement_applicability",
        scope_inputs: {
          org_id: orgId,
          site_id: siteId,
          date,
          shift_code: normalized,
          roster_scoping: true,
          roster_employee_ids_count: rosterEmployeeIds.length,
        },
        catalog_count: catalogList.length,
        employees_count: empList.length,
        employee_compliance_rows_count: employeeComplianceRowsCount,
      };
    }

    const res = NextResponse.json(body);
    applySupabaseCookies(res, pendingCookies);
    return res;
  } catch (err) {
    const res = NextResponse.json(errorPayload("unexpected", err), { status: 500 });
    applySupabaseCookies(res, pendingCookies);
    return res;
  }
}
