/**
 * P1.1 Recommended Actions Autopop — shared logic for preview and commit.
 * Deterministic rules (documented in comments):
 * - Overdue => action_type = 'request_renewal', due_date = asOf + 3 days
 * - Missing => action_type = 'request_evidence', due_date = asOf + 7 days
 * - Expiring (within expiringDays) => action_type = 'notify_employee', due_date = valid_to - 7 days (clamped >= asOf)
 * Idempotency: skip if an OPEN action already exists for same org_id + site_id + employee_id + compliance_id + action_type.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

const CATEGORIES = ["license", "medical", "contract"] as const;
type CellStatus = "missing" | "overdue" | "expiring" | "valid" | "waived";

function computeStatus(
  validTo: string | null,
  waived: boolean,
  asOf: Date,
  expiringDays: number
): CellStatus {
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

function dateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Same key as DB unique index: org_id, COALESCE(site_id, zero-uuid), employee_id, compliance_id, action_type */
function openActionKey(
  orgId: string,
  siteId: string | null,
  employeeId: string,
  complianceId: string,
  actionType: string
): string {
  const s = siteId ?? "00000000-0000-0000-0000-000000000000";
  return `${orgId}:${s}:${employeeId}:${complianceId}:${actionType}`;
}

export type RecommendItem = {
  employee_id: string;
  employee_name: string;
  compliance_id: string;
  compliance_code: string;
  compliance_name: string;
  reason: "overdue" | "missing" | "expiring";
  action_type: "request_renewal" | "request_evidence" | "notify_employee";
  due_date: string;
  site_id: string | null;
};

export type RecommendParams = {
  orgId: string;
  activeSiteId: string | null;
  asOf: Date;
  expiringDays: number;
  category: "all" | (typeof CATEGORIES)[number];
  line: string | null;
  q: string | null;
};

export type RecommendResult = {
  recommendations: RecommendItem[];
  skippedExistingTotal: number;
  byType: { request_renewal: number; request_evidence: number; notify_employee: number };
};

