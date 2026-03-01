/**
 * Create or reuse a readiness snapshot (execution freeze) for a given org/site/date/shift.
 * Shared by POST /api/cockpit/readiness-freeze and execution decision creation.
 * Duplicate guard: same org/site/date/shift within 1 minute reuses existing snapshot.
 * Hash is computed in app (Node) as single source of truth; DB RPC stores provided hash.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeShiftParam } from "@/lib/server/normalizeShift";
import {
  HASH_ALGO_V2,
  computePayloadHash,
  type CanonicalPayloadInput,
} from "@/lib/server/readiness/snapshotPayloadHash";

const DUPLICATE_WINDOW_MINUTES = 1;

export type FreezeReadinessSnapshotResult = {
  snapshot_id: string;
  created_at: string;
  duplicate: boolean;
};

export type FreezeReadinessSnapshotParams = {
  admin: SupabaseClient;
  orgId: string;
  siteId: string;
  userId: string;
  date: string;
  shiftCode: string;
  baseUrl: string;
  cookieHeader: string;
};

/**
 * Fetch readiness-v3 and iri-v1, then create or reuse a readiness_snapshot row.
 * Uses same 1-minute duplicate window as readiness-freeze.
 * @throws on fetch failure or invalid response
 */
export async function createOrReuseReadinessSnapshot(
  params: FreezeReadinessSnapshotParams
): Promise<FreezeReadinessSnapshotResult> {
  const { admin, orgId, siteId, userId, date, shiftCode, baseUrl, cookieHeader } = params;
  const normalized = normalizeShiftParam(shiftCode);
  if (!normalized) {
    throw new Error(`Invalid shift_code: ${shiftCode}`);
  }

  const searchParams = new URLSearchParams({ date, shift_code: normalized });
  const [readinessRes, iriRes] = await Promise.all([
    fetch(`${baseUrl}/api/cockpit/readiness-v3?${searchParams.toString()}`, { headers: { cookie: cookieHeader } }),
    fetch(`${baseUrl}/api/cockpit/iri-v1?${searchParams.toString()}`, { headers: { cookie: cookieHeader } }),
  ]);

  if (!readinessRes.ok) {
    throw new Error(`readiness-v3 failed: ${readinessRes.status}`);
  }
  if (!iriRes.ok) {
    throw new Error(`iri-v1 failed: ${iriRes.status}`);
  }

  const v3 = (await readinessRes.json()) as {
    ok?: boolean;
    legal?: { flag?: string; kpis?: Record<string, number> };
    ops?: { flag?: string; kpis?: Record<string, number> };
    overall?: { status?: string; reason_codes?: string[] };
    samples?: {
      legal_blockers?: Array<{
        requirement_code?: string;
        requirement_name?: string;
        blocking_affected_employee_count?: number;
      }>;
      ops_no_go_stations?: Array<{ station_code?: string; station_name?: string }>;
    };
  };
  const iri = (await iriRes.json()) as {
    ok?: boolean;
    iri_score?: number;
    iri_grade?: string;
  };

  if (!v3?.ok || !v3.legal || !v3.ops || !iri?.ok) {
    throw new Error("readiness-v3 or iri-v1 response invalid");
  }

  const legalFlag =
    v3.legal.flag === "LEGAL_GO" || v3.legal.flag === "LEGAL_WARNING" || v3.legal.flag === "LEGAL_NO_GO"
      ? v3.legal.flag
      : "LEGAL_GO";
  const opsFlag =
    v3.ops.flag === "OPS_GO" || v3.ops.flag === "OPS_WARNING" || v3.ops.flag === "OPS_NO_GO"
      ? v3.ops.flag
      : "OPS_GO";
  const overallStatus = v3.overall?.status ?? "GO";
  const iriScore = typeof iri.iri_score === "number" ? iri.iri_score : 0;
  const iriGrade = typeof iri.iri_grade === "string" ? iri.iri_grade : "F";
  const rosterCount = Math.max(
    0,
    v3.legal.kpis?.roster_employee_count ?? v3.ops.kpis?.roster_employee_count ?? 0
  );

  const overallReasonCodes = Array.isArray(v3.overall?.reason_codes)
    ? v3.overall.reason_codes.filter((c): c is string => typeof c === "string")
    : [];
  const legalBlockersSample = Array.isArray(v3.samples?.legal_blockers)
    ? v3.samples.legal_blockers
    : [];
  const opsNoGoStationsSample = Array.isArray(v3.samples?.ops_no_go_stations)
    ? v3.samples.ops_no_go_stations
    : [];
  const engines = {
    readiness: "V3",
    iri: "IRI_V1",
    compliance: "MATRIX_V2",
    competence: "MATRIX_V2",
  };

  const windowStart = new Date(Date.now() - DUPLICATE_WINDOW_MINUTES * 60 * 1000).toISOString();
  const { data: recent } = await admin
    .from("readiness_snapshots")
    .select("id, created_at")
    .eq("org_id", orgId)
    .eq("site_id", siteId)
    .eq("shift_date", date)
    .eq("shift_code", normalized)
    .gte("created_at", windowStart)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (recent?.id) {
    return {
      snapshot_id: recent.id,
      created_at: (recent as { created_at: string }).created_at,
      duplicate: true,
    };
  }

  const { data: headRows, error: headErr } = await admin.rpc("get_next_readiness_snapshot_chain_head", {
    p_org_id: orgId,
  });
  if (headErr) {
    throw new Error(`get_next_readiness_snapshot_chain_head failed: ${headErr.message}`);
  }
  const head = Array.isArray(headRows) && headRows.length > 0 ? headRows[0] : null;
  if (!head || head.next_position == null) {
    throw new Error("get_next_readiness_snapshot_chain_head returned no row");
  }
  const nextPosition = Number(head.next_position);
  const prevHash = head.prev_hash != null ? String(head.prev_hash).trim() : null;

  const canonicalInput: CanonicalPayloadInput = {
    org_id: orgId,
    site_id: siteId,
    shift_date: date,
    shift_code: normalized,
    previous_hash: prevHash || null,
    chain_position: nextPosition,
    legal_flag: legalFlag,
    ops_flag: opsFlag,
    overall_status: overallStatus,
    overall_reason_codes: overallReasonCodes,
    iri_score: iriScore,
    iri_grade: iriGrade,
    roster_employee_count: rosterCount,
    version: "IRI_V1",
    engines,
    legal_blockers_sample: legalBlockersSample,
    ops_no_go_stations_sample: opsNoGoStationsSample,
  };
  const payloadHash = computePayloadHash(canonicalInput, HASH_ALGO_V2);

  const { data: rows, error: rpcErr } = await admin.rpc("insert_readiness_snapshot_chained", {
    p_org_id: orgId,
    p_site_id: siteId,
    p_shift_date: date,
    p_shift_code: normalized,
    p_legal_flag: legalFlag,
    p_ops_flag: opsFlag,
    p_overall_status: overallStatus,
    p_iri_score: iriScore,
    p_iri_grade: iriGrade,
    p_roster_employee_count: rosterCount,
    p_version: "IRI_V1",
    p_created_by: userId,
    p_overall_reason_codes: overallReasonCodes,
    p_legal_blockers_sample: legalBlockersSample,
    p_ops_no_go_stations_sample: opsNoGoStationsSample,
    p_engines: engines,
    p_chain_position: nextPosition,
    p_previous_hash: prevHash,
    p_payload_hash: payloadHash,
    p_payload_hash_algo: HASH_ALGO_V2,
  });

  if (rpcErr) {
    throw new Error(`readiness_snapshots insert failed: ${rpcErr.message}`);
  }

  const row = Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
  if (!row || row.id == null) {
    throw new Error("insert_readiness_snapshot_chained did not return id");
  }

  return {
    snapshot_id: row.id,
    created_at: row.created_at ?? new Date().toISOString(),
    duplicate: false,
  };
}

