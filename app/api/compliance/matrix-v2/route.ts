/**
 * GET /api/compliance/matrix-v2
 * Canonical roster-scoped compliance computation. Requires date + shift_code.
 * Same underlying data as overview-v2 (employees, employee_compliance, compliance_catalog, applicability).
 * Returns readiness_flag, kpis, by_requirement, by_employee, expiring_sample for cockpit.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseServerClient, applySupabaseCookies } from "@/lib/supabase/server";
import { getActiveOrgFromSession } from "@/lib/server/activeOrg";
import { normalizeShiftParam } from "@/lib/server/normalizeShift";
import { getRosterEmployeeIdsForShift } from "@/lib/server/getRosterEmployeeIdsForShift";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const TOP_REQUIREMENTS = 50;
const TOP_EMPLOYEES = 50;
const EXPIRING_SAMPLE_SIZE = 10;

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

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const date = (url.searchParams.get("date") ?? "").trim();
  const shiftCodeParam = (url.searchParams.get("shift_code") ?? url.searchParams.get("shift") ?? "").trim();
  const wantDebug = url.searchParams.get("debug") === "1";

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
      roster_employee_count: 0,
      blocking_count: 0,
      non_blocking_count: 0,
      healthy_count: 0,
      requirement_count: 0,
      expired_count: 0,
      expiring_count: 0,
    };

    if (rosterEmployeeIds.length === 0) {
      const body = {
        ok: true as const,
        readiness_flag: "LEGAL_GO" as const,
        kpis: emptyKpis,
        by_requirement: [] as Array<{
          requirement_id: string;
          requirement_code: string;
          requirement_name: string;
          blocking_affected_employee_count: number;
          expiring_affected_employee_count: number;
          missing_affected_employee_count: number;
          expired_affected_employee_count: number;
        }>,
        by_employee: [] as Array<{
          employee_id: string;
          employee_name: string;
          blocking_items: string[];
          expiring_items: string[];
          status: "LEGAL_OK" | "LEGAL_WARNING" | "LEGAL_BLOCKED";
        }>,
        expiring_sample: [] as Array<{
          employee_id: string;
          employee_name: string;
          compliance_name: string;
          valid_to: string | null;
          status: "expired" | "expiring";
        }>,
        has_more_requirements: false,
        has_more_employees: false,
        _debug: wantDebug
          ? {
              source: "tables:employees,compliance_catalog,employee_compliance,compliance_requirement_applicability",
              scope_inputs: {
                org_id: orgId,
                site_id: siteId,
                date,
                shift_code: normalized,
                roster_employee_ids_count: 0,
              },
              catalog_count: 0,
              compliance_rows_count: 0,
            }
          : undefined,
      };
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

    const complianceRowsCount = (assigned ?? []).length;
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

    type RowLike = {
      employee_id: string;
      compliance_id: string;
      requirement_code: string;
      requirement_name: string;
      status: "valid" | "expiring" | "expired" | "missing" | "waived";
      valid_to: string | null;
    };

    const flatRows: RowLike[] = [];
    let blockingCount = 0;
    let nonBlockingCount = 0;
    let healthyCount = 0;
    let expiredCount = 0;
    let expiringCount = 0;

    const byRequirementRaw = new Map<
      string,
      { code: string; name: string; blocking: Set<string>; expiring: Set<string>; missing: Set<string>; expired: Set<string> }
    >();
    const byEmployeeRaw = new Map<
      string,
      { name: string; blocking: string[]; expiring: string[]; hasBlocking: boolean; hasExpiring: boolean }
    >();
    const empNameById = new Map<string, string>();

    for (const emp of empList) {
      const empName = emp.name ?? [emp.first_name, emp.last_name].filter(Boolean).join(" ") ?? emp.employee_number ?? emp.id;
      empNameById.set(emp.id, empName);
      if (!byEmployeeRaw.has(emp.id)) {
        byEmployeeRaw.set(emp.id, { name: empName, blocking: [], expiring: [], hasBlocking: false, hasExpiring: false });
      }
      const empRec = byEmployeeRaw.get(emp.id)!;

      for (const c of catalogList) {
        if (!requirementAppliesToEmployee(c.id, emp, applicabilityByCompliance.get(c.id), employeeRoleMap)) continue;

        const key = `${emp.id}:${c.id}`;
        const a = assignedMap.get(key);
        const validTo = a?.valid_to ?? null;
        const waived = a?.waived ?? false;
        const status = a ? computeStatus(validTo, waived) : "missing";

        if (status === "missing" || status === "expired") {
          blockingCount++;
          if (status === "expired") expiredCount++;
          empRec.blocking.push(c.code);
          empRec.hasBlocking = true;
        } else if (status === "expiring") {
          nonBlockingCount++;
          expiringCount++;
          empRec.expiring.push(c.code);
          empRec.hasExpiring = true;
        } else {
          healthyCount++;
        }

        flatRows.push({
          employee_id: emp.id,
          compliance_id: c.id,
          requirement_code: c.code,
          requirement_name: c.name,
          status,
          valid_to: validTo,
        });

        if (!byRequirementRaw.has(c.id)) {
          byRequirementRaw.set(c.id, { code: c.code, name: c.name, blocking: new Set(), expiring: new Set(), missing: new Set(), expired: new Set() });
        }
        const reqRec = byRequirementRaw.get(c.id)!;
        if (status === "missing") reqRec.missing.add(emp.id);
        else if (status === "expired") reqRec.expired.add(emp.id);
        else if (status === "expiring") reqRec.expiring.add(emp.id);
      }
    }

    const expiringSampleRows = flatRows
      .filter((r) => r.status === "expired" || r.status === "expiring")
      .sort((a, b) => {
        const aExp = a.status === "expired" ? 0 : 1;
        const bExp = b.status === "expired" ? 0 : 1;
        if (aExp !== bExp) return aExp - bExp;
        const va = a.valid_to ?? "";
        const vb = b.valid_to ?? "";
        return va.localeCompare(vb);
      })
      .slice(0, EXPIRING_SAMPLE_SIZE)
      .map((r) => ({
        employee_id: r.employee_id,
        employee_name: empNameById.get(r.employee_id) ?? r.employee_id,
        compliance_name: r.requirement_name,
        valid_to: r.valid_to,
        status: (r.status === "expired" ? "expired" : "expiring") as "expired" | "expiring",
      }));

    const hasBlocking = blockingCount > 0;
    const hasExpiring = nonBlockingCount > 0;
    const readiness_flag = hasBlocking ? "LEGAL_NO_GO" : hasExpiring ? "LEGAL_WARNING" : "LEGAL_GO";

    const byRequirementList = Array.from(byRequirementRaw.entries())
      .map(([requirement_id, rec]) => ({
        requirement_id,
        requirement_code: rec.code,
        requirement_name: rec.name,
        blocking_affected_employee_count: rec.missing.size + rec.expired.size,
        expiring_affected_employee_count: rec.expiring.size,
        missing_affected_employee_count: rec.missing.size,
        expired_affected_employee_count: rec.expired.size,
      }))
      .sort((a, b) => {
        const aBlock = a.blocking_affected_employee_count + a.expiring_affected_employee_count;
        const bBlock = b.blocking_affected_employee_count + b.expiring_affected_employee_count;
        if (bBlock !== aBlock) return bBlock - aBlock;
        return (a.requirement_code ?? "").localeCompare(b.requirement_code ?? "");
      });
    const by_requirement = byRequirementList.slice(0, TOP_REQUIREMENTS);
    const has_more_requirements = byRequirementList.length > TOP_REQUIREMENTS;

    const byEmployeeList = Array.from(byEmployeeRaw.entries())
      .map(([employee_id, rec]) => {
        let status: "LEGAL_OK" | "LEGAL_WARNING" | "LEGAL_BLOCKED" = "LEGAL_OK";
        if (rec.hasBlocking) status = "LEGAL_BLOCKED";
        else if (rec.hasExpiring) status = "LEGAL_WARNING";
        return {
          employee_id,
          employee_name: rec.name,
          blocking_items: rec.blocking,
          expiring_items: rec.expiring,
          status,
        };
      })
      .sort((a, b) => {
        const order = { LEGAL_BLOCKED: 0, LEGAL_WARNING: 1, LEGAL_OK: 2 };
        if (order[a.status] !== order[b.status]) return order[a.status] - order[b.status];
        return (a.employee_name ?? "").localeCompare(b.employee_name ?? "");
      });
    const by_employee = byEmployeeList.slice(0, TOP_EMPLOYEES);
    const has_more_employees = byEmployeeList.length > TOP_EMPLOYEES;

    const kpis = {
      roster_employee_count: empList.length,
      blocking_count: blockingCount,
      non_blocking_count: nonBlockingCount,
      healthy_count: healthyCount,
      requirement_count: catalogList.length,
      expired_count: expiredCount,
      expiring_count: expiringCount,
    };

    const body = {
      ok: true as const,
      readiness_flag,
      kpis,
      by_requirement,
      by_employee,
      expiring_sample: expiringSampleRows,
      has_more_requirements,
      has_more_employees,
      _debug: wantDebug
        ? {
            source: "tables:employees,compliance_catalog,employee_compliance,compliance_requirement_applicability",
            scope_inputs: {
              org_id: orgId,
              site_id: siteId,
              date,
              shift_code: normalized,
              roster_employee_ids_count: rosterEmployeeIds.length,
            },
            catalog_count: catalogList.length,
            compliance_rows_count: complianceRowsCount,
          }
        : undefined,
    };

    const res = NextResponse.json(body);
    applySupabaseCookies(res, pendingCookies);
    return res;
  } catch (err) {
    const res = NextResponse.json(errorPayload("unexpected", err), { status: 500 });
    applySupabaseCookies(res, pendingCookies);
    return res;
  }
}
