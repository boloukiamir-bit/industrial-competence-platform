/**
 * GET /api/cockpit/readiness-v3
 * Single canonical cockpit readiness: composes Legal (compliance matrix-v2) + Ops (competence matrix-v2)
 * deterministically. Returns one overall status for the selected date+shift.
 *
 * Required: date=YYYY-MM-DD, shift_code=Day|Evening|Night|S1|S2|S3
 * Optional: debug=1
 */
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient, applySupabaseCookies } from "@/lib/supabase/server";
import { getActiveOrgFromSession } from "@/lib/server/activeOrg";
import { normalizeShiftParam } from "@/lib/server/normalizeShift";
import { composeOverallStatus, composeReasonCodes, type LegalFlag, type OpsFlag } from "@/lib/server/readiness/composeReadinessV3";

function errorPayload(step: string, error: unknown, details?: string) {
  const msg = error instanceof Error ? error.message : String(error);
  return { ok: false as const, step, error: msg, ...(details != null && { details }) };
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const date = (url.searchParams.get("date") ?? "").trim();
  const shiftCodeParam = (url.searchParams.get("shift_code") ?? url.searchParams.get("shift") ?? "").trim();
  const wantDebug = url.searchParams.get("debug") === "1";

  if (!date || !shiftCodeParam) {
    return NextResponse.json(
      { ok: false, error: "SHIFT_CONTEXT_REQUIRED", message: "date and shift_code are required" },
      { status: 400 }
    );
  }

  const normalized = normalizeShiftParam(shiftCodeParam);
  if (!normalized) {
    return NextResponse.json(
      {
        ok: false,
        error: "Invalid shift parameter",
        message: "shift_code must be one of Day, Evening, Night, S1, S2, S3",
      },
      { status: 400 }
    );
  }

  const { supabase, pendingCookies } = await createSupabaseServerClient(request);
  const org = await getActiveOrgFromSession(request, supabase);
  if (!org.ok) {
    const res = NextResponse.json(errorPayload("getActiveOrg", org.error), { status: org.status });
    applySupabaseCookies(res, pendingCookies);
    return res;
  }

  const baseUrl = request.nextUrl.origin;
  const cookieHeader = request.headers.get("cookie") ?? "";

  const params = new URLSearchParams({ date, shift_code: normalized });
  if (wantDebug) params.set("debug", "1");

  const complianceUrl = `${baseUrl}/api/compliance/matrix-v2?${params.toString()}`;
  const competenceUrl = `${baseUrl}/api/competence/matrix-v2?${params.toString()}`;

  try {
    const [complianceRes, competenceRes] = await Promise.all([
      fetch(complianceUrl, { headers: { cookie: cookieHeader } }),
      fetch(competenceUrl, { headers: { cookie: cookieHeader } }),
    ]);

    if (!complianceRes.ok) {
      const res = NextResponse.json(
        errorPayload("compliance_matrix_v2", `HTTP ${complianceRes.status}`, await complianceRes.text()),
        { status: 500 }
      );
      applySupabaseCookies(res, pendingCookies);
      return res;
    }
    if (!competenceRes.ok) {
      const res = NextResponse.json(
        errorPayload("competence_matrix_v2", `HTTP ${competenceRes.status}`, await competenceRes.text()),
        { status: 500 }
      );
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const complianceJson = (await complianceRes.json()) as {
      ok?: boolean;
      readiness_flag?: string;
      kpis?: Record<string, number>;
      by_requirement?: Array<{ requirement_code: string; requirement_name: string; blocking_affected_employee_count: number }>;
      _debug?: unknown;
    };
    const competenceJson = (await competenceRes.json()) as {
      ok?: boolean;
      ops_readiness_flag?: string;
      kpis?: Record<string, number>;
      by_station?: Array<{ station_code: string; station_name: string; status: string }>;
      _debug?: unknown;
    };

    if (!complianceJson?.ok || !competenceJson?.ok) {
      const res = NextResponse.json(
        errorPayload("engine", "One or both matrix-v2 responses had ok !== true"),
        { status: 500 }
      );
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const legalFlag = (complianceJson.readiness_flag === "LEGAL_GO" ||
      complianceJson.readiness_flag === "LEGAL_WARNING" ||
      complianceJson.readiness_flag === "LEGAL_NO_GO"
      ? complianceJson.readiness_flag
      : "LEGAL_GO") as LegalFlag;
    const opsFlag = (competenceJson.ops_readiness_flag === "OPS_GO" ||
      competenceJson.ops_readiness_flag === "OPS_WARNING" ||
      competenceJson.ops_readiness_flag === "OPS_NO_GO"
      ? competenceJson.ops_readiness_flag
      : "OPS_GO") as OpsFlag;

    const overallStatus = composeOverallStatus(legalFlag, opsFlag);
    const reasonCodes = composeReasonCodes(legalFlag, opsFlag);

    const legalBlockers = (complianceJson.by_requirement ?? [])
      .filter((r) => (r.blocking_affected_employee_count ?? 0) > 0)
      .slice(0, 10)
      .map((r) => ({
        requirement_code: r.requirement_code,
        requirement_name: r.requirement_name ?? r.requirement_code,
        blocking_affected_employee_count: r.blocking_affected_employee_count,
      }));

    const opsNoGoStations = (competenceJson.by_station ?? [])
      .filter((s) => s.status === "OPS_NO_GO")
      .slice(0, 10)
      .map((s) => ({
        station_code: s.station_code,
        station_name: s.station_name ?? s.station_code,
      }));

    const rosterCount =
      competenceJson._debug && typeof competenceJson._debug === "object" && "roster_employee_ids_count" in competenceJson._debug
        ? (competenceJson._debug as { roster_employee_ids_count?: number }).roster_employee_ids_count
        : complianceJson._debug && typeof complianceJson._debug === "object" && "scope_inputs" in complianceJson._debug
          ? (complianceJson._debug as { scope_inputs?: { roster_employee_ids_count?: number } }).scope_inputs?.roster_employee_ids_count
          : undefined;

    const body = {
      ok: true as const,
      date,
      shift_code: normalized,
      legal: {
        flag: legalFlag,
        kpis: complianceJson.kpis ?? {},
      },
      ops: {
        flag: opsFlag,
        kpis: competenceJson.kpis ?? {},
      },
      overall: {
        status: overallStatus,
        reason_codes: reasonCodes,
      },
      samples: {
        legal_blockers: legalBlockers,
        ops_no_go_stations: opsNoGoStations,
      },
      _debug: wantDebug
        ? {
            roster_employee_ids_count: rosterCount,
            sources: ["/api/compliance/matrix-v2", "/api/competence/matrix-v2"],
            compliance: complianceJson._debug,
            competence: competenceJson._debug,
          }
        : undefined,
    };

    const res = NextResponse.json(body);
    applySupabaseCookies(res, pendingCookies);
    return res;
  } catch (err) {
    const res = NextResponse.json(errorPayload("unexpected", err), { status: 500 });
    applySupabaseCookies(res, pendingCookies);
    return res;
  }
}
