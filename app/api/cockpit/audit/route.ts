/**
 * GET /api/cockpit/audit?target_id=&action=
 * Returns the latest governance_event for active org/site matching target_id and/or action.
 * Used by cockpit deep-link from HR Inbox (governance tab).
 */
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient, applySupabaseCookies } from "@/lib/supabase/server";
import { getActiveOrgFromSession } from "@/lib/server/activeOrg";

export async function GET(request: NextRequest) {
  const { supabase, pendingCookies } = await createSupabaseServerClient(request);
  const org = await getActiveOrgFromSession(request, supabase);
  if (!org.ok) {
    const res = NextResponse.json({ ok: false, error: org.error }, { status: org.status });
    applySupabaseCookies(res, pendingCookies);
    return res;
  }

  const targetId = request.nextUrl.searchParams.get("target_id")?.trim() ?? null;
  const action = request.nextUrl.searchParams.get("action")?.trim() ?? null;
  if (!targetId && !action) {
    const res = NextResponse.json(
      { ok: false, error: "target_id or action is required" },
      { status: 400 }
    );
    applySupabaseCookies(res, pendingCookies);
    return res;
  }

  try {
    let query = supabase
      .from("governance_events")
      .select("id, org_id, site_id, action, target_type, target_id, outcome, legitimacy_status, readiness_status, reason_codes, meta, created_at")
      .eq("org_id", org.activeOrgId)
      .order("created_at", { ascending: false })
      .limit(1);

    if (org.activeSiteId) {
      query = query.or(`site_id.is.null,site_id.eq.${org.activeSiteId}`);
    }
    if (targetId) query = query.eq("target_id", targetId);
    if (action) query = query.eq("action", action);

    const { data: rows, error } = await query;

    if (error) {
      console.error("[cockpit/audit] query failed", error);
      const res = NextResponse.json(
        { ok: false, error: { code: "QUERY_FAILED" } },
        { status: 500 }
      );
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const row = Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
    if (!row) {
      const res = NextResponse.json({ ok: true, event: null });
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const event = {
      id: (row as { id: string }).id,
      org_id: (row as { org_id: string }).org_id,
      site_id: (row as { site_id: string | null }).site_id ?? null,
      action: (row as { action: string }).action,
      target_type: (row as { target_type: string }).target_type,
      target_id: (row as { target_id: string | null }).target_id ?? null,
      outcome: (row as { outcome: string }).outcome,
      legitimacy_status: (row as { legitimacy_status: string }).legitimacy_status,
      readiness_status: (row as { readiness_status: string }).readiness_status,
      reason_codes: Array.isArray((row as { reason_codes?: string[] }).reason_codes)
        ? (row as { reason_codes: string[] }).reason_codes
        : [],
      meta: (typeof (row as { meta?: unknown }).meta === "object" && (row as { meta?: unknown }).meta !== null
        ? (row as { meta: Record<string, unknown> }).meta
        : {}) as Record<string, unknown>,
      created_at: (row as { created_at: string }).created_at,
    };

    const res = NextResponse.json({ ok: true, event });
    applySupabaseCookies(res, pendingCookies);
    return res;
  } catch (err) {
    console.error("[cockpit/audit] unexpected error", err);
    const res = NextResponse.json(
      { ok: false, error: { code: "QUERY_FAILED" } },
      { status: 500 }
    );
    applySupabaseCookies(res, pendingCookies);
    return res;
  }
}
