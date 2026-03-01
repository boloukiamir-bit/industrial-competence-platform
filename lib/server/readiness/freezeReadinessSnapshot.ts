/**
 * Create or reuse a readiness snapshot (execution freeze) for a given org/site/date/shift.
 * Shared by POST /api/cockpit/readiness-freeze and execution decision creation.
 * Duplicate guard: same org/site/date/shift within 1 minute reuses existing snapshot.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeShiftParam } from "@/lib/server/normalizeShift";
import { computePayloadHash, PAYLOAD_HASH_ALGO } from "@/lib/server/readiness/snapshotPayloadHash";

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

  const payloadHash = computePayloadHash({
    org_id: orgId,
    site_id: siteId,
    shift_date: date,
    shift_code: normalized,
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
  });

  const { data: row, error: insertErr } = await admin
    .from("readiness_snapshots")
    .insert({
      org_id: orgId,
      site_id: siteId,
      shift_date: date,
      shift_code: normalized,
      legal_flag: legalFlag,
      ops_flag: opsFlag,
      overall_status: overallStatus,
      iri_score: iriScore,
      iri_grade: iriGrade,
      roster_employee_count: rosterCount,
      version: "IRI_V1",
      created_by: userId,
      overall_reason_codes: overallReasonCodes,
      legal_blockers_sample: legalBlockersSample,
      ops_no_go_stations_sample: opsNoGoStationsSample,
      engines,
      payload_hash: payloadHash,
      payload_hash_algo: PAYLOAD_HASH_ALGO,
    })
    .select("id, created_at")
    .single();

  if (insertErr) {
    throw new Error(`readiness_snapshots insert failed: ${insertErr.message}`);
  }

  return {
    snapshot_id: row.id,
    created_at: row.created_at,
    duplicate: false,
  };
}
