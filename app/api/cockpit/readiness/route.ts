/**
 * GET /api/cockpit/readiness?shift_id=<uuid>
 * Returns Industrial Readiness Index (v1.1) for the given shift.
 * Tenant scope: org_id and site_id from session only (never from query).
 */

import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient, applySupabaseCookies } from "@/lib/supabase/server";
import { getActiveOrgFromSession } from "@/lib/server/activeOrg";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type ReadinessStatus = "GO" | "WARNING" | "NO_GO";

export type ReadinessResponse = {
  ok: true;
  readiness: {
    readiness_score: number;
    status: ReadinessStatus;
    blocking_stations: string[];
    reason_codes: string[];
    calculated_at: string;
  };
};

function isUuid(value: string | null): value is string {
  return typeof value === "string" && value.length === 36 && UUID_RE.test(value);
}

export async function GET(request: NextRequest) {
  const { supabase, pendingCookies } = await createSupabaseServerClient(request);
  const org = await getActiveOrgFromSession(request, supabase);
  if (!org.ok) {
    const res = NextResponse.json({ error: org.error }, { status: org.status });
    applySupabaseCookies(res, pendingCookies);
    return res;
  }

  const shiftId = request.nextUrl.searchParams.get("shift_id")?.trim() ?? null;
  if (!shiftId || !isUuid(shiftId)) {
    const res = NextResponse.json(
      { error: "shift_id is required and must be a valid UUID" },
      { status: 400 }
    );
    applySupabaseCookies(res, pendingCookies);
    return res;
  }

  const activeSiteId = org.activeSiteId;
  if (!activeSiteId) {
    const res = NextResponse.json(
      { error: "Active site is required for readiness. Set active_site_id on your profile." },
      { status: 403 }
    );
    applySupabaseCookies(res, pendingCookies);
    return res;
  }

  const safeFallback = (): ReadinessResponse => ({
    ok: true,
    readiness: {
      readiness_score: 0,
      status: "NO_GO",
      blocking_stations: [],
      reason_codes: ["NO_ASSIGNMENTS"],
      calculated_at: new Date().toISOString(),
    },
  });

  const mapRowToReadiness = (row: {
    readiness_score?: number | null;
    status?: string | null;
    blocking_stations?: string[] | (unknown[]) | null;
    reason_codes?: string[] | null;
    calculated_at?: string | null;
  }): ReadinessResponse["readiness"] => {
    const status = (row.status === "GO" || row.status === "WARNING" || row.status === "NO_GO"
      ? row.status
      : "NO_GO") as ReadinessStatus;
    const blocking = Array.isArray(row.blocking_stations)
      ? row.blocking_stations.map((id) => (typeof id === "string" ? id : String(id)))
      : [];
    const reasonCodes = Array.isArray(row.reason_codes) ? row.reason_codes : [];
    return {
      readiness_score: Number(row.readiness_score ?? 0),
      status,
      blocking_stations: blocking,
      reason_codes: reasonCodes,
      calculated_at: row.calculated_at ? String(row.calculated_at) : new Date().toISOString(),
    };
  };

  const { data: rows, error } = await supabase.rpc("calculate_industrial_readiness", {
    p_org_id: org.activeOrgId,
    p_site_id: activeSiteId,
    p_shift_id: shiftId,
  });

  if (error) {
    const fallback = await supabase.rpc("calculate_industrial_readiness_v1", {
      p_org_id: org.activeOrgId,
      p_site_id: activeSiteId,
      p_shift_id: shiftId,
    });
    if (fallback.error) {
      const res = NextResponse.json(
        { ok: true, readiness: safeFallback().readiness },
        { status: 200 }
      );
      applySupabaseCookies(res, pendingCookies);
      return res;
    }
    const row = Array.isArray(fallback.data) ? fallback.data[0] : fallback.data;
    const readiness = mapRowToReadiness(row ?? {});
    const res = NextResponse.json({
      ok: true,
      readiness: { ...readiness, reason_codes: [] },
    } satisfies ReadinessResponse);
    applySupabaseCookies(res, pendingCookies);
    return res;
  }

  const row = Array.isArray(rows) ? rows[0] : rows;
  if (!row) {
    const res = NextResponse.json({
      ok: true,
      readiness: safeFallback().readiness,
    } satisfies ReadinessResponse);
    applySupabaseCookies(res, pendingCookies);
    return res;
  }

  const readiness = mapRowToReadiness(row);
  const res = NextResponse.json({
    ok: true,
    readiness,
  } satisfies ReadinessResponse);
  applySupabaseCookies(res, pendingCookies);
  return res;
}
