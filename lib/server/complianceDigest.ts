/**
 * P1.9 Compliance Daily Digest: build digest payload for GET /api/compliance/digest and cron.
 * Shared by live digest API and cron writer. Tenant-safe: all queries scoped by org_id and optional site_id.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

const ZERO_UUID = "00000000-0000-0000-0000-000000000000";

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

function computeSla(
  status: string,
  dueDate: string | null,
  todayStr: string,
  in7Str: string
): "overdue" | "due7d" | "nodue" | "ok" {
  if (status !== "open") return "ok";
  if (dueDate == null) return "nodue";
  if (dueDate < todayStr) return "overdue";
  if (dueDate >= todayStr && dueDate <= in7Str) return "due7d";
  return "ok";
}

export type DigestContext = {
  orgId: string;
  activeSiteId: string | null;
  digestSiteId: string | null;
  activeSiteName: string | null;
  asOf: string;
  expiringDays: number;
};

export type DigestKpis = {
  open: number;
  overdue: number;
  due7d: number;
  nodue: number;
  unassigned: number;
  withEvidence: number;
  withoutEvidence: number;
};

export type DigestTopItem = {
  compliance_code: string;
  compliance_name: string;
  category: string;
  overdueCount: number;
  expiringCount: number;
  missingCount: number;
};

export type DigestTopAction = {
  action_id: string;
  sla: string;
  owner_user_id: string | null;
  due_date: string | null;
  employee_name: string;
  employee_number: string | null;
  compliance_code: string | null;
  compliance_name: string | null;
  evidence_status: "with_evidence" | "without_evidence";
  last_drafted_at: string | null;
};

export type DigestLinks = {
  inboxOverdue: string;
  inboxDue7d: string;
  inboxUnassigned: string;
  summary: string;
};

export type DigestPayload = {
  context: DigestContext;
  kpis: DigestKpis;
  topItems: DigestTopItem[];
  topActions: DigestTopAction[];
  links: DigestLinks;
};

function buildLinks(sessionSiteIdForLinks: string | null): DigestLinks {
  const siteQ = sessionSiteIdForLinks ? `&siteId=${encodeURIComponent(sessionSiteIdForLinks)}` : "";
  return {
    inboxOverdue: `/app/compliance/actions?sla=overdue${siteQ}`,
    inboxDue7d: `/app/compliance/actions?sla=due7d${siteQ}`,
    inboxUnassigned: `/app/compliance/actions?unassignedOnly=1${siteQ}`,
    summary: `/app/compliance/summary${siteQ}`,
  };
}

/**
 * Build digest payload for the given org/site and date. Used by GET digest and cron.
 * siteId = org_units.id used for data scope and storage. sessionSiteIdForLinks = session site id (sites.id) for link query params; when omitted (cron), use siteId.
 */
