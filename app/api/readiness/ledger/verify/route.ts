/**
 * GET /api/readiness/ledger/verify
 * Full ledger chain verification: hash + chain linkage for all snapshots of active org.
 * Auth: org member; active org from session only (no org_id in query).
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getActiveOrgFromSession } from "@/lib/server/activeOrg";
import { createSupabaseServerClient, applySupabaseCookies } from "@/lib/supabase/server";
import {
  computePayloadHash,
  canonicalPayloadFromRow,
  HASH_ALGO_V1,
  HASH_ALGO_V2,
} from "@/lib/server/readiness/snapshotPayloadHash";

function getAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

const SELECT_FIELDS =
  "id, payload_hash, payload_hash_algo, previous_hash, chain_position, org_id, site_id, shift_date, shift_code, legal_flag, ops_flag, overall_status, overall_reason_codes, iri_score, iri_grade, roster_employee_count, version, engines, legal_blockers_sample, ops_no_go_stations_sample";

type SnapshotRow = Record<string, unknown>;

export async function GET(request: NextRequest) {
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

  const admin = getAdmin();
  if (!admin) {
    const res = NextResponse.json(
      { ok: false, error: "Service unavailable" },
      { status: 503 }
    );
    applySupabaseCookies(res, pendingCookies);
    return res;
  }

  const { data: rows, error } = await admin
    .from("readiness_snapshots")
    .select(SELECT_FIELDS + ", created_at")
    .eq("org_id", org.activeOrgId)
    .order("chain_position", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: true });

  if (error) {
    console.error("[readiness/ledger/verify] fetch error:", error);
    const res = NextResponse.json(
      { ok: false, error: "DB_ERROR", message: error.message },
      { status: 500 }
    );
    applySupabaseCookies(res, pendingCookies);
    return res;
  }

  const list = ((rows ?? []) as unknown) as SnapshotRow[];

  if (list.length === 0) {
    const res = NextResponse.json({
      ok: true,
      chain_valid: true,
      total_snapshots: 0,
      verified_snapshots: 0,
    });
    applySupabaseCookies(res, pendingCookies);
    return res;
  }

  let lastRow: SnapshotRow | null = null;

  for (const row of list) {
    const chainPosition =
      row.chain_position != null
        ? (typeof row.chain_position === "number"
            ? row.chain_position
            : parseInt(String(row.chain_position), 10))
        : null;
    const payloadHash = row.payload_hash == null ? null : String(row.payload_hash).trim();

    // Step A — Hash validation
    if (payloadHash == null || payloadHash === "") {
      const res = NextResponse.json({
        ok: true,
        chain_valid: false,
        reason: "MISSING_HASH",
        first_invalid_position: chainPosition ?? undefined,
      });
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const algo = (row.payload_hash_algo != null ? String(row.payload_hash_algo).trim() : null) ?? HASH_ALGO_V1;
    const input = canonicalPayloadFromRow(row);
    const computedHash = computePayloadHash(input, algo);

    if (computedHash !== payloadHash) {
      const res = NextResponse.json({
        ok: true,
        chain_valid: false,
        reason: "HASH_MISMATCH",
        first_invalid_position: chainPosition ?? undefined,
      });
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    // Step B — Chain linkage validation (V2 only)
    if (algo === HASH_ALGO_V2) {
      if (chainPosition === 1) {
        const prevHash = row.previous_hash;
        if (prevHash != null && String(prevHash).trim() !== "") {
          const res = NextResponse.json({
            ok: true,
            chain_valid: false,
            reason: "CHAIN_BROKEN_AT_GENESIS",
            first_invalid_position: 1,
          });
          applySupabaseCookies(res, pendingCookies);
          return res;
        }
      } else if (chainPosition != null && chainPosition > 1) {
        const expectedPrev = lastRow ? (lastRow.payload_hash == null ? null : String(lastRow.payload_hash).trim()) : null;
        const actualPrev = row.previous_hash == null ? null : String(row.previous_hash).trim();
        if (actualPrev !== expectedPrev) {
          const res = NextResponse.json({
            ok: true,
            chain_valid: false,
            reason: "CHAIN_LINK_MISMATCH",
            first_invalid_position: chainPosition,
          });
          applySupabaseCookies(res, pendingCookies);
          return res;
        }
      }
    }

    lastRow = row;
  }

  const res = NextResponse.json({
    ok: true,
    chain_valid: true,
    total_snapshots: list.length,
    verified_snapshots: list.length,
  });
  applySupabaseCookies(res, pendingCookies);
  return res;
}
