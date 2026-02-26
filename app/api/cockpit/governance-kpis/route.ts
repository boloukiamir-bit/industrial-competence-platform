/**
 * GET /api/cockpit/governance-kpis?window_hours=24
 * Auth/tenant: getActiveOrgFromSession. Returns blocking governance events count in window.
 * Deterministic: uses shared classify/severity/impact (same rules as Audit UI).
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getActiveOrgFromSession } from "@/lib/server/activeOrg";
import { createSupabaseServerClient, applySupabaseCookies } from "@/lib/supabase/server";
import { isBlockingGovernanceEvent } from "@/lib/server/governance/classify";

function getServiceSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) throw new Error("Missing Supabase configuration");
  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function GET(request: NextRequest) {
  const windowHours = Math.max(1, Math.min(168, Number(request.nextUrl.searchParams.get("window_hours")) || 24));
  const since = new Date(Date.now() - windowHours * 60 * 60 * 1000).toISOString();

  const { supabase, pendingCookies } = await createSupabaseServerClient(request);
  const org = await getActiveOrgFromSession(request, supabase);
  if (!org.ok) {
    const res = NextResponse.json(
      { ok: false, error: org.error },
      { status: org.status }
    );
    applySupabaseCookies(res, pendingCookies);
    return res;
  }

  try {
    const supabaseAdmin = getServiceSupabase();
    let query = supabaseAdmin
      .from("governance_events")
      .select("action, target_type, meta")
      .eq("org_id", org.activeOrgId)
      .gte("created_at", since);

    if (org.activeSiteId) {
      query = query.or(`site_id.is.null,site_id.eq.${org.activeSiteId}`);
    }

    const { data: rows, error: fetchError } = await query;

    if (fetchError) {
      console.error("[governance-kpis] governance_events fetch", fetchError);
      const res = NextResponse.json(
        { ok: true, window_hours: windowHours, blocking_events_24h: 0 },
        { status: 200 }
      );
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const events = rows ?? [];
    let blockingCount = 0;
    for (const row of events) {
      try {
        if (isBlockingGovernanceEvent(row.action, row.target_type, row.meta)) {
          blockingCount += 1;
        }
      } catch {
        // Deterministic classifier does not throw; skip on unexpected error
      }
    }

    const res = NextResponse.json({
      ok: true,
      window_hours: windowHours,
      blocking_events_24h: blockingCount,
    });
    applySupabaseCookies(res, pendingCookies);
    return res;
  } catch (err) {
    console.error("[governance-kpis] unexpected error", err);
    const res = NextResponse.json(
      { ok: true, window_hours: windowHours, blocking_events_24h: 0 },
      { status: 200 }
    );
    applySupabaseCookies(res, pendingCookies);
    return res;
  }
}
