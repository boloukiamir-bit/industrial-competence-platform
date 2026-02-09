import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getActiveOrgFromSession } from "@/lib/server/activeOrg";
import { createSupabaseServerClient, applySupabaseCookies } from "@/lib/supabase/server";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const PILOT_REQUIRED_LEVEL = 3;

const SHIFT_ALIASES: Record<string, string[]> = {
  Day: ["Day", "1"],
  Evening: ["Evening", "2", "EM"],
  Night: ["Night", "FM", "3"],
};

function getAcceptedShiftCodes(shiftCode: string): string[] {
  const normalized = shiftCode.trim();
  return SHIFT_ALIASES[normalized] ?? [normalized];
}

type PilotRow = {
  org_id: string;
  site_id: string | null;
  station_id: string;
  station_code: string | null;
  station_name: string | null;
  area: string | null;
  employee_anst_id: string;
  actual_level: number | null;
  status: "NO_GO" | "WARNING" | "GO";
};

type SummaryRow = {
  org_id: string;
  site_id: string | null;
  shift_date: string;
  shift_code: string;
  station_id: string;
  station_code: string | null;
  station_name: string | null;
  area: string | null;
};

export type DrilldownRosterItem = {
  employee_anst_id: string;
  status: "NO_GO" | "WARNING" | "GO";
  actual_level: number | null;
  required_level: number;
  first_name?: string | null;
  last_name?: string | null;
};

export type DrilldownResponse = {
  ok: true;
  station: {
    id: string;
    code: string | null;
    name: string | null;
    area: string | null;
    shift_code: string;
    date: string;
  };
  roster: DrilldownRosterItem[];
  kpis: { no_go: number; warning: number; go: number; headcount: number };
  blockers: DrilldownRosterItem[];
  warnings: DrilldownRosterItem[];
};

function supabaseErrorPayload(err: unknown): { code: string; message: string; details?: string; hint?: string } {
  const e = err as { code?: string; message?: string; details?: string; hint?: string };
  return {
    code: e?.code ?? "unknown",
    message: e?.message ?? String(err),
    ...(e?.details != null && e.details !== "" && { details: e.details }),
    ...(e?.hint != null && e.hint !== "" && { hint: e.hint }),
  };
}

function errResponse(
  pendingCookies: Parameters<typeof applySupabaseCookies>[1],
  opts: {
    error: string;
    status?: number;
    supabase_error?: { code: string; message: string; details?: string; hint?: string };
    debug?: Record<string, unknown>;
  }
): NextResponse {
  const res = NextResponse.json(
    {
      ok: false,
      error: opts.error,
      ...(opts.supabase_error && { supabase_error: opts.supabase_error }),
      ...(opts.debug && Object.keys(opts.debug).length > 0 && { debug: opts.debug }),
    },
    { status: opts.status ?? 500 }
  );
  applySupabaseCookies(res, pendingCookies);
  return res;
}

