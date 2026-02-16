/**
 * Server-side compliance evaluation: fetch catalog + employee_compliance and run rules.
 * Tenant-safe: org_id and site_id required; uses service role or passed client.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  requiredComplianceForContext,
  evaluateEmployeeCompliance,
  COMPLIANCE_RISK_POINTS,
  type EmployeeContext,
  type EmployeeComplianceRecord,
} from "./rules";
import type { ComplianceItemStatus } from "./rules";

export type ComplianceEvalResult = ReturnType<typeof evaluateEmployeeCompliance>;

/** Blocker item for drilldown: missing or expired compliance with affected employees */
export type ComplianceBlockerItem = {
  code: string;
  name: string;
  status: "MISSING" | "EXPIRED";
  valid_to: string | null;
  days_left: number | null;
  affected_employees: Array<{ employee_id: string; name: string }>;
};

/** Warning item for drilldown: expiring soon with affected employees */
export type ComplianceWarningItem = {
  code: string;
  name: string;
  status: "MISSING" | "EXPIRING_7" | "EXPIRING_30";
  valid_to: string | null;
  days_left: number | null;
  affected_employees: Array<{ employee_id: string; name: string }>;
};

/**
 * Load employee compliance records keyed by code for one employee.
 * Catalog is filtered by org and active; only codes that exist in catalog are returned.
 */
export async function loadEmployeeComplianceByCode(
  supabase: SupabaseClient,
  orgId: string,
  employeeId: string
): Promise<Map<string, EmployeeComplianceRecord>> {
  const map = new Map<string, EmployeeComplianceRecord>();

  const [catalogRes, ecRes] = await Promise.all([
    supabase
      .from("compliance_catalog")
      .select("id, code")
      .eq("org_id", orgId)
      .eq("is_active", true),
    supabase
      .from("employee_compliance")
      .select("compliance_id, valid_to, waived")
      .eq("org_id", orgId)
      .eq("employee_id", employeeId),
  ]);

  if (catalogRes.error) throw new Error(`compliance_catalog: ${catalogRes.error.message}`);
  if (ecRes.error) throw new Error(`employee_compliance: ${ecRes.error.message}`);

  const catalogById = new Map((catalogRes.data ?? []).map((r) => [r.id, (r as { code: string }).code]));
  for (const row of ecRes.data ?? []) {
    const r = row as { compliance_id: string; valid_to: string | null; waived: boolean };
    const code = catalogById.get(r.compliance_id);
    if (code) {
      map.set(code, {
        code,
        valid_to: r.valid_to ?? null,
        waived: r.waived ?? false,
      });
    }
  }
  return map;
}

/**
 * Filter required codes to only those present in the org's catalog.
 */
export async function requiredCodesInCatalog(
  supabase: SupabaseClient,
  orgId: string,
  requiredCodes: string[]
): Promise<string[]> {
  if (requiredCodes.length === 0) return [];
  const { data, error } = await supabase
    .from("compliance_catalog")
    .select("code")
    .eq("org_id", orgId)
    .eq("is_active", true)
    .in("code", requiredCodes);
  if (error) throw new Error(`compliance_catalog: ${error.message}`);
  return (data ?? []).map((r) => (r as { code: string }).code);
}

/**
 * Full evaluation for one employee: context -> required codes -> load records -> evaluate.
 */
export async function evaluateComplianceForEmployee(
  supabase: SupabaseClient,
  ctx: EmployeeContext,
  employeeId: string,
  asOf?: Date
): Promise<ComplianceEvalResult> {
  const required = requiredComplianceForContext(ctx);
  const inCatalog = await requiredCodesInCatalog(supabase, ctx.org_id, required);
  const records = await loadEmployeeComplianceByCode(supabase, ctx.org_id, employeeId);
  return evaluateEmployeeCompliance(inCatalog, records, asOf ?? new Date());
}

export type StationComplianceAggregate = {
  compliance_blockers: ComplianceBlockerItem[];
  compliance_warnings: ComplianceWarningItem[];
  compliance_risk_points: number;
};

