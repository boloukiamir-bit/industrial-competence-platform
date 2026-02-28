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
      "id, org_id, site_id, shift_date, shift_code, legal_flag, ops_flag, overall_status, iri_score, iri_grade, roster_employee_count, version, created_at, created_by"
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

  const snapshot = {
    id: (row as { id: string }).id,
    shift_date: (row as { shift_date: string }).shift_date,
    shift_code: (row as { shift_code: string }).shift_code,
    legal_flag: (row as { legal_flag: string }).legal_flag,
    ops_flag: (row as { ops_flag: string }).ops_flag,
    overall_status: (row as { overall_status: string }).overall_status,
    iri_score: (row as { iri_score: number }).iri_score,
    iri_grade: (row as { iri_grade: string }).iri_grade,
    roster_employee_count: (row as { roster_employee_count: number }).roster_employee_count,
    version: (row as { version: string }).version,
    created_at: (row as { created_at: string }).created_at,
    created_by: (row as { created_by: string }).created_by,
  };

  const debug = request.nextUrl.searchParams.get("debug") === "1";
  const payload: Record<string, unknown> = {
    ok: true,
    snapshot,
  };
  if (debug) {
    payload._debug = {
      org_id: (row as { org_id: string }).org_id,
      site_id: (row as { site_id: string }).site_id,
    };
  }

  const res = NextResponse.json(payload);
  applySupabaseCookies(res, pendingCookies);
  return res;
}
