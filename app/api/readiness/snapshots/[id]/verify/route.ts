/**
 * GET /api/readiness/snapshots/[id]/verify
 * Tamper-evident check: recompute payload hash and compare to stored value.
 * Auth: org member (snapshot must belong to active org).
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getActiveOrgFromSession } from "@/lib/server/activeOrg";
import { createSupabaseServerClient, applySupabaseCookies } from "@/lib/supabase/server";
import {
  computePayloadHash,
  canonicalPayloadFromRow,
  HASH_ALGO_V1,
} from "@/lib/server/readiness/snapshotPayloadHash";

function getAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
  if (!id || !UUID_RE.test(id)) {
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
      "id, org_id, site_id, shift_date, shift_code, previous_hash, chain_position, legal_flag, ops_flag, overall_status, iri_score, iri_grade, roster_employee_count, version, overall_reason_codes, legal_blockers_sample, ops_no_go_stations_sample, engines, payload_hash, payload_hash_algo"
    )
    .eq("id", id)
    .eq("org_id", org.activeOrgId)
    .maybeSingle();

  if (error) {
    console.error("[readiness/snapshots/[id]/verify] fetch error:", error);
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
  const storedHash = r.payload_hash == null ? null : String(r.payload_hash).trim();
  const algoRaw = r.payload_hash_algo != null ? String(r.payload_hash_algo).trim() : null;

  if (storedHash == null || storedHash === "") {
    const res = NextResponse.json({
      ok: true,
      snapshot_id: id,
      stored_hash: null,
      computed_hash: null,
      match: false,
      reason: "MISSING_HASH",
      algo: algoRaw ?? null,
    });
    applySupabaseCookies(res, pendingCookies);
    return res;
  }

  const algo = algoRaw && algoRaw.length > 0 ? algoRaw : HASH_ALGO_V1;
  const input = canonicalPayloadFromRow(r);
  const computedHash = computePayloadHash(input, algo);

  const res = NextResponse.json({
    ok: true,
    snapshot_id: id,
    stored_hash: storedHash,
    computed_hash: computedHash,
    match: computedHash === storedHash,
    algo,
  });
  applySupabaseCookies(res, pendingCookies);
  return res;
}