function employeeNameFromRow(r: { first_name?: string | null; last_name?: string | null; employee_number?: string | null }): string {
  const first = (r.first_name ?? "").trim();
  const last = (r.last_name ?? "").trim();
  if (first || last) return [first, last].filter(Boolean).join(" ");
  return (r.employee_number ?? "—") as string;
}

/**
 * Build blocker and warning arrays from per-employee evaluation results and code->name map.
 * Pure function for testability.
 */
export function buildStationComplianceDetail(
  perEmployee: Array<{
    employeeId: string;
    employeeName: string;
    evalResult: ComplianceEvalResult;
  }>,
  codeToName: Map<string, string>
): { blockers: ComplianceBlockerItem[]; warnings: ComplianceWarningItem[] } {
  type BlockerAcc = {
    status: "MISSING" | "EXPIRED";
    valid_to: string | null;
    days_left: number | null;
    employeeIds: Set<string>;
    names: Map<string, string>;
  };
  type WarningAcc = {
    status: "EXPIRING_7" | "EXPIRING_30";
    valid_to: string;
    days_left: number;
    employeeIds: Set<string>;
    names: Map<string, string>;
  };
  const blockerMap = new Map<string, BlockerAcc>();
  const warningMap = new Map<string, WarningAcc>();

  const addBlocker = (code: string, item: ComplianceItemStatus, empId: string, empName: string) => {
    const status: "MISSING" | "EXPIRED" = item.bucket === "expired" ? "EXPIRED" : "MISSING";
    if (!blockerMap.has(code)) {
      blockerMap.set(code, {
        status,
        valid_to: item.valid_to,
        days_left: item.days_left,
        employeeIds: new Set(),
        names: new Map(),
      });
    }
    const acc = blockerMap.get(code)!;
    acc.employeeIds.add(empId);
    acc.names.set(empId, empName);
    if (status === "EXPIRED") acc.status = "EXPIRED";
    if (item.valid_to != null) {
      acc.valid_to = acc.valid_to ?? item.valid_to;
      acc.days_left = acc.days_left ?? item.days_left;
    }
  };

  const addWarning = (code: string, item: ComplianceItemStatus, empId: string, empName: string) => {
    const status: "EXPIRING_7" | "EXPIRING_30" = item.bucket === "expiring_7" ? "EXPIRING_7" : "EXPIRING_30";
    if (!warningMap.has(code)) {
      warningMap.set(code, {
        status,
        valid_to: item.valid_to ?? "",
        days_left: item.days_left ?? 0,
        employeeIds: new Set(),
        names: new Map(),
      });
    }
    const acc = warningMap.get(code)!;
    acc.employeeIds.add(empId);
    acc.names.set(empId, empName);
    if (status === "EXPIRING_7") acc.status = "EXPIRING_7";
    if (item.valid_to != null) acc.valid_to = item.valid_to;
    if (item.days_left != null) acc.days_left = item.days_left;
  };

  for (const { employeeId, employeeName, evalResult } of perEmployee) {
    for (const item of evalResult.items) {
      if (item.bucket === "missing" || item.bucket === "expired") {
        addBlocker(item.code, item, employeeId, employeeName);
      } else if (item.bucket === "expiring_7" || item.bucket === "expiring_30") {
        addWarning(item.code, item, employeeId, employeeName);
      }
    }
  }

  const blockers: ComplianceBlockerItem[] = [...blockerMap.entries()].map(([code, acc]) => ({
    code,
    name: codeToName.get(code) ?? code,
    status: acc.status,
    valid_to: acc.valid_to,
    days_left: acc.days_left,
    affected_employees: [...acc.employeeIds].map((id) => ({ employee_id: id, name: acc.names.get(id) ?? "—" })),
  }));

  const warnings: ComplianceWarningItem[] = [...warningMap.entries()].map(([code, acc]) => ({
    code,
    name: codeToName.get(code) ?? code,
    status: acc.status,
    valid_to: acc.valid_to,
    days_left: acc.days_left,
    affected_employees: [...acc.employeeIds].map((id) => ({ employee_id: id, name: acc.names.get(id) ?? "—" })),
  }));

  return { blockers, warnings };
}

