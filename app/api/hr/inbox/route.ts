/**
 * GET /api/hr/inbox
 * HR Action Inbox: consolidated actions, lifecycle, governance for HR/Admin.
 * Auth: requireAdminOrHr. Tenant: org_id = active_org_id; site filter when activeSiteId set.
 */
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient, applySupabaseCookies } from "@/lib/supabase/server";
import { requireAdminOrHr } from "@/lib/server/requireAdminOrHr";
import { normalizeComplianceActionStatus } from "@/types/domain";
import type { InboxActionItem, InboxLifecycleItem, InboxGovernanceItem } from "@/types/domain";

const TAB_VALUES = ["actions", "lifecycle", "governance"] as const;
const FILTER_VALUES = ["all", "overdue", "due7", "open"] as const;
const DEFAULT_TAB = "actions";
const DEFAULT_FILTER = "open";
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function sevenDaysLaterIso(): string {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  return d.toISOString().slice(0, 10);
}

export async function GET(request: NextRequest) {
  const { supabase, pendingCookies } = await createSupabaseServerClient(request);
  const auth = await requireAdminOrHr(request, supabase);
  if (!auth.ok) {
    const res = NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
    applySupabaseCookies(res, pendingCookies);
    return res;
  }

  const { searchParams } = new URL(request.url);
  const tab = (searchParams.get("tab")?.toLowerCase()?.trim() || DEFAULT_TAB) as (typeof TAB_VALUES)[number];
  const filter = (searchParams.get("filter")?.toLowerCase()?.trim() || DEFAULT_FILTER) as (typeof FILTER_VALUES)[number];
  const limitRaw = Math.min(
    Math.max(1, parseInt(searchParams.get("limit") ?? String(DEFAULT_LIMIT), 10) || DEFAULT_LIMIT),
    MAX_LIMIT
  );
  const limit = limitRaw;

  const effectiveTab = TAB_VALUES.includes(tab) ? tab : DEFAULT_TAB;
  const effectiveFilter = FILTER_VALUES.includes(filter) ? filter : DEFAULT_FILTER;

  try {
    if (effectiveTab === "actions") {
      const today = todayIso();
      const dueEnd = sevenDaysLaterIso();

      let query = supabase
        .from("compliance_actions")
        .select("id, title, status, due_date, owner_user_id, created_at, employee_id, compliance_id")
        .eq("org_id", auth.activeOrgId)
        .limit(limit + 200);

      if (auth.activeSiteId) {
        query = query.or(`site_id.is.null,site_id.eq.${auth.activeSiteId}`);
      }

      switch (effectiveFilter) {
        case "open":
          query = query.in("status", ["OPEN", "IN_PROGRESS"]);
          break;
        case "all":
          break;
        case "overdue":
          query = query
            .in("status", ["OPEN", "IN_PROGRESS"])
            .not("due_date", "is", null)
            .lt("due_date", today);
          break;
        case "due7":
          query = query
            .in("status", ["OPEN", "IN_PROGRESS"])
            .not("due_date", "is", null)
            .gte("due_date", today)
            .lte("due_date", dueEnd);
          break;
      }

      query = query.order("due_date", { ascending: true, nullsFirst: false }).order("created_at", { ascending: false });

      const { data: rows, error } = await query;

      if (error) {
        console.error("[hr/inbox] actions query failed", error);
        const res = NextResponse.json(
          { ok: false, error: { code: "QUERY_FAILED" } },
          { status: 500 }
        );
        applySupabaseCookies(res, pendingCookies);
        return res;
      }

      const list = (rows ?? []) as Array<{
        id: string;
        title: string | null;
        status: string;
        due_date: string | null;
        owner_user_id: string | null;
        created_at: string;
        employee_id: string | null;
        compliance_id: string | null;
      }>;

      const overdueCut = today;
      const isOpenStatus = (s: string) => s === "OPEN" || s === "IN_PROGRESS" || s === "open";
      const sorted = [...list].sort((a, b) => {
        const aOverdue = a.due_date != null && a.due_date < overdueCut && isOpenStatus(a.status);
        const bOverdue = b.due_date != null && b.due_date < overdueCut && isOpenStatus(b.status);
        if (aOverdue && !bOverdue) return -1;
        if (!aOverdue && bOverdue) return 1;
        const aDue = a.due_date ?? "";
        const bDue = b.due_date ?? "";
        if (aDue !== bDue) return aDue.localeCompare(bDue);
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });

      const items: InboxActionItem[] = sorted.slice(0, limit).map((r) => ({
        id: r.id,
        title: r.title ?? "",
        status: normalizeComplianceActionStatus(r.status),
        due_date: r.due_date ?? null,
        assigned_to_user_id: r.owner_user_id ?? null,
        created_at: r.created_at,
        employee_id: r.employee_id ?? null,
        requirement_id: r.compliance_id ?? null,
      }));

      const res = NextResponse.json({
        ok: true,
        tab: effectiveTab,
        items,
        meta: { limit },
      });
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    if (effectiveTab === "lifecycle") {
      let query = supabase
        .from("governance_events")
        .select("created_at, target_id, meta")
        .eq("org_id", auth.activeOrgId)
        .eq("action", "EMPLOYMENT_STATUS_CHANGE")
        .order("created_at", { ascending: false })
        .limit(limit);

      if (auth.activeSiteId) {
        query = query.or(`site_id.is.null,site_id.eq.${auth.activeSiteId}`);
      }

      const { data: rows, error } = await query;

      if (error) {
        console.error("[hr/inbox] lifecycle query failed", error);
        const res = NextResponse.json(
          { ok: false, error: { code: "QUERY_FAILED" } },
          { status: 500 }
        );
        applySupabaseCookies(res, pendingCookies);
        return res;
      }

      const list = (rows ?? []) as Array<{
        created_at: string;
        target_id: string | null;
        meta: { from?: string; to?: string } | null;
      }>;

      const targetIds = [...new Set(list.map((r) => r.target_id).filter(Boolean))] as string[];
      let employeeMap: Record<string, { first_name?: string | null; last_name?: string | null; employee_number?: string | null }> = {};
      if (targetIds.length > 0) {
        const { data: empRows } = await supabase
          .from("employees")
          .select("id, first_name, last_name, employee_number")
          .eq("org_id", auth.activeOrgId)
          .in("id", targetIds);
        for (const e of empRows ?? []) {
          const row = e as { id: string; first_name?: string | null; last_name?: string | null; employee_number?: string | null };
          employeeMap[row.id] = {
            first_name: row.first_name,
            last_name: row.last_name,
            employee_number: row.employee_number,
          };
        }
      }

      function employeeLabel(targetId: string): string {
        const emp = employeeMap[targetId];
        if (!emp) return targetId;
        const name = [emp.first_name, emp.last_name].filter(Boolean).join(" ").trim();
        return name || (emp.employee_number ?? "") || targetId;
      }

      const items: InboxLifecycleItem[] = list.map((r) => {
        const meta = r.meta ?? {};
        return {
          created_at: r.created_at,
          target_id: r.target_id ?? "",
          from: (meta.from as string) ?? "—",
          to: (meta.to as string) ?? "—",
          employee_label: employeeLabel(r.target_id ?? ""),
        };
      });

      const res = NextResponse.json({
        ok: true,
        tab: effectiveTab,
        items,
        meta: { limit },
      });
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    if (effectiveTab === "governance") {
      let query = supabase
        .from("governance_events")
        .select("created_at, action, target_type, target_id, legitimacy_status, readiness_status, reason_codes, meta")
        .eq("org_id", auth.activeOrgId)
        .or("legitimacy_status.eq.LEGAL_STOP,readiness_status.eq.NO_GO,readiness_status.eq.WARNING")
        .order("created_at", { ascending: false })
        .limit(limit);

      if (auth.activeSiteId) {
        query = query.or(`site_id.is.null,site_id.eq.${auth.activeSiteId}`);
      }

      const { data: rows, error } = await query;

      if (error) {
        console.error("[hr/inbox] governance query failed", error);
        const res = NextResponse.json(
          { ok: false, error: { code: "QUERY_FAILED" } },
          { status: 500 }
        );
        applySupabaseCookies(res, pendingCookies);
        return res;
      }

      const list = (rows ?? []) as Array<{
        created_at: string;
        action: string;
        target_type: string;
        target_id: string | null;
        legitimacy_status: string;
        readiness_status: string;
        reason_codes: string[] | null;
        meta: Record<string, unknown> | null;
      }>;

      const items: InboxGovernanceItem[] = list.map((r) => ({
        created_at: r.created_at,
        action: r.action,
        target_type: r.target_type,
        target_id: r.target_id ?? null,
        legitimacy_status: r.legitimacy_status,
        readiness_status: r.readiness_status,
        reason_codes: Array.isArray(r.reason_codes) ? r.reason_codes : [],
        meta: (r.meta as Record<string, unknown>) ?? {},
      }));

      const res = NextResponse.json({
        ok: true,
        tab: effectiveTab,
        items,
        meta: { limit },
      });
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const res = NextResponse.json({
      ok: true,
      tab: effectiveTab,
      items: [],
      meta: { limit },
    });
    applySupabaseCookies(res, pendingCookies);
    return res;
  } catch (err) {
    console.error("[hr/inbox] unexpected error", err);
    const res = NextResponse.json(
      { ok: false, error: { code: "QUERY_FAILED" } },
      { status: 500 }
    );
    applySupabaseCookies(res, pendingCookies);
    return res;
  }
}
