/**
 * Compliance Matrix 2.0 evaluator for a single employee.
 * Resolves applicable requirements via bindings (STATION > ROLE > ORG precedence),
 * then evaluates expiry status. No DB writes.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { evaluateExpiryStatus } from "@/lib/domain/compliance/evaluateExpiryStatus";

const DEFAULT_REMINDER_DAYS = 30;
const SCOPE_ORD_STATION = 1;
const SCOPE_ORD_ROLE = 2;
const SCOPE_ORD_ORG = 3;

export type EvaluatorCellStatus = "waived" | "missing" | "overdue" | "expiring" | "valid";

export interface ApplicableRequirementRow {
  requirement_id: string;
  code: string;
  name: string;
  expiry_date: string | null;
  reminder_offset_days: number;
  status: EvaluatorCellStatus;
}

export interface EvaluateEmployeeComplianceV2Params {
  orgId: string;
  siteId: string | null;
  employeeId: string;
  referenceDate: Date;
  expiringDaysDefault?: number;
}

/**
 * Returns applicable compliance requirement rows for one employee using
 * compliance_requirement_bindings (ORG/ROLE/STATION precedence). When no bindings
 * exist for the org, falls back to all active catalog items (backward compat).
 */
export async function evaluateEmployeeComplianceV2(
  supabase: SupabaseClient,
  params: EvaluateEmployeeComplianceV2Params
): Promise<ApplicableRequirementRow[]> {
  const { orgId, siteId, employeeId, referenceDate, expiringDaysDefault = DEFAULT_REMINDER_DAYS } = params;

  const empRes = await supabase
    .from("employees")
    .select("id, site_id, line_code")
    .eq("id", employeeId)
    .eq("org_id", orgId)
    .maybeSingle();
  const employee = empRes.data as { id: string; site_id: string | null; line_code: string | null } | null;
  if (!employee) return [];

  const empSiteId = employee.site_id ?? siteId;

  const [catalogRes, assignedRes, bindingsOrgRes, roleIdsRes] = await Promise.all([
    supabase
      .from("compliance_catalog")
      .select("id, code, name, default_warning_window_days")
      .eq("org_id", orgId)
      .eq("is_active", true)
      .order("category")
      .order("code"),
    supabase
      .from("employee_compliance")
      .select("compliance_id, valid_to, waived")
      .eq("org_id", orgId)
      .eq("employee_id", employeeId),
    supabase
      .from("compliance_requirement_bindings")
      .select("compliance_code, warning_window_days_override")
      .eq("org_id", orgId)
      .eq("scope_type", "ORG")
      .eq("disabled", false)
      .or(empSiteId ? `site_id.is.null,site_id.eq.${empSiteId}` : "site_id.is.null"),
    supabase
      .from("employee_roles")
      .select("role_id")
      .eq("org_id", orgId)
      .eq("employee_id", employeeId),
  ]);

  const catalog = (catalogRes.data ?? []) as Array<{
    id: string;
    code: string;
    name: string;
    default_warning_window_days: number | null;
  }>;
  const assignedList = (assignedRes.data ?? []) as Array<{
    compliance_id: string;
    valid_to: string | null;
    waived: boolean;
  }>;
  const assignedMap = new Map(
    assignedList.map((a) => [a.compliance_id, { valid_to: a.valid_to ?? null, waived: a.waived ?? false }])
  );

  const roleIds = [...new Set((roleIdsRes.data ?? []).map((r: { role_id: string }) => r.role_id))];

  let bindingsRole: Array<{ compliance_code: string; warning_window_days_override: number | null }> = [];
  if (roleIds.length > 0) {
    const byRole = await supabase
      .from("compliance_requirement_bindings")
      .select("compliance_code, warning_window_days_override")
      .eq("org_id", orgId)
      .eq("scope_type", "ROLE")
      .eq("disabled", false)
      .in("role_id", roleIds);
    bindingsRole = (byRole.data ?? []) as Array<{ compliance_code: string; warning_window_days_override: number | null }>;
  }

  const bindingsOrg = (bindingsOrgRes.data ?? []) as Array<{
    compliance_code: string;
    warning_window_days_override: number | null;
  }>;

  const catalogByCode = new Map(catalog.map((c) => [c.code, c]));

  const merged = new Map<
    string,
    { scope_ord: number; warning_window_days_override: number | null }
  >();
  for (const b of bindingsOrg) {
    if (catalogByCode.has(b.compliance_code))
      merged.set(b.compliance_code, { scope_ord: SCOPE_ORD_ORG, warning_window_days_override: b.warning_window_days_override });
  }
  for (const b of bindingsRole) {
    if (catalogByCode.has(b.compliance_code)) {
      const existing = merged.get(b.compliance_code);
      if (existing == null || existing.scope_ord > SCOPE_ORD_ROLE)
        merged.set(b.compliance_code, { scope_ord: SCOPE_ORD_ROLE, warning_window_days_override: b.warning_window_days_override });
    }
  }

  const applicableCodes = merged.size > 0 ? merged : null;
  const codesToEval =
    applicableCodes != null
      ? [...applicableCodes.keys()]
      : catalog.map((c) => c.code);

  const rows: ApplicableRequirementRow[] = [];
  for (const code of codesToEval) {
    const c = catalogByCode.get(code);
    if (!c) continue;

    const binding = applicableCodes?.get(code);
    const reminderOffsetDays =
      binding?.warning_window_days_override != null &&
      Number.isFinite(binding.warning_window_days_override) &&
      binding.warning_window_days_override >= 0
        ? binding.warning_window_days_override
        : (c.default_warning_window_days != null && c.default_warning_window_days >= 0
            ? c.default_warning_window_days
            : expiringDaysDefault);

    const a = assignedMap.get(c.id);
    const validTo = a?.valid_to ?? null;
    const waived = a?.waived ?? false;

    let status: EvaluatorCellStatus;
    if (waived) {
      status = "waived";
    } else if (!validTo) {
      status = "missing";
    } else {
      const s = evaluateExpiryStatus({
        expiryDate: validTo,
        reminderOffsetDays,
        referenceDate,
      });
      status = s === "ILLEGAL" ? "overdue" : s === "WARNING" ? "expiring" : "valid";
    }

    rows.push({
      requirement_id: c.id,
      code: c.code,
      name: c.name,
      expiry_date: validTo,
      reminder_offset_days: reminderOffsetDays,
      status,
    });
  }

  return rows;
}
