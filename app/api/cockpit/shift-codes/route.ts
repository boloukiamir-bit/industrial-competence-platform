import { NextRequest, NextResponse } from "next/server";
import { getActiveOrgFromSession } from "@/lib/server/activeOrg";
import { createSupabaseServerClient, applySupabaseCookies } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";
import type { PostgrestError } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const PREFERRED_ORDER = ["Day", "Evening", "Night", "S1", "S2", "S3"];
const EMPTY_DERIVED_CODE_KEY = "__null_or_empty__";

type ShiftRow = {
  shift_code?: string | null;
  shift_type?: string | null;
  site_id?: string | null;
};

function sortShiftCodes(codes: string[]): string[] {
  return [...codes].sort((a, b) => {
    const i = PREFERRED_ORDER.indexOf(a);
    const j = PREFERRED_ORDER.indexOf(b);
    if (i !== -1 && j !== -1) return i - j;
    if (i !== -1) return -1;
    if (j !== -1) return 1;
    return a.localeCompare(b);
  });
}

function normalizeText(value: string | null | undefined): string {
  if (typeof value !== "string") return "";
  return value.trim();
}

function deriveShiftCode(row: ShiftRow): string {
  const code = normalizeText(row.shift_code);
  if (code.length > 0) return code;
  return normalizeText(row.shift_type);
}

