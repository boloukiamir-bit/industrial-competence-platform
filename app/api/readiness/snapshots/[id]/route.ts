/**
 * GET /api/readiness/snapshots/[id]
 * Drilldown for a single readiness snapshot. Auth: org member (snapshot must belong to active org).
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getActiveOrgFromSession } from "@/lib/server/activeOrg";
import { createSupabaseServerClient, applySupabaseCookies } from "@/lib/supabase/server";

function getAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

  const { id } = await params;
  if (!id || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    const res = NextResponse.json({ ok: false, error: "INVALID_ID" }, { status: 400 });
    applySupabaseCookies(res, pendingCookies);
    return res;
  }

  const admin = getAdmin();
  if (!admin) {
    const res = NextResponse.json(
      { ok: false, error: "Service unavailable" },
      { status: 503 }
    );
    applySupabaseCookies(res, pendingCookies);
    return res;
  }

  const { data: row, error } = await admin
    .from("readiness_snapshots")
    .select(
      "id, org_id, site_id, shift_date, shift_code, legal_flag, ops_flag, overall_status, iri_score, iri_grade, roster_employee_count, version, created_at, created_by, overall_reason_codes, legal_blockers_sample, ops_no_go_stations_sample, engines"
    )
    .eq("id", id)
    .eq("org_id", org.activeOrgId)
    .maybeSingle();

  if (error) {
    console.error("[readiness/snapshots/[id]] fetch error:", error);
    const res = NextResponse.json(
      { ok: false, error: "DB_ERROR", message: error.message },
      { status: 500 }
    );
    applySupabaseCookies(res, pendingCookies);
    return res;
  }

  if (!row) {
    const res = NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });
    applySupabaseCookies(res, pendingCookies);
    return res;
  }

  const r = row as Record<string, unknown>;
  const snapshot = {
    id: r.id,
    shift_date: r.shift_date,
    shift_code: r.shift_code,
    legal_flag: r.legal_flag,
    ops_flag: r.ops_flag,
    overall_status: r.overall_status,
    iri_score: r.iri_score,
    iri_grade: r.iri_grade,
    roster_employee_count: r.roster_employee_count,
    version: r.version,
    created_at: r.created_at,
    created_by: r.created_by,
    overall_reason_codes: Array.isArray(r.overall_reason_codes) ? r.overall_reason_codes : [],
    legal_blockers_sample: r.legal_blockers_sample ?? [],
    ops_no_go_stations_sample: r.ops_no_go_stations_sample ?? [],
    engines: r.engines && typeof r.engines === "object" ? r.engines : {},
  };

  const debug = request.nextUrl.searchParams.get("debug") === "1";
  const payload: Record<string, unknown> = {
    ok: true,
    snapshot,
  };
  if (debug) {
    payload._debug = {
      org_id: r.org_id,
      site_id: r.site_id,
    };
  }

  const res = NextResponse.json(payload);
  applySupabaseCookies(res, pendingCookies);
  return res;
}
