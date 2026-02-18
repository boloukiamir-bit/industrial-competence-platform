/**
 * GET /api/cockpit/readiness/drilldown?shift_id=<uuid>
 * Station-level breakdown for Industrial Readiness (explainability + actionability).
 * Same auth/tenant as /api/cockpit/readiness; org/site from session only.
 */
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient, applySupabaseCookies } from "@/lib/supabase/server";
import { getActiveOrgFromSession } from "@/lib/server/activeOrg";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUuid(v: string | null): v is string {
  return typeof v === "string" && v.length === 36 && UUID_RE.test(v);
}

export type ReadinessDrilldownStation = {
  station_id: string;
  station_code: string;
  station_name: string;
  station_score: number;
  station_reason_codes: string[];
  required_operators_count: number | null;
  eligible_operators_count: number;
  compliance_blockers_count: number;
  absence_ratio: number;
  criticality_factor: number;
};

export type ReadinessDrilldownResponse = { ok: true; stations: ReadinessDrilldownStation[] };

function mapRow(r: Record<string, unknown>): ReadinessDrilldownStation {
  return {
    station_id: String(r.station_id ?? ""),
    station_code: String(r.station_code ?? ""),
    station_name: String(r.station_name ?? ""),
    station_score: Number(r.station_score ?? 0),
    station_reason_codes: Array.isArray(r.station_reason_codes) ? r.station_reason_codes.map(String) : [],
    required_operators_count: r.required_operators_count != null ? Number(r.required_operators_count) : null,
    eligible_operators_count: Number(r.eligible_operators_count ?? 0),
    compliance_blockers_count: Number(r.compliance_blockers_count ?? 0),
    absence_ratio: Number(r.absence_ratio ?? 0),
    criticality_factor: Number(r.criticality_factor ?? 1),
  };
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
    const res = NextResponse.json({ error: "shift_id is required and must be a valid UUID" }, { status: 400 });
    applySupabaseCookies(res, pendingCookies);
    return res;
  }
  if (!org.activeSiteId) {
    const res = NextResponse.json(
      { error: "Active site is required for readiness. Set active_site_id on your profile." },
      { status: 403 }
    );
    applySupabaseCookies(res, pendingCookies);
    return res;
  }
  const { data: rows, error } = await supabase.rpc("calculate_industrial_readiness_station_breakdown", {
    p_org_id: org.activeOrgId,
    p_site_id: org.activeSiteId,
    p_shift_id: shiftId,
  });
  if (error) {
    const res = NextResponse.json({ ok: true, stations: [] });
    applySupabaseCookies(res, pendingCookies);
    return res;
  }
  const raw = Array.isArray(rows) ? rows : rows ? [rows] : [];
  const stations = raw.map((r) => mapRow(r as Record<string, unknown>));
  const res = NextResponse.json({ ok: true, stations });
  applySupabaseCookies(res, pendingCookies);
  return res;
}