function countByDerivedCode(rows: ShiftRow[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const row of rows) {
    const code = deriveShiftCode(row);
    const key = code.length > 0 ? code : EMPTY_DERIVED_CODE_KEY;
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

function applySiteScopeQuery<T>(
  query: T,
  activeSiteId: string | null
): T {
  if (!activeSiteId) return query;
  return (query as { or: (expr: string) => T }).or(`site_id.is.null,site_id.eq.${activeSiteId}`);
}

function hasMissingColumn(error: PostgrestError | null, column: "shift_code" | "shift_type"): boolean {
  const message = (error?.message ?? "").toLowerCase();
  return message.includes(column) && message.includes("column");
}

async function fetchShiftRows(params: {
  orgId: string;
  date: string;
  activeSiteId: string | null;
  applySiteScope: boolean;
}): Promise<{ rows: ShiftRow[]; error: PostgrestError | null; selected_columns: string }> {
  const { orgId, date, activeSiteId, applySiteScope } = params;

  let primaryQuery = supabaseAdmin
    .from("shifts")
    .select("site_id, shift_code, shift_type")
    .eq("org_id", orgId)
    .eq("shift_date", date);
  if (applySiteScope) {
    primaryQuery = applySiteScopeQuery(primaryQuery, activeSiteId);
  }
  const primary = await primaryQuery;
  if (!primary.error) {
    return {
      rows: Array.isArray(primary.data) ? (primary.data as ShiftRow[]) : [],
      error: null,
      selected_columns: "site_id, shift_code, shift_type",
    };
  }

  if (hasMissingColumn(primary.error, "shift_code") && !hasMissingColumn(primary.error, "shift_type")) {
    let fallbackQuery = supabaseAdmin
      .from("shifts")
      .select("site_id, shift_type")
      .eq("org_id", orgId)
      .eq("shift_date", date);
    if (applySiteScope) {
      fallbackQuery = applySiteScopeQuery(fallbackQuery, activeSiteId);
    }
    const fallback = await fallbackQuery;
    return {
      rows: Array.isArray(fallback.data) ? (fallback.data as ShiftRow[]) : [],
      error: fallback.error,
      selected_columns: "site_id, shift_type",
    };
  }

  if (hasMissingColumn(primary.error, "shift_type") && !hasMissingColumn(primary.error, "shift_code")) {
    let fallbackQuery = supabaseAdmin
      .from("shifts")
      .select("site_id, shift_code")
      .eq("org_id", orgId)
      .eq("shift_date", date);
    if (applySiteScope) {
      fallbackQuery = applySiteScopeQuery(fallbackQuery, activeSiteId);
    }
    const fallback = await fallbackQuery;
    return {
      rows: Array.isArray(fallback.data) ? (fallback.data as ShiftRow[]) : [],
      error: fallback.error,
      selected_columns: "site_id, shift_code",
    };
  }

  return {
    rows: [],
    error: primary.error,
    selected_columns: "site_id, shift_code, shift_type",
  };
}

/** Distinct shift_code values from canonical shifts table for date, org and active site scope. */
export async function GET(request: NextRequest) {
  try {
    const debugMode = request.nextUrl.searchParams.get("debug") === "1";
    const { supabase, pendingCookies } = await createSupabaseServerClient(request);
    const org = await getActiveOrgFromSession(request, supabase);
    if (!org.ok) {
      const res = NextResponse.json({ ok: false, error: org.error }, { status: org.status });
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const date = request.nextUrl.searchParams.get("date")?.trim();
    if (!date) {
      const payload: { ok: true; shift_codes: string[]; debug?: unknown } = { ok: true, shift_codes: [] };
      if (debugMode) {
        payload.debug = {
          active_org_id: org.activeOrgId,
          active_site_id: org.activeSiteId ?? null,
          requested_date: date ?? null,
          source_table: "shifts",
          selected_columns: "site_id, shift_code, shift_type (auto-fallback when needed)",
          reason: "missing_date_param",
          intermediate_counts: {
            org_date_total_shifts: 0,
            org_site_date_total_shifts: org.activeSiteId ? 0 : null,
            org_site_scope_total_shifts: 0,
            before_gating_derived_code_counts: {},
          },
          gating_steps: [],
          final_shift_codes: [],
        };
        console.log("[cockpit/shift-codes][debug]", payload.debug);
      }
      const res = NextResponse.json(payload);
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    if (!debugMode) {
      const { rows, error } = await fetchShiftRows({
        orgId: org.activeOrgId,
        date,
        activeSiteId: org.activeSiteId,
        applySiteScope: true,
      });

      if (error) {
        console.error("[cockpit/shift-codes] shifts query error:", error);
        const res = NextResponse.json({ ok: true, shift_codes: [] });
        applySupabaseCookies(res, pendingCookies);
        return res;
      }

      const raw = [
        ...new Set(
          rows
            .map((r) => deriveShiftCode(r))
            .filter((v): v is string => v.length > 0)
        ),
      ];
      const shift_codes = sortShiftCodes(raw);
      const res = NextResponse.json({ ok: true, shift_codes });
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const shiftsDebugQuery = await fetchShiftRows({
      orgId: org.activeOrgId,
      date,
      activeSiteId: org.activeSiteId,
      applySiteScope: false,
    });

    if (shiftsDebugQuery.error) {
      console.error("[cockpit/shift-codes] shifts query error:", shiftsDebugQuery.error);
      const debug = {
        active_org_id: org.activeOrgId,
        active_site_id: org.activeSiteId ?? null,
        requested_date: date,
        source_table: "shifts",
        selected_columns: shiftsDebugQuery.selected_columns,
        query_error: shiftsDebugQuery.error.message,
        intermediate_counts: {
          org_date_total_shifts: 0,
          org_site_date_total_shifts: org.activeSiteId ? 0 : null,
          org_site_scope_total_shifts: 0,
          before_gating_derived_code_counts: {},
        },
        gating_steps: [],
        comparison: null,
        final_shift_codes: [],
      };
      console.log("[cockpit/shift-codes][debug]", debug);
      const res = NextResponse.json({ ok: true, shift_codes: [], debug });
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const rows = shiftsDebugQuery.rows;
    const siteScopedRows = org.activeSiteId
      ? rows.filter((r) => r.site_id == null || r.site_id === org.activeSiteId)
      : rows;
    const siteOnlyRows = org.activeSiteId
      ? rows.filter((r) => r.site_id === org.activeSiteId)
      : null;
    const nonEmptyRows = siteScopedRows.filter((r) => deriveShiftCode(r).length > 0);
    const distinctRaw = [...new Set(nonEmptyRows.map((r) => deriveShiftCode(r)).filter((v) => v.length > 0))];
    const shift_codes = sortShiftCodes(distinctRaw);

    const viewQuery = await supabaseAdmin
      .from("v_cockpit_station_summary")
      .select("site_id")
      .eq("org_id", org.activeOrgId)
      .eq("shift_date", date);
    const viewRows = Array.isArray(viewQuery.data) ? (viewQuery.data as Array<{ site_id?: string | null }>) : [];
    const viewSiteScopedCount = org.activeSiteId
      ? viewRows.filter((r) => r.site_id == null || r.site_id === org.activeSiteId).length
      : viewRows.length;

    const debug = {
      active_org_id: org.activeOrgId,
      active_site_id: org.activeSiteId ?? null,
      requested_date: date,
      source_table: "shifts",
      selected_columns: shiftsDebugQuery.selected_columns,
      intermediate_counts: {
        org_date_total_shifts: rows.length,
        org_site_date_total_shifts: siteOnlyRows ? siteOnlyRows.length : null,
        org_site_scope_total_shifts: siteScopedRows.length,
        before_gating_derived_code_counts: countByDerivedCode(siteScopedRows),
      },
      gating_steps: [
        {
          step: "site_scope_filter(site_id is null OR active_site_id)",
          applied: Boolean(org.activeSiteId),
          input_rows: rows.length,
          output_rows: siteScopedRows.length,
          dropped_rows: rows.length - siteScopedRows.length,
        },
        {
          step: "derived_code_non_empty_filter(prefer shift_code, fallback shift_type)",
          applied: true,
          input_rows: siteScopedRows.length,
          output_rows: nonEmptyRows.length,
          dropped_rows: siteScopedRows.length - nonEmptyRows.length,
          output_derived_code_counts: countByDerivedCode(nonEmptyRows),
        },
        {
          step: "distinct_shift_code_projection",
          applied: true,
          input_rows: nonEmptyRows.length,
          output_rows: shift_codes.length,
          dropped_rows: nonEmptyRows.length - shift_codes.length,
        },
        {
          step: "seeded_or_pilot_or_s1_gate",
          applied: false,
          input_rows: shift_codes.length,
          output_rows: shift_codes.length,
          dropped_rows: 0,
          note: "No seeded/pilot/S1-only gating is applied in this route.",
        },
      ],
      comparison: {
        v_cockpit_station_summary: viewQuery.error
          ? { query_error: viewQuery.error.message }
          : {
              org_date_total_rows: viewRows.length,
              org_site_scope_total_rows: viewSiteScopedCount,
            },
      },
      final_shift_codes: shift_codes,
    };
    console.log("[cockpit/shift-codes][debug]", debug);

    const res = NextResponse.json({ ok: true, shift_codes, debug });
    applySupabaseCookies(res, pendingCookies);
    return res;
  } catch (err) {
    console.error("[cockpit/shift-codes] error:", err);
    return NextResponse.json({ ok: false, error: "Failed to get shift codes" }, { status: 500 });
  }
}