export async function computeRecommendations(
  supabase: SupabaseClient,
  params: RecommendParams
): Promise<RecommendResult> {
  const { orgId, activeSiteId, asOf, expiringDays, category, line, q } = params;
  const asOfStr = dateStr(asOf);

  // 1) Employees in scope (same as summary)
  let empQ = supabase
    .from("employees")
    .select("id, name, first_name, last_name, employee_number, line, site_id")
    .eq("org_id", orgId)
    .eq("is_active", true);
  if (activeSiteId) empQ = empQ.eq("site_id", activeSiteId);
  if (line) empQ = empQ.eq("line", line);
  const { data: empRows, error: empErr } = await empQ.order("name");
  if (empErr) throw new Error(empErr.message);
  const empList = empRows ?? [];
  const qLower = q ? q.toLowerCase() : "";
  const employeesInScope = qLower
    ? empList.filter((e) => {
        const name = (e.name ?? [e.first_name, e.last_name].filter(Boolean).join(" ") ?? "").toLowerCase();
        const num = (e.employee_number ?? "").toLowerCase();
        return name.includes(qLower) || num.includes(qLower);
      })
    : empList;
  const empIds = new Set(employeesInScope.map((e) => e.id));

  // 2) Catalog
  let catQ = supabase
    .from("compliance_catalog")
    .select("id, category, code, name")
    .eq("org_id", orgId)
    .eq("is_active", true);
  if (category !== "all") catQ = catQ.eq("category", category);
  const { data: catalog, error: catErr } = await catQ.order("category").order("code");
  if (catErr) throw new Error(catErr.message);
  const catalogList = catalog ?? [];

  // 3) Employee compliance
  const { data: assigned, error: assErr } = await supabase
    .from("employee_compliance")
    .select("employee_id, compliance_id, valid_to, waived")
    .eq("org_id", orgId);
  if (assErr) throw new Error(assErr.message);
  const assignedMap = new Map<string, { valid_to: string | null; waived: boolean }>();
  for (const a of assigned ?? []) {
    if (empIds.has(a.employee_id)) {
      assignedMap.set(`${a.employee_id}:${a.compliance_id}`, {
        valid_to: a.valid_to ?? null,
        waived: a.waived ?? false,
      });
    }
  }

  // 4) Existing open actions (for idempotency)
  let actionsQ = supabase
    .from("compliance_actions")
    .select("site_id, employee_id, compliance_id, action_type")
    .eq("org_id", orgId)
    .eq("status", "open");
  if (activeSiteId) actionsQ = actionsQ.eq("site_id", activeSiteId);
  const { data: openRows, error: openErr } = await actionsQ;
  if (openErr) throw new Error(openErr.message);
  const existingOpenKeys = new Set<string>();
  for (const r of openRows ?? []) {
    existingOpenKeys.add(
      openActionKey(orgId, r.site_id ?? null, r.employee_id, r.compliance_id, r.action_type)
    );
  }

  const catalogMap = new Map(catalogList.map((c) => [c.id, c]));
  const empMap = new Map(
    employeesInScope.map((e) => [
      e.id,
      {
        name: e.name ?? [e.first_name, e.last_name].filter(Boolean).join(" ") ?? "—",
        site_id: e.site_id ?? null,
      },
    ])
  );

  const recommendations: RecommendItem[] = [];
  let skippedExistingTotal = 0;
  const byType = { request_renewal: 0, request_evidence: 0, notify_employee: 0 };

  for (const emp of employeesInScope) {
    for (const c of catalogList) {
      const keyEmpCompliance = `${emp.id}:${c.id}`;
      const a = assignedMap.get(keyEmpCompliance);
      const validTo = a?.valid_to ?? null;
      const waived = a?.waived ?? false;
      const status = a ? computeStatus(validTo, waived, asOf, expiringDays) : "missing";

      let action_type: RecommendItem["action_type"];
      let due_date: string;
      let reason: RecommendItem["reason"];

      if (status === "overdue") {
        // Rule: due_date = asOf + 3 days
        const d = new Date(asOf);
        d.setDate(d.getDate() + 3);
        due_date = dateStr(d);
        action_type = "request_renewal";
        reason = "overdue";
      } else if (status === "missing") {
        // Rule: due_date = asOf + 7 days
        const d = new Date(asOf);
        d.setDate(d.getDate() + 7);
        due_date = dateStr(d);
        action_type = "request_evidence";
        reason = "missing";
      } else if (status === "expiring" && validTo) {
        // Rule: due_date = valid_to - 7 days, clamp >= asOf
        const validToDate = new Date(validTo);
        validToDate.setHours(0, 0, 0, 0);
        const notifyDate = new Date(validToDate);
        notifyDate.setDate(notifyDate.getDate() - 7);
        const asOfNorm = new Date(asOf);
        asOfNorm.setHours(0, 0, 0, 0);
        const dueDate = notifyDate < asOfNorm ? asOfNorm : notifyDate;
        due_date = dateStr(dueDate);
        action_type = "notify_employee";
        reason = "expiring";
      } else {
        continue; // valid, waived, or no valid_to for expiring
      }

      const siteId = emp.site_id ?? null;
      const key = openActionKey(orgId, siteId, emp.id, c.id, action_type);
      if (existingOpenKeys.has(key)) {
        skippedExistingTotal++;
        continue;
      }

      byType[action_type]++;
      recommendations.push({
        employee_id: emp.id,
        employee_name: empMap.get(emp.id)!.name,
        compliance_id: c.id,
        compliance_code: c.code,
        compliance_name: c.name,
        reason,
        action_type,
        due_date,
        site_id: siteId,
      });
    }
  }

  return { recommendations, skippedExistingTotal, byType };
}
