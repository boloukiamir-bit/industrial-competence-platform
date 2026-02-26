/**
 * GET /api/cockpit/compliance-actions-summary
 * Auth/tenant: same as other cockpit APIs (getActiveOrgFromSession). Org-level summary.
 * Returns open, overdue, due-in-7-days counts and top 3 assignees by open count (SQL-level grouping).
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseServerClient, applySupabaseCookies } from "@/lib/supabase/server";
import { getActiveOrgFromSession } from "@/lib/server/activeOrg";

const ZERO_SUMMARY = {
  openCount: 0,
  overdueCount: 0,
  due7DaysCount: 0,
  topAssignees: [] as Array<{ assignedToUserId: string | null; openCount: number; displayName: string }>,
};

function getServiceSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) throw new Error("Missing Supabase configuration");
  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

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
  const org = await getActiveOrgFromSession(request, supabase);
  if (!org.ok) {
    const res = NextResponse.json({ ok: false, error: org.error }, { status: org.status });
    applySupabaseCookies(res, pendingCookies);
    return res;
  }

  const admin = getServiceSupabase();
  const orgId = org.activeOrgId;
  const today = todayIso();
  const dueEnd = sevenDaysLaterIso();

  const openQ = admin
    .from("compliance_actions")
    .select("id", { count: "exact", head: true })
    .eq("org_id", orgId)
    .in("status", ["OPEN", "IN_PROGRESS"]);
  const overdueQ = admin
    .from("compliance_actions")
    .select("id", { count: "exact", head: true })
    .eq("org_id", orgId)
    .in("status", ["OPEN", "IN_PROGRESS"])
    .not("due_date", "is", null)
    .lt("due_date", today);
  const due7Q = admin
    .from("compliance_actions")
    .select("id", { count: "exact", head: true })
    .eq("org_id", orgId)
    .in("status", ["OPEN", "IN_PROGRESS"])
    .not("due_date", "is", null)
    .gte("due_date", today)
    .lte("due_date", dueEnd);

  const openWithSite = org.activeSiteId ? openQ.or(`site_id.is.null,site_id.eq.${org.activeSiteId}`) : openQ;
  const overdueWithSite = org.activeSiteId ? overdueQ.or(`site_id.is.null,site_id.eq.${org.activeSiteId}`) : overdueQ;
  const due7WithSite = org.activeSiteId ? due7Q.or(`site_id.is.null,site_id.eq.${org.activeSiteId}`) : due7Q;

  const [openRes, overdueRes, due7Res, topAssigneesRes] = await Promise.all([
    openWithSite,
    overdueWithSite,
    due7WithSite,
    admin.rpc("get_compliance_actions_top_assignees", {
      p_org_id: orgId,
      p_site_id: org.activeSiteId ?? null,
    }),
  ]);

  if (openRes.error) {
    console.error("[cockpit/compliance-actions-summary] open count query failed", openRes.error);
    const res = NextResponse.json(
      { ok: false, error: { code: "QUERY_FAILED" }, summary: ZERO_SUMMARY },
      { status: 500 }
    );
    applySupabaseCookies(res, pendingCookies);
    return res;
  }
  if (overdueRes.error) {
    console.error("[cockpit/compliance-actions-summary] overdue count query failed", overdueRes.error);
    const res = NextResponse.json(
      { ok: false, error: { code: "QUERY_FAILED" }, summary: ZERO_SUMMARY },
      { status: 500 }
    );
    applySupabaseCookies(res, pendingCookies);
    return res;
  }
  if (due7Res.error) {
    console.error("[cockpit/compliance-actions-summary] due7 count query failed", due7Res.error);
    const res = NextResponse.json(
      { ok: false, error: { code: "QUERY_FAILED" }, summary: ZERO_SUMMARY },
      { status: 500 }
    );
    applySupabaseCookies(res, pendingCookies);
    return res;
  }
  if (topAssigneesRes.error) {
    console.error("[cockpit/compliance-actions-summary] top assignees RPC failed", topAssigneesRes.error);
    const res = NextResponse.json(
      { ok: false, error: { code: "QUERY_FAILED" }, summary: ZERO_SUMMARY },
      { status: 500 }
    );
    applySupabaseCookies(res, pendingCookies);
    return res;
  }

  const openCount = Number((openRes as { count?: number }).count ?? 0);
  const overdueCount = Number((overdueRes as { count?: number }).count ?? 0);
  const due7DaysCount = Number((due7Res as { count?: number }).count ?? 0);

  const topAssigneesRows = (topAssigneesRes.data ?? []) as Array<{
    assigned_to_user_id: string | null;
    open_count: number;
  }>;
  const userIds = topAssigneesRows
    .map((r) => r.assigned_to_user_id)
    .filter((id): id is string => id != null && id.trim() !== "");
  const uniqueIds = [...new Set(userIds)];

  /** Resolved display: undefined = profile missing, null = empty email, string = display name. */
  const profilesMap: Record<string, string | null | undefined> = {};
  if (uniqueIds.length > 0) {
    const { data: profiles } = await admin
      .from("profiles")
      .select("id, email")
      .in("id", uniqueIds);
    if (profiles && Array.isArray(profiles)) {
      for (const p of profiles) {
        const id = (p as { id: string }).id;
        const email = (p as { email?: string | null }).email ?? "";
        const trimmed = email.trim();
        profilesMap[id] = trimmed === "" ? null : trimmed;
      }
    }
  }

  function assigneeDisplayName(uid: string | null): string {
    if (uid == null) return "Unassigned";
    const v = profilesMap[uid];
    if (v === undefined) return "User removed";
    if (v === null) return "No email";
    return v;
  }

  const topAssignees: Array<{
    assignedToUserId: string | null;
    openCount: number;
    displayName: string;
  }> = topAssigneesRows.map((row) => {
    const uid = row.assigned_to_user_id ?? null;
    return {
      assignedToUserId: uid,
      openCount: Number(row.open_count ?? 0),
      displayName: assigneeDisplayName(uid),
    };
  });

  const res = NextResponse.json({
    ok: true,
    summary: {
      openCount,
      overdueCount,
      due7DaysCount,
      topAssignees,
    },
  });
  applySupabaseCookies(res, pendingCookies);
  return res;
}
