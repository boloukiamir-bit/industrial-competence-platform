/**
 * GET /api/compliance/actions/inbox — list actions across employees for Action Inbox.
 * Admin/HR only. Tenant: getActiveOrgFromSession. Site: strict when activeSiteId set.
 *
 * Query: status, q, actionType, due, line, category, limit,
 *        unassignedOnly (0|1), sla (overdue|due7d|nodue|all), owner (me|unassigned|all)
 * Returns: actions (enriched with sla), activeSiteId, activeSiteName, kpis, lines, unassignedCount
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseServerClient, applySupabaseCookies } from "@/lib/supabase/server";
import { getActiveOrgFromSession } from "@/lib/server/activeOrg";
import { getActiveSiteName } from "@/lib/server/siteName";
import { isHrAdmin } from "@/lib/auth";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const ACTION_TYPES = ["request_renewal", "request_evidence", "notify_employee", "mark_waived_review"] as const;
const CATEGORIES = ["license", "medical", "contract"] as const;
export type SlaFlag = "overdue" | "due7d" | "nodue" | "ok";

function computeSla(
  status: string,
  dueDate: string | null,
  todayStr: string,
  in7Str: string
): SlaFlag {
  if (status !== "open") return "ok";
  if (dueDate == null) return "nodue";
  if (dueDate < todayStr) return "overdue";
  if (dueDate >= todayStr && dueDate <= in7Str) return "due7d";
  return "ok";
}

function errorPayload(step: string, error: unknown, details?: string) {
  const msg = error instanceof Error ? error.message : String(error);
  return { ok: false as const, step, error: msg, ...(details != null && { details }) };
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

  if (!isHrAdmin(membership?.role)) {
    const res = NextResponse.json(errorPayload("forbidden", "Admin/HR only"), { status: 403 });
    applySupabaseCookies(res, pendingCookies);
    return res;
  }

  const { searchParams } = new URL(request.url);
  const statusParam = (searchParams.get("status")?.trim() || "open") as "open" | "done" | "all";
  const q = searchParams.get("q")?.trim() || null;
  const actionTypeParam = searchParams.get("actionType")?.trim() || "all";
  const dueParam = (searchParams.get("due")?.trim() || "all") as "overdue" | "7d" | "30d" | "all";
  const line = searchParams.get("line")?.trim() || null;
  const categoryParam = (searchParams.get("category")?.trim() || "all") as "license" | "medical" | "contract" | "all";
  const unassignedOnly = searchParams.get("unassignedOnly") === "1";
  const slaParam = (searchParams.get("sla")?.trim() || "all") as "overdue" | "due7d" | "nodue" | "all";
  const ownerParam = (searchParams.get("owner")?.trim() || "all") as "me" | "unassigned" | "all";
  const limitParam = searchParams.get("limit");
  const limit = limitParam != null ? Math.min(500, Math.max(1, parseInt(limitParam, 10) || 200)) : 200;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = today.toISOString().slice(0, 10);
  const in7 = new Date(today);
  in7.setDate(in7.getDate() + 7);
  const in7Str = in7.toISOString().slice(0, 10);
  const in30 = new Date(today);
  in30.setDate(in30.getDate() + 30);
  const in30Str = in30.toISOString().slice(0, 10);

  try {
    const orgId = org.activeOrgId;
    const activeSiteId = org.activeSiteId ?? null;

    const activeSiteName =
      activeSiteId != null ? await getActiveSiteName(supabaseAdmin, activeSiteId, orgId) : null;

    // Base actions query
    let actionsQuery = supabaseAdmin
      .from("compliance_actions")
      .select("id, org_id, site_id, employee_id, compliance_id, action_type, status, due_date, owner_user_id, notes, created_at, evidence_url, evidence_notes, evidence_added_at")
      .eq("org_id", orgId)
      .order("due_date", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(limit);

    if (activeSiteId) {
      actionsQuery = actionsQuery.eq("site_id", activeSiteId);
    }

    // P1.2.1: When sla !== "all", SLA filter is applied in SQL (server-side). SLA only applies to open
    // actions, so we force status='open' and ignore status param for that case (UI chips expect open).
    if (slaParam !== "all") {
      actionsQuery = actionsQuery.eq("status", "open");
      if (slaParam === "overdue") {
        actionsQuery = actionsQuery.not("due_date", "is", null).lt("due_date", todayStr);
      } else if (slaParam === "due7d") {
        actionsQuery = actionsQuery
          .not("due_date", "is", null)
          .gte("due_date", todayStr)
          .lte("due_date", in7Str);
      } else if (slaParam === "nodue") {
        actionsQuery = actionsQuery.is("due_date", null);
      }
    } else {
      if (statusParam === "open") {
        actionsQuery = actionsQuery.eq("status", "open");
      } else if (statusParam === "done") {
        actionsQuery = actionsQuery.eq("status", "done");
      }
    }

    if (actionTypeParam !== "all" && ACTION_TYPES.includes(actionTypeParam as (typeof ACTION_TYPES)[number])) {
      actionsQuery = actionsQuery.eq("action_type", actionTypeParam);
    }

    if (slaParam === "all") {
      if (dueParam === "overdue") {
        actionsQuery = actionsQuery.not("due_date", "is", null).lt("due_date", todayStr);
      } else if (dueParam === "7d") {
        actionsQuery = actionsQuery
          .not("due_date", "is", null)
          .gte("due_date", todayStr)
          .lte("due_date", in7Str);
      } else if (dueParam === "30d") {
        actionsQuery = actionsQuery
          .not("due_date", "is", null)
          .gte("due_date", todayStr)
          .lte("due_date", in30Str);
      }
    }

    if (ownerParam === "me") {
      actionsQuery = actionsQuery.eq("owner_user_id", org.userId);
    } else if (ownerParam === "unassigned" || unassignedOnly) {
      actionsQuery = actionsQuery.is("owner_user_id", null);
    }

    const { data: actionRows, error: actionsErr } = await actionsQuery;

    if (actionsErr) {
      console.error("compliance/actions/inbox list", actionsErr);
      const res = NextResponse.json(errorPayload("list", actionsErr.message), { status: 500 });
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const actions = actionRows ?? [];
    const employeeIds = [...new Set(actions.map((a: { employee_id: string }) => a.employee_id))];
    const complianceIds = [...new Set(actions.map((a: { compliance_id: string }) => a.compliance_id))];

    let employees: Array<{ id: string; name: string; first_name?: string; last_name?: string; employee_number?: string; line?: string; site_id?: string }> = [];
    if (employeeIds.length > 0) {
      let empQ = supabaseAdmin
        .from("employees")
        .select("id, name, first_name, last_name, employee_number, line, site_id")
        .eq("org_id", orgId)
        .in("id", employeeIds);
      if (activeSiteId) empQ = empQ.eq("site_id", activeSiteId);
      const { data: empRows } = await empQ;
      employees = empRows ?? [];
    }

    const empMap = new Map(
      employees.map((e) => [
        e.id,
        {
          name: e.name || [e.first_name, e.last_name].filter(Boolean).join(" ") || "—",
          employee_number: e.employee_number ?? null,
          line: e.line ?? null,
          site_id: e.site_id ?? null,
        },
      ])
    );

    let catalog: Array<{ id: string; code: string; name: string; category: string }> = [];
    if (complianceIds.length > 0) {
      let catQ = supabaseAdmin
        .from("compliance_catalog")
        .select("id, code, name, category")
        .eq("org_id", orgId)
        .in("id", complianceIds);
      if (categoryParam !== "all" && CATEGORIES.includes(categoryParam)) {
        catQ = catQ.eq("category", categoryParam);
      }
      const { data: catRows } = await catQ;
      catalog = catRows ?? [];
    }

    const catalogMap = new Map(catalog.map((c) => [c.id, c]));

    // P1.5: Latest draft_copied event per action
    const actionIds = actions.map((a: { id: string }) => a.id);
    const latestDraftByAction = new Map<
      string,
      { last_drafted_at: string; last_drafted_by: string | null; last_drafted_channel: string | null; last_drafted_template_id: string | null }
    >();
    if (actionIds.length > 0) {
      const { data: eventRows } = await supabaseAdmin
        .from("compliance_action_events")
        .select("action_id, created_at, created_by, channel, template_id")
        .eq("org_id", orgId)
        .eq("event_type", "draft_copied")
        .in("action_id", actionIds)
        .order("created_at", { ascending: false });
      for (const e of eventRows ?? []) {
        if (!latestDraftByAction.has(e.action_id)) {
          latestDraftByAction.set(e.action_id, {
            last_drafted_at: e.created_at,
            last_drafted_by: e.created_by ?? null,
            last_drafted_channel: e.channel ?? null,
            last_drafted_template_id: e.template_id ?? null,
          });
        }
      }
    }

    // q filter: search over employee name or employee number (client-side filter on enriched data)
    let filtered = actions;
    if (q) {
      const qLower = q.toLowerCase();
      filtered = actions.filter((a: { employee_id: string }) => {
        const emp = empMap.get(a.employee_id);
        if (!emp) return false;
        const matchName = emp.name.toLowerCase().includes(qLower);
        const matchNum = (emp.employee_number ?? "").toLowerCase().includes(qLower);
        return matchName || matchNum;
      });
    }

    // line filter
    if (line) {
      filtered = filtered.filter((a: { employee_id: string }) => {
        const emp = empMap.get(a.employee_id);
        return emp?.line === line;
      });
    }

    // category filter (on compliance)
    if (categoryParam !== "all") {
      filtered = filtered.filter((a: { compliance_id: string }) => {
        const cat = catalogMap.get(a.compliance_id);
        return cat?.category === categoryParam;
      });
    }

    // Distinct lines from employees in scope (for line dropdown)
    const linesList = [...new Set(employees.map((e) => e.line).filter((v): v is string => Boolean(v)))].sort();

    // Resolve site_name for each distinct site_id when activeSiteId is null (all sites view)
    const siteNameMap = new Map<string, string>();
    if (!activeSiteId && filtered.length > 0) {
      const siteIds = [...new Set(actions.map((a: { site_id?: string }) => a.site_id).filter((v): v is string => Boolean(v)))];
      for (const sid of siteIds) {
        const name = await getActiveSiteName(supabaseAdmin, sid, orgId);
        siteNameMap.set(sid, name ?? "Unknown site");
      }
    }

    // Enrich with employee/compliance and compute per-row sla for UI badge (SLA filtering is done in SQL above).
    const enriched = filtered.map((a: Record<string, unknown>) => {
      const emp = empMap.get(a.employee_id as string);
      const cat = catalogMap.get(a.compliance_id as string);
      const siteId = a.site_id as string | null;
      const dueDate = (a.due_date as string | null) ?? null;
      const sla = computeSla(a.status as string, dueDate, todayStr, in7Str);
      const evidenceUrl = (a.evidence_url as string | null) ?? null;
      const evidenceAddedAt = (a.evidence_added_at as string | null) ?? null;
      return {
        action_id: a.id,
        status: a.status,
        action_type: a.action_type,
        due_date: dueDate,
        owner_user_id: a.owner_user_id ?? null,
        notes: a.notes ?? null,
        created_at: a.created_at,
        sla,
        employee_id: a.employee_id,
        employee_number: emp?.employee_number ?? null,
        employee_name: emp?.name ?? "—",
        employee_line: emp?.line ?? null,
        employee_site_id: emp?.site_id ?? null,
        compliance_id: a.compliance_id,
        compliance_code: cat?.code ?? null,
        compliance_name: cat?.name ?? null,
        compliance_category: cat?.category ?? null,
        site_name: !activeSiteId && siteId ? siteNameMap.get(siteId) ?? null : null,
        lastDraftedAt: latestDraftByAction.get(a.id as string)?.last_drafted_at ?? null,
        lastDraftedBy: latestDraftByAction.get(a.id as string)?.last_drafted_by ?? null,
        lastDraftedChannel: latestDraftByAction.get(a.id as string)?.last_drafted_channel ?? null,
        lastDraftedTemplateId: latestDraftByAction.get(a.id as string)?.last_drafted_template_id ?? null,
        hasEvidence: Boolean(evidenceUrl || evidenceAddedAt),
        evidenceAddedAt: evidenceAddedAt,
        evidenceUrl: evidenceUrl,
        evidenceNotes: (a.evidence_notes as string | null) ?? null,
      };
    });

    // KPIs: computed for current site scope, without q/line/category filters (per spec: "if hard, compute without filters")
    let kpiQuery = supabaseAdmin
      .from("compliance_actions")
      .select("id, status, due_date, done_at")
      .eq("org_id", orgId);
    if (activeSiteId) {
      kpiQuery = kpiQuery.eq("site_id", activeSiteId);
    }
    const { data: kpiRows } = await kpiQuery;

    const kpiActions = kpiRows ?? [];
    const openCount = kpiActions.filter((r: { status: string }) => r.status === "open").length;
    const overdueCount = kpiActions.filter(
      (r: { status: string; due_date: string | null }) => r.status === "open" && r.due_date && r.due_date < todayStr
    ).length;
    const due7dCount = kpiActions.filter(
      (r: { status: string; due_date: string | null }) =>
        r.status === "open" && r.due_date && r.due_date >= todayStr && r.due_date <= in7Str
    ).length;
    // done7d: count where status='done' AND done_at >= now() - 7 days (legacy rows with null done_at excluded)
    const nowMs = Date.now();
    const weekAgoMs = nowMs - 7 * 24 * 60 * 60 * 1000;
    const done7dCount = kpiActions.filter((r: { status: string; done_at: string | null }) => {
      if (r.status !== "done" || !r.done_at) return false;
      const doneMs = new Date(r.done_at).getTime();
      return doneMs >= weekAgoMs && doneMs <= nowMs;
    }).length;

    let unassignedCount = 0;
    let unassignedQuery = supabaseAdmin
      .from("compliance_actions")
      .select("id", { count: "exact", head: true })
      .eq("org_id", orgId)
      .eq("status", "open")
      .is("owner_user_id", null);
    if (activeSiteId) unassignedQuery = unassignedQuery.eq("site_id", activeSiteId);
    const { count: unassignedCountVal } = await unassignedQuery;
    unassignedCount = unassignedCountVal ?? 0;

    const res = NextResponse.json({
      ok: true,
      actions: enriched,
      activeSiteId,
      activeSiteName,
      kpis: { open: openCount, overdue: overdueCount, due7d: due7dCount, done7d: done7dCount },
      unassignedCount,
      lines: linesList,
    });
    applySupabaseCookies(res, pendingCookies);
    return res;
  } catch (err) {
    console.error("GET /api/compliance/actions/inbox failed:", err);
    const res = NextResponse.json(errorPayload("unexpected", err), { status: 500 });
    applySupabaseCookies(res, pendingCookies);
    return res;
  }
}