/**
 * Batch evaluate compliance for multiple employees (same station/shift context) and aggregate
 * for cockpit drilldown: per-code blockers and warnings with status, valid_to, days_left, affected_employees.
 */
export async function aggregateStationCompliance(
  supabase: SupabaseClient,
  ctx: Omit<EmployeeContext, "employee_id">,
  employeeIds: string[],
  _asOf?: Date
): Promise<StationComplianceAggregate> {
  const required = requiredComplianceForContext({ ...ctx, employee_id: undefined });
  const inCatalog = await requiredCodesInCatalog(supabase, ctx.org_id, required);
  if (employeeIds.length === 0 || inCatalog.length === 0) {
    return {
      compliance_blockers: [],
      compliance_warnings: [],
      compliance_risk_points: 0,
    };
  }

  const catalogRes = await supabase
    .from("compliance_catalog")
    .select("id, code, name")
    .eq("org_id", ctx.org_id)
    .eq("is_active", true)
    .in("code", inCatalog);
  if (catalogRes.error) throw new Error(`compliance_catalog: ${catalogRes.error.message}`);
  const codeToName = new Map<string, string>();
  for (const r of catalogRes.data ?? []) {
    const row = r as { code: string; name?: string | null };
    codeToName.set(row.code, (row.name && row.name.trim()) ? row.name.trim() : row.code);
  }

  const [employeesRes, statusRes, blockersRes] = await Promise.all([
    supabase
      .from("employees")
      .select("id, first_name, last_name, employee_number")
      .eq("org_id", ctx.org_id)
      .in("id", employeeIds),
    supabase
      .from("v_employee_compliance_status")
      .select("employee_id, compliance_code, compliance_name, status, valid_to, days_left")
      .eq("org_id", ctx.org_id)
      .in("employee_id", employeeIds)
      .in("compliance_code", inCatalog),
    supabase
      .from("v_employee_compliance_blockers_pilot")
      .select("employee_id, compliance_code, compliance_name, status, valid_to, days_left")
      .eq("org_id", ctx.org_id)
      .in("employee_id", employeeIds)
      .in("compliance_code", inCatalog),
  ]);

  if (employeesRes.error) throw new Error(`employees: ${employeesRes.error.message}`);
  if (statusRes.error) throw new Error(`v_employee_compliance_status: ${statusRes.error.message}`);
  if (blockersRes.error) throw new Error(`v_employee_compliance_blockers_pilot: ${blockersRes.error.message}`);

  const employeeIdToName = new Map<string, string>();
  for (const e of employeesRes.data ?? []) {
    const row = e as { id: string; first_name?: string | null; last_name?: string | null; employee_number?: string | null };
    if (row.id) employeeIdToName.set(row.id, employeeNameFromRow(row));
  }

  const statusRows = (statusRes.data ?? []) as Array<{
    employee_id?: string | null;
    compliance_code?: string | null;
    compliance_name?: string | null;
    status?: string | null;
    valid_to?: string | null;
    days_left?: number | null;
  }>;
  const blockersRows = (blockersRes.data ?? []) as Array<{
    employee_id?: string | null;
    compliance_code?: string | null;
    compliance_name?: string | null;
    status?: string | null;
    valid_to?: string | null;
    days_left?: number | null;
  }>;

  const statusByKey = new Map<string, typeof statusRows[number]>();
  for (const row of statusRows) {
    const employeeId = row.employee_id ?? null;
    const code = row.compliance_code ?? null;
    if (!employeeId || !code) continue;
    statusByKey.set(`${employeeId}:${code}`, row);
  }

  let risk_points = 0;
  for (const row of statusByKey.values()) {
    const status = (row.status ?? "").toUpperCase();
    const bucket =
      status === "VALID"
        ? "valid"
        : status === "EXPIRING_7"
          ? "expiring_7"
          : status === "EXPIRING_30"
            ? "expiring_30"
            : status === "EXPIRED"
              ? "expired"
              : status === "MISSING"
                ? "missing"
                : null;
    if (!bucket) continue;
    risk_points += COMPLIANCE_RISK_POINTS[bucket];
  }

  type BlockerAcc = {
    valid_to: string | null;
    days_left: number | null;
    employeeIds: Set<string>;
    names: Map<string, string>;
  };
  type WarningAcc = {
    status: "MISSING" | "EXPIRING_7" | "EXPIRING_30";
    valid_to: string | null;
    days_left: number | null;
    employeeIds: Set<string>;
    names: Map<string, string>;
  };
  const blockerMap = new Map<string, BlockerAcc>();
  const warningMap = new Map<string, WarningAcc>();

  const warningPriority: Record<WarningAcc["status"], number> = {
    MISSING: 3,
    EXPIRING_7: 2,
    EXPIRING_30: 1,
  };

  for (const row of blockersRows) {
    const employeeId = row.employee_id ?? null;
    const code = row.compliance_code ?? null;
    if (!employeeId || !code) continue;
    if (!blockerMap.has(code)) {
      blockerMap.set(code, {
        valid_to: row.valid_to ?? null,
        days_left: row.days_left ?? null,
        employeeIds: new Set(),
        names: new Map(),
      });
    }
    const acc = blockerMap.get(code)!;
    acc.employeeIds.add(employeeId);
    acc.names.set(employeeId, employeeIdToName.get(employeeId) ?? "—");
    if (row.valid_to && (!acc.valid_to || row.valid_to < acc.valid_to)) {
      acc.valid_to = row.valid_to;
    }
    if (typeof row.days_left === "number") {
      if (acc.days_left == null || row.days_left < acc.days_left) acc.days_left = row.days_left;
    }
  }

  for (const row of statusByKey.values()) {
    const employeeId = row.employee_id ?? null;
    const code = row.compliance_code ?? null;
    const statusRaw = (row.status ?? "").toUpperCase();
    if (!employeeId || !code) continue;
    if (statusRaw === "VALID" || statusRaw === "EXPIRED") continue;
    if (statusRaw !== "MISSING" && statusRaw !== "EXPIRING_7" && statusRaw !== "EXPIRING_30") continue;
    const status = statusRaw as WarningAcc["status"];
    if (!warningMap.has(code)) {
      warningMap.set(code, {
        status,
        valid_to: row.valid_to ?? null,
        days_left: row.days_left ?? null,
        employeeIds: new Set(),
        names: new Map(),
      });
    }
    const acc = warningMap.get(code)!;
    if (warningPriority[status] > warningPriority[acc.status]) {
      acc.status = status;
    }
    acc.employeeIds.add(employeeId);
    acc.names.set(employeeId, employeeIdToName.get(employeeId) ?? "—");
    if (status !== "MISSING" && typeof row.days_left === "number") {
      if (acc.days_left == null || row.days_left < acc.days_left) {
        acc.days_left = row.days_left;
        acc.valid_to = row.valid_to ?? acc.valid_to;
      }
    }
  }

  const blockers: ComplianceBlockerItem[] = [...blockerMap.entries()].map(([code, acc]) => ({
    code,
    name: codeToName.get(code) ?? code,
    status: "EXPIRED",
    valid_to: acc.valid_to,
    days_left: acc.days_left,
    affected_employees: [...acc.employeeIds].map((id) => ({
      employee_id: id,
      name: acc.names.get(id) ?? "—",
    })),
  }));

  const warnings: ComplianceWarningItem[] = [...warningMap.entries()].map(([code, acc]) => ({
    code,
    name: codeToName.get(code) ?? code,
    status: acc.status,
    valid_to: acc.valid_to,
    days_left: acc.days_left,
    affected_employees: [...acc.employeeIds].map((id) => ({
      employee_id: id,
      name: acc.names.get(id) ?? "—",
    })),
  }));

  return {
    compliance_blockers: blockers,
    compliance_warnings: warnings,
    compliance_risk_points: risk_points,
  };
}