export async function buildDigestPayload(
  supabase: SupabaseClient,
  orgId: string,
  siteId: string | null,
  asOf: Date,
  expiringDays: number,
  activeSiteName: string | null,
  sessionSiteIdForLinks?: string | null
): Promise<DigestPayload> {
  asOf.setHours(0, 0, 0, 0);
  const asOfStr = asOf.toISOString().slice(0, 10);
  const in7 = new Date(asOf);
  in7.setDate(in7.getDate() + 7);
  const in7Str = in7.toISOString().slice(0, 10);

  const linkSiteId = sessionSiteIdForLinks ?? siteId;
  const context: DigestContext = {
    orgId,
    activeSiteId: linkSiteId,
    digestSiteId: siteId,
    activeSiteName,
    asOf: asOfStr,
    expiringDays,
  };
  const links = buildLinks(linkSiteId);

  // 1) Employees in scope
  let empQ = supabase
    .from("employees")
    .select("id, name, first_name, last_name, employee_number, line, site_id")
    .eq("org_id", orgId)
    .eq("is_active", true);
  if (siteId) empQ = empQ.eq("site_id", siteId);
  const { data: empRows, error: empErr } = await empQ.order("name");
  if (empErr) throw new Error(`employees: ${empErr.message}`);
  const empList = empRows ?? [];
  const empIds = new Set(empList.map((e) => e.id));

  // 2) Catalog
  const { data: catalog, error: catErr } = await supabase
    .from("compliance_catalog")
    .select("id, category, code, name")
    .eq("org_id", orgId)
    .eq("is_active", true)
    .order("category")
    .order("code");
  if (catErr) throw new Error(`catalog: ${catErr.message}`);
  const catalogList = catalog ?? [];

  // 3) Employee compliance (org-wide; filter by empIds)
  const { data: assigned, error: assErr } = await supabase
    .from("employee_compliance")
    .select("employee_id, compliance_id, valid_to, waived")
    .eq("org_id", orgId);
  if (assErr) throw new Error(`employee_compliance: ${assErr.message}`);
  const assignedMap = new Map<string, { valid_to: string | null; waived: boolean }>();
  for (const a of assigned ?? []) {
    if (empIds.has(a.employee_id)) {
      assignedMap.set(`${a.employee_id}:${a.compliance_id}`, {
        valid_to: a.valid_to ?? null,
        waived: a.waived ?? false,
      });
    }
  }

  const itemCounts = new Map<
    string,
    { code: string; name: string; category: string; missing: number; overdue: number; expiring: number }
  >();
  for (const emp of empList) {
    for (const c of catalogList) {
      const key = c.id;
      if (!itemCounts.has(key)) {
        itemCounts.set(key, {
          code: c.code,
          name: c.name,
          category: c.category,
          missing: 0,
          overdue: 0,
          expiring: 0,
        });
      }
      const a = assignedMap.get(`${emp.id}:${c.id}`);
      const validTo = a?.valid_to ?? null;
      const waived = a?.waived ?? false;
      const status = a ? computeStatus(validTo, waived, asOf, expiringDays) : "missing";
      const counts = itemCounts.get(key)!;
      if (status === "missing") counts.missing++;
      else if (status === "overdue") counts.overdue++;
      else if (status === "expiring") counts.expiring++;
    }
  }

  const topItems: DigestTopItem[] = [...itemCounts.values()]
    .filter((r) => r.missing + r.overdue + r.expiring > 0)
    .map((r) => ({
      compliance_code: r.code,
      compliance_name: r.name,
      category: r.category,
      overdueCount: r.overdue,
      expiringCount: r.expiring,
      missingCount: r.missing,
    }))
    .sort((a, b) => {
      const aTotal = a.overdueCount + a.expiringCount + a.missingCount;
      const bTotal = b.overdueCount + b.expiringCount + b.missingCount;
      if (bTotal !== aTotal) return bTotal - aTotal;
      return b.overdueCount - a.overdueCount;
    })
    .slice(0, 10);

  // 4) Actions: open only for KPIs and top list
  let actionsQ = supabase
    .from("compliance_actions")
    .select(
      "id, status, due_date, employee_id, compliance_id, action_type, owner_user_id, evidence_url, evidence_notes, evidence_added_at"
    )
    .eq("org_id", orgId)
    .eq("status", "open");
  if (siteId) actionsQ = actionsQ.eq("site_id", siteId);
  const { data: actionRows, error: actErr } = await actionsQ.order("due_date", {
    ascending: true,
    nullsFirst: false,
  });
  if (actErr) throw new Error(`compliance_actions: ${actErr.message}`);
  const actions = actionRows ?? [];

  const open = actions.length;
  const overdue = actions.filter((r: { due_date: string | null }) => r.due_date && r.due_date < asOfStr).length;
  const due7d = actions.filter(
    (r: { due_date: string | null }) => r.due_date && r.due_date >= asOfStr && r.due_date <= in7Str
  ).length;
  const nodue = actions.filter((r: { due_date: string | null }) => r.due_date == null).length;
  const unassigned = actions.filter((r: { owner_user_id: string | null }) => r.owner_user_id == null).length;
  let withEvidence = 0;
  let withoutEvidence = 0;
  for (const r of actions) {
    const hasEv =
      Boolean((r as { evidence_url?: string }).evidence_url) ||
      Boolean((r as { evidence_added_at?: string }).evidence_added_at);
    if (hasEv) withEvidence++;
    else withoutEvidence++;
  }

  const kpis: DigestKpis = {
    open,
    overdue,
    due7d,
    nodue,
    unassigned,
    withEvidence,
    withoutEvidence,
  };

  const actionIds = actions.slice(0, 20).map((a: { id: string }) => a.id);
  const employeeIds = [...new Set(actions.slice(0, 20).map((a: { employee_id: string }) => a.employee_id))];
  const complianceIds = [...new Set(actions.slice(0, 20).map((a: { compliance_id: string }) => a.compliance_id))];

  let employees: Array<{
    id: string;
    name: string;
    first_name?: string;
    last_name?: string;
    employee_number?: string;
  }> = [];
  if (employeeIds.length > 0) {
    let eq = supabase.from("employees").select("id, name, first_name, last_name, employee_number").eq("org_id", orgId).in("id", employeeIds);
    if (siteId) eq = eq.eq("site_id", siteId);
    const { data: er } = await eq;
    employees = er ?? [];
  }

  let catalogForActions: Array<{ id: string; code: string; name: string }> = [];
  if (complianceIds.length > 0) {
    const { data: cr } = await supabase
      .from("compliance_catalog")
      .select("id, code, name")
      .eq("org_id", orgId)
      .in("id", complianceIds);
    catalogForActions = cr ?? [];
  }

  const latestDraftByAction = new Map<string, string>();
  if (actionIds.length > 0) {
    const { data: eventRows } = await supabase
      .from("compliance_action_events")
      .select("action_id, created_at")
      .eq("org_id", orgId)
      .eq("event_type", "draft_copied")
      .in("action_id", actionIds)
      .order("created_at", { ascending: false });
    for (const e of eventRows ?? []) {
      if (!latestDraftByAction.has(e.action_id)) {
        latestDraftByAction.set(e.action_id, e.created_at);
      }
    }
  }

  const empMap = new Map(
    employees.map((e) => [
      e.id,
      e.name || [e.first_name, e.last_name].filter(Boolean).join(" ") || "—",
    ])
  );
  const catMap = new Map(catalogForActions.map((c) => [c.id, c]));

  const topActions: DigestTopAction[] = actions.slice(0, 20).map((a: Record<string, unknown>) => {
    const dueDate = (a.due_date as string | null) ?? null;
    const sla = computeSla(a.status as string, dueDate, asOfStr, in7Str);
    const hasEv =
      Boolean(a.evidence_url) || Boolean((a as { evidence_added_at?: string }).evidence_added_at);
    const empName = empMap.get(a.employee_id as string) ?? "—";
    const cat = catMap.get(a.compliance_id as string);
    return {
      action_id: a.id as string,
      sla,
      owner_user_id: (a.owner_user_id as string | null) ?? null,
      due_date: dueDate,
      employee_name: empName,
      employee_number: employees.find((e) => e.id === a.employee_id)?.employee_number ?? null,
      compliance_code: cat?.code ?? null,
      compliance_name: cat?.name ?? null,
      evidence_status: hasEv ? "with_evidence" : "without_evidence",
      last_drafted_at: latestDraftByAction.get(a.id as string) ?? null,
    };
  });

  return {
    context,
    kpis,
    topItems,
    topActions,
    links,
  };
}

export { ZERO_UUID };
