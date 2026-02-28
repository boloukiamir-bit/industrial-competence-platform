/**
 * GET /api/compliance/overview — KPIs (operational risk: legal_stoppers, expiring_soon, healthy) + table rows for employees with filters.
 * Query: siteId?, category?, status?, search? (employee name/code). Fail loud with { ok: false, step, error, details }.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseServerClient, applySupabaseCookies } from "@/lib/supabase/server";
import { getActiveOrgFromSession } from "@/lib/server/activeOrg";
import { getActiveSiteName } from "@/lib/server/siteName";
import { normalizeProfileActiveSiteIfStale } from "@/lib/server/validateActiveSite";

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
  const { supabase, pendingCookies } = await createSupabaseServerClient(request);
  const org = await getActiveOrgFromSession(request, supabase);
  if (!org.ok) {
    const res = NextResponse.json(errorPayload("getActiveOrg", org.error), { status: org.status });
    applySupabaseCookies(res, pendingCookies);
    return res;
  }

  const { searchParams } = new URL(request.url);
  const wantDebug = searchParams.get("debug") === "1";
  const siteId = searchParams.get("siteId")?.trim() || null;
  const category = searchParams.get("category")?.trim() || null;
  const statusFilter = searchParams.get("status")?.trim() || null;
  const search = searchParams.get("search")?.trim() || null;

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

    const employeesQuery = supabaseAdmin
      .from("employees")
      .select("id, name, first_name, last_name, employee_number, line, team, site_id")
      .eq("org_id", orgId)
      .eq("is_active", true);
    if (siteId) employeesQuery.eq("site_id", siteId);
    const { data: employees, error: empErr } = await employeesQuery.order("name");

    if (empErr) {
      console.error("compliance/overview employees", empErr);
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
      console.error("compliance/overview catalog", catErr);
      const res = NextResponse.json(errorPayload("catalog", catErr.message), { status: 500 });
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const catalogList = catalog ?? [];
    const empList = employees ?? [];

    const { data: assigned, error: assErr } = await supabaseAdmin
      .from("employee_compliance")
      .select("employee_id, compliance_id, valid_to, waived")
      .eq("org_id", orgId);

    if (assErr) {
      console.error("compliance/overview assigned", assErr);
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
        const { data: roleRows } = await supabaseAdmin
          .from("roles")
          .select("id, code")
          .in("id", roleIds);
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

        const siteId = emp.site_id ?? null;
        rows.push({
          employee_id: emp.id,
          employee_name: empName || empCode || emp.id,
          employee_number: empCode,
          line: emp.line ?? null,
          department: emp.team ?? null,
          site_id: siteId,
          site_name: siteId ? siteNameMap.get(siteId) ?? "Unknown site" : "",
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

    const body: {
      ok: boolean;
      kpis: typeof kpis;
      rows: typeof rows;
      catalog: typeof catalogList;
      activeSiteId: string | null;
      activeSiteName: string | null;
      _debug?: {
        source: string;
        scope_inputs: { org_id: string; site_id: string | null; roster_scoping: boolean; roster_employee_ids_count: number };
        requirement_count: number;
        employees_count: number;
      };
    } = {
      ok: true,
      kpis,
      rows,
      catalog: catalogList,
      activeSiteId: org.activeSiteId ?? null,
      activeSiteName,
    };
    if (wantDebug) {
      body._debug = {
        source: "tables:employees,compliance_catalog,employee_compliance,compliance_requirement_applicability",
        scope_inputs: {
          org_id: orgId,
          site_id: siteId ?? org.activeSiteId ?? null,
          roster_scoping: false,
          roster_employee_ids_count: 0,
        },
        requirement_count: catalogList.length,
        employees_count: empList.length,
      };
    }

    const res = NextResponse.json(body);
    applySupabaseCookies(res, pendingCookies);
    return res;
  } catch (err) {
    console.error("GET /api/compliance/overview failed:", err);
    const res = NextResponse.json(errorPayload("unexpected", err), { status: 500 });
    applySupabaseCookies(res, pendingCookies);
    return res;
  }
}