/** Payload for creating a snapshot without fetching readiness-v3/iri-v1 (e.g. dev force-snapshot). */
export type ReadinessSnapshotPayload = {
  legal_flag: string;
  ops_flag: string;
  overall_status: string;
  iri_score: number;
  iri_grade: string;
  roster_employee_count: number;
  version: string;
  overall_reason_codes: string[];
  legal_blockers_sample: unknown[];
  ops_no_go_stations_sample: unknown[];
  engines: Record<string, unknown>;
};

export type CreateReadinessSnapshotWithPayloadParams = {
  admin: SupabaseClient;
  orgId: string;
  siteId: string;
  userId: string;
  date: string;
  shiftCode: string;
  payload: ReadinessSnapshotPayload;
};

/**
 * Create or reuse a readiness snapshot using an explicit payload (no readiness-v3/iri-v1 fetch).
 * Same 1-minute duplicate window and insert_readiness_snapshot_chained RPC as createOrReuseReadinessSnapshot.
 * For dev/debug use (e.g. force-snapshot endpoint).
 */
export async function createReadinessSnapshotWithPayload(
  params: CreateReadinessSnapshotWithPayloadParams
): Promise<FreezeReadinessSnapshotResult> {
  const { admin, orgId, siteId, userId, date, shiftCode, payload } = params;
  const normalized = normalizeShiftParam(shiftCode);
  if (!normalized) {
    throw new Error(`Invalid shift_code: ${shiftCode}`);
  }

  const windowStart = new Date(Date.now() - DUPLICATE_WINDOW_MINUTES * 60 * 1000).toISOString();
  const { data: recent } = await admin
    .from("readiness_snapshots")
    .select("id, created_at")
    .eq("org_id", orgId)
    .eq("site_id", siteId)
    .eq("shift_date", date)
    .eq("shift_code", normalized)
    .gte("created_at", windowStart)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (recent?.id) {
    return {
      snapshot_id: recent.id,
      created_at: (recent as { created_at: string }).created_at,
      duplicate: true,
    };
  }

  const { data: headRows, error: headErr } = await admin.rpc("get_next_readiness_snapshot_chain_head", {
    p_org_id: orgId,
  });
  if (headErr) {
    throw new Error(`get_next_readiness_snapshot_chain_head failed: ${headErr.message}`);
  }
  const head = Array.isArray(headRows) && headRows.length > 0 ? headRows[0] : null;
  if (!head || head.next_position == null) {
    throw new Error("get_next_readiness_snapshot_chain_head returned no row");
  }
  const nextPosition = Number(head.next_position);
  const prevHash = head.prev_hash != null ? String(head.prev_hash).trim() : null;

  const canonicalInput: CanonicalPayloadInput = {
    org_id: orgId,
    site_id: siteId,
    shift_date: date,
    shift_code: normalized,
    previous_hash: prevHash || null,
    chain_position: nextPosition,
    legal_flag: payload.legal_flag,
    ops_flag: payload.ops_flag,
    overall_status: payload.overall_status,
    overall_reason_codes: payload.overall_reason_codes,
    iri_score: payload.iri_score,
    iri_grade: payload.iri_grade,
    roster_employee_count: payload.roster_employee_count,
    version: payload.version,
    engines: payload.engines,
    legal_blockers_sample: payload.legal_blockers_sample,
    ops_no_go_stations_sample: payload.ops_no_go_stations_sample,
  };
  const payloadHash = computePayloadHash(canonicalInput, HASH_ALGO_V2);

  const { data: rows, error: rpcErr } = await admin.rpc("insert_readiness_snapshot_chained", {
    p_org_id: orgId,
    p_site_id: siteId,
    p_shift_date: date,
    p_shift_code: normalized,
    p_legal_flag: payload.legal_flag,
    p_ops_flag: payload.ops_flag,
    p_overall_status: payload.overall_status,
    p_iri_score: payload.iri_score,
    p_iri_grade: payload.iri_grade,
    p_roster_employee_count: payload.roster_employee_count,
    p_version: payload.version,
    p_created_by: userId,
    p_overall_reason_codes: payload.overall_reason_codes,
    p_legal_blockers_sample: payload.legal_blockers_sample,
    p_ops_no_go_stations_sample: payload.ops_no_go_stations_sample,
    p_engines: payload.engines,
    p_chain_position: nextPosition,
    p_previous_hash: prevHash,
    p_payload_hash: payloadHash,
    p_payload_hash_algo: HASH_ALGO_V2,
  });

  if (rpcErr) {
    throw new Error(`readiness_snapshots insert failed: ${rpcErr.message}`);
  }

  const row = Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
  if (!row || row.id == null) {
    throw new Error("insert_readiness_snapshot_chained did not return id");
  }

  return {
    snapshot_id: row.id,
    created_at: row.created_at ?? new Date().toISOString(),
    duplicate: false,
  };
}