export async function GET(request: NextRequest) {
  const debugMode = request.nextUrl.searchParams.get("debug") === "1";
  let pendingCookies: Parameters<typeof applySupabaseCookies>[1] = [];

  try {
    const { supabase, pendingCookies: pc } = await createSupabaseServerClient(request);
    pendingCookies = pc;
    const org = await getActiveOrgFromSession(request, supabase);
    if (!org.ok) {
      const res = NextResponse.json(
        { ok: false, error: org.error },
        { status: org.status }
      );
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const searchParams = request.nextUrl.searchParams;
    const date = searchParams.get("date")?.trim();
    const shiftCode =
      searchParams.get("shift_code")?.trim() || searchParams.get("shift")?.trim() || undefined;
    const stationId = searchParams.get("station_id")?.trim();

    if (!date || !shiftCode || !stationId) {
      const res = NextResponse.json(
        { ok: false, error: "date, shift_code, and station_id are required" },
        { status: 400 }
      );
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const acceptedShiftCodes = getAcceptedShiftCodes(shiftCode);
    const siteFilterMode = org.activeSiteId ? "active_or_null" : "no_filter";
    const debugInfo: Record<string, unknown> = {
      org_id: org.activeOrgId,
      site_id: org.activeSiteId,
      date,
      shift_code: shiftCode,
      station_id: stationId,
      acceptedShiftCodes,
      site_filter_mode: siteFilterMode,
    };

    // 1) Validate station and get station meta from v_cockpit_station_summary (org/site/date/shift/station_id)
    let summaryQuery = supabaseAdmin
      .from("v_cockpit_station_summary")
      .select("org_id, site_id, shift_date, shift_code, station_id, station_code, station_name, area")
      .eq("org_id", org.activeOrgId)
      .eq("shift_date", date)
      .in("shift_code", acceptedShiftCodes)
      .eq("station_id", stationId);
    if (org.activeSiteId) {
      summaryQuery = summaryQuery.or(`site_id.eq.${org.activeSiteId},site_id.is.null`);
    }
    const { data: summaryRows, error: summaryErr } = await summaryQuery.limit(1);

    if (summaryErr) {
      console.error("[cockpit/issues/drilldown] summary query error:", summaryErr);
      const payload = supabaseErrorPayload(summaryErr);
      if (debugMode) debugInfo.foundSummary = false;
      return errResponse(pendingCookies, {
        error: "Failed to fetch summary",
        supabase_error: payload,
        debug: debugMode ? debugInfo : undefined,
      });
    }

    const summaryRow = (summaryRows ?? [])[0] as SummaryRow | undefined;
    const foundSummary = Boolean(summaryRow);
    if (debugMode) debugInfo.foundSummary = foundSummary;

    // 2) Roster from v_roster_station_shift_drilldown_pilot (no date filter)
    let pilotQuery = supabaseAdmin
      .from("v_roster_station_shift_drilldown_pilot")
      .select("org_id, site_id, station_id, station_code, station_name, area, employee_anst_id, actual_level, status")
      .eq("org_id", org.activeOrgId)
      .eq("station_id", stationId)
      .in("shift_code", acceptedShiftCodes);
    if (org.activeSiteId) {
      pilotQuery = pilotQuery.or(`site_id.eq.${org.activeSiteId},site_id.is.null`);
    }
    const { data: pilotRows, error: pilotErr } = await pilotQuery
      .order("status", { ascending: false })
      .order("actual_level", { ascending: true, nullsFirst: true })
      .order("employee_anst_id", { ascending: true });

    if (pilotErr) {
      console.error("[cockpit/issues/drilldown] pilot query error:", pilotErr);
      const payload = supabaseErrorPayload(pilotErr);
      if (debugMode) debugInfo.roster_rows_count = 0;
      return errResponse(pendingCookies, {
        error: "Failed to fetch roster",
        supabase_error: payload,
        debug: debugMode ? debugInfo : undefined,
      });
    }

    const raw = (pilotRows ?? []) as PilotRow[];
    if (debugMode) debugInfo.roster_rows_count = raw.length;

    const anstIds = [...new Set(raw.map((r) => r.employee_anst_id))];
    let nameMap: Record<string, { first_name: string | null; last_name: string | null }> = {};
    if (anstIds.length > 0) {
      const { data: emps } = await supabaseAdmin
        .from("employees")
        .select("employee_number, first_name, last_name")
        .eq("org_id", org.activeOrgId)
        .in("employee_number", anstIds);
      if (emps) {
        for (const e of emps) {
          const code = (e as { employee_number?: string }).employee_number;
          if (code) {
            nameMap[code] = {
              first_name: (e as { first_name?: string | null }).first_name ?? null,
              last_name: (e as { last_name?: string | null }).last_name ?? null,
            };
          }
        }
      }
    }

    const roster: DrilldownRosterItem[] = raw.map((r) => {
      const names = nameMap[r.employee_anst_id];
      return {
        employee_anst_id: r.employee_anst_id,
        status: r.status,
        actual_level: r.actual_level,
        required_level: PILOT_REQUIRED_LEVEL,
        first_name: names?.first_name ?? null,
        last_name: names?.last_name ?? null,
      };
    });

    const no_go = roster.filter((r) => r.status === "NO_GO").length;
    const warning = roster.filter((r) => r.status === "WARNING").length;
    const go = roster.filter((r) => r.status === "GO").length;
    const headcount = roster.length;

    // Station meta: summary row when present, else first pilot row; if both empty, fetch from stations
    let stationCode: string | null = summaryRow?.station_code ?? raw[0]?.station_code ?? null;
    let stationName: string | null = summaryRow?.station_name ?? raw[0]?.station_name ?? null;
    let stationArea: string | null = summaryRow?.area ?? raw[0]?.area ?? null;
    if (stationCode === null && stationName === null && raw.length === 0) {
      const { data: st } = await supabaseAdmin
        .from("stations")
        .select("code, name, area_code, area, line")
        .eq("org_id", org.activeOrgId)
        .eq("id", stationId)
        .maybeSingle();
      if (st) {
        stationCode = (st as { code?: string | null }).code ?? null;
        stationName = (st as { name?: string | null }).name ?? null;
        stationArea =
          (st as { area_code?: string | null }).area_code ??
          (st as { area?: string | null }).area ??
          (st as { line?: string | null }).line ??
          null;
      }
    }
    const station = {
      id: stationId,
      code: stationCode,
      name: stationName,
      area: stationArea,
      shift_code: shiftCode,
      date,
    };

    const body: DrilldownResponse & { _debug?: Record<string, unknown> } = {
      ok: true,
      station,
      roster,
      kpis: { no_go, warning, go, headcount },
      blockers: roster.filter((r) => r.status === "NO_GO"),
      warnings: roster.filter((r) => r.status === "WARNING"),
    };
    if (debugMode) body._debug = debugInfo;

    const res = NextResponse.json(body, { status: 200 });
    applySupabaseCookies(res, pendingCookies);
    return res;
  } catch (err) {
    console.error("[cockpit/issues/drilldown] error:", err);
    return errResponse(pendingCookies, {
      error: err instanceof Error ? err.message : "Failed to load drilldown",
      supabase_error: supabaseErrorPayload(err),
    });
  }
}
