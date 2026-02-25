/**
 * GET /api/hr/inbox/priority
 * Returns aggregated counts for HR Inbox Priority Strip. Auth: requireAdminOrHr. Tenant: org + site.
 */
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient, applySupabaseCookies } from "@/lib/supabase/server";
import { requireAdminOrHr } from "@/lib/server/requireAdminOrHr";
import type { PrioritySummary } from "@/types/domain";

const ZEROS: PrioritySummary = {
  overdueActions: 0,
  unassignedActions: 0,
  legalStops: 0,
  noGoOrWarnings: 0,
};

function sevenDaysAgoIso(): string {
  const d = new Date();
  d.setDate(d.getDate() - 7);
  return d.toISOString();
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function GET(request: NextRequest) {
  const { supabase, pendingCookies } = await createSupabaseServerClient(request);
  const auth = await requireAdminOrHr(request, supabase);
  if (!auth.ok) {
    const res = NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
    applySupabaseCookies(res, pendingCookies);
    return res;
  }

  const since = sevenDaysAgoIso();
  const today = todayIso();

  try {
    let overdueQ = supabase
      .from("compliance_actions")
      .select("id", { count: "exact", head: true })
      .eq("org_id", auth.activeOrgId)
      .in("status", ["OPEN", "IN_PROGRESS"])
      .not("due_date", "is", null)
      .lt("due_date", today);

    let unassignedQ = supabase
      .from("compliance_actions")
      .select("id", { count: "exact", head: true })
      .eq("org_id", auth.activeOrgId)
      .in("status", ["OPEN", "IN_PROGRESS"])
      .is("owner_user_id", null);

    let legalStopQ = supabase
      .from("governance_events")
      .select("id", { count: "exact", head: true })
      .eq("org_id", auth.activeOrgId)
      .eq("legitimacy_status", "LEGAL_STOP")
      .gte("created_at", since);

    let noGoWarnQ = supabase
      .from("governance_events")
      .select("id", { count: "exact", head: true })
      .eq("org_id", auth.activeOrgId)
      .in("readiness_status", ["NO_GO", "WARNING"])
      .gte("created_at", since);

    if (auth.activeSiteId) {
      overdueQ = overdueQ.or(`site_id.is.null,site_id.eq.${auth.activeSiteId}`);
      unassignedQ = unassignedQ.or(`site_id.is.null,site_id.eq.${auth.activeSiteId}`);
      legalStopQ = legalStopQ.or(`site_id.is.null,site_id.eq.${auth.activeSiteId}`);
      noGoWarnQ = noGoWarnQ.or(`site_id.is.null,site_id.eq.${auth.activeSiteId}`);
    }

    const [overdueRes, unassignedRes, legalRes, noGoRes] = await Promise.all([
      overdueQ,
      unassignedQ,
      legalStopQ,
      noGoWarnQ,
    ]);

    const fail = (msg: string) => {
      console.error("[hr/inbox/priority]", msg);
      const res = NextResponse.json(
        { ok: false, error: { code: "QUERY_FAILED" }, summary: ZEROS },
        { status: 500 }
      );
      applySupabaseCookies(res, pendingCookies);
      return res;
    };

    if (overdueRes.error) return fail("overdue query failed");
    if (unassignedRes.error) return fail("unassigned query failed");
    if (legalRes.error) return fail("legalStops query failed");
    if (noGoRes.error) return fail("noGoOrWarnings query failed");

    const summary: PrioritySummary = {
      overdueActions: Number((overdueRes as { count?: number }).count ?? 0),
      unassignedActions: Number((unassignedRes as { count?: number }).count ?? 0),
      legalStops: Number((legalRes as { count?: number }).count ?? 0),
      noGoOrWarnings: Number((noGoRes as { count?: number }).count ?? 0),
    };

    const res = NextResponse.json({ ok: true, summary });
    applySupabaseCookies(res, pendingCookies);
    return res;
  } catch (err) {
    console.error("[hr/inbox/priority] unexpected error", err);
    const res = NextResponse.json(
      { ok: false, error: { code: "QUERY_FAILED" }, summary: ZEROS },
      { status: 500 }
    );
    applySupabaseCookies(res, pendingCookies);
    return res;
  }
}
