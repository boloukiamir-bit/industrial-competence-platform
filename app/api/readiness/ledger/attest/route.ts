/**
 * GET /api/readiness/ledger/attest
 * Ed25519-signed attestation of ledger head after full chain verification.
 * Auth: org member; active org from session only. 403 if no active org.
 */
import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getActiveOrgFromSession } from "@/lib/server/activeOrg";
import { createSupabaseServerClient, applySupabaseCookies } from "@/lib/supabase/server";
import { verifyLedgerChain, type SnapshotRow } from "@/lib/server/readiness/verifyLedgerChain";

function getAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

const SELECT_FIELDS =
  "id, payload_hash, payload_hash_algo, previous_hash, chain_position, org_id, site_id, shift_date, shift_code, legal_flag, ops_flag, overall_status, overall_reason_codes, iri_score, iri_grade, roster_employee_count, version, engines, legal_blockers_sample, ops_no_go_stations_sample";

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
    console.error("[readiness/ledger/attest] fetch error:", error);
    const res = NextResponse.json(
      { ok: false, error: "DB_ERROR", message: error.message },
      { status: 500 }
    );
    applySupabaseCookies(res, pendingCookies);
    return res;
  }

  const list = ((rows ?? []) as unknown) as SnapshotRow[];
  const result = verifyLedgerChain(list);

  if (result.chain_valid !== true) {
    const res = NextResponse.json({
      ok: false,
      error: "LEDGER_NOT_VALID",
    });
    applySupabaseCookies(res, pendingCookies);
    return res;
  }

  const total_snapshots = list.length;

  const { data: latestRow } = await admin
    .from("readiness_snapshots")
    .select("chain_position, payload_hash")
    .eq("org_id", org.activeOrgId)
    .order("chain_position", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const head_position =
    latestRow?.chain_position != null
      ? typeof latestRow.chain_position === "number"
        ? latestRow.chain_position
        : parseInt(String(latestRow.chain_position), 10)
      : null;
  const head_hash =
    latestRow?.payload_hash != null ? String(latestRow.payload_hash).trim() : null;

  const payload = {
    org_id: org.activeOrgId,
    head_position,
    head_hash,
    total_snapshots,
    verified_at: new Date().toISOString(),
  };

  const privateKeyB64 = process.env.LEDGER_ED25519_PRIVATE_KEY;
  if (!privateKeyB64 || privateKeyB64.trim() === "") {
    throw new Error("LEDGER_ED25519_PRIVATE_KEY not set");
  }
  const publicKeyB64 = process.env.LEDGER_ED25519_PUBLIC_KEY ?? "";
  const privateKey = Buffer.from(privateKeyB64, "base64");
  const publicKey = Buffer.from(publicKeyB64, "base64");

  const payloadJson = JSON.stringify(payload);
  let signature: string;
  try {
    signature = crypto
      .sign(null, Buffer.from(payloadJson, "utf8"), {
        key: privateKey,
        format: "der",
        type: "pkcs8",
      })
      .toString("base64");
  } catch {
    signature = crypto
      .sign(null, Buffer.from(payloadJson, "utf8"), privateKey)
      .toString("base64");
  }

  // HMAC path (deprecated): kept for reference, not used in default flow.
  // const secret = process.env.LEDGER_ATTESTATION_SECRET;
  // if (!secret || secret.trim() === "") { throw new Error("LEDGER_ATTESTATION_SECRET is not set"); }
  // const signature = crypto.createHmac("sha256", secret).update(payloadJson).digest("hex");

  const res = NextResponse.json({
    ok: true,
    attestation: {
      ...payload,
      signature_algo: "ED25519_V1",
      signature,
      public_key: process.env.LEDGER_ED25519_PUBLIC_KEY,
    },
  });
  applySupabaseCookies(res, pendingCookies);
  return res;
}
