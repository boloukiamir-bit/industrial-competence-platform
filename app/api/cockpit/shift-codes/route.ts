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

type RowFetchResult = {
  rows: ShiftRow[];
  error: PostgrestError | null;
  source_table: string;
  selected_columns: string;
  site_scope_supported: boolean;
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

function hasMissingColumn(error: PostgrestError | null, column: string): boolean {
  const message = (error?.message ?? "").toLowerCase();
  return message.includes(column) && message.includes("column");
}

function isMissingRelation(error: PostgrestError | null, relation: string): boolean {
  const message = (error?.message ?? "").toLowerCase();
  return (
    message.includes(relation.toLowerCase()) &&
    (message.includes("relation") || message.includes("table")) &&
    (message.includes("does not exist") || message.includes("schema cache"))
  );
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

async function fetchScheduleRows(orgId: string): Promise<RowFetchResult> {
  const primary = await supabaseAdmin
    .from("shift_rules")
    .select("site_id, shift_code, shift_type")
    .eq("org_id", orgId);

  if (!primary.error) {
    return {
      rows: Array.isArray(primary.data) ? (primary.data as ShiftRow[]) : [],
      error: null,
      source_table: "shift_rules",
      selected_columns: "site_id, shift_code, shift_type",
      site_scope_supported: true,
    };
  }

  if (isMissingRelation(primary.error, "shift_rules")) {
    const legacy = await supabaseAdmin
      .from("pl_shift_templates")
      .select("shift_code, shift_type")
      .eq("org_id", orgId);
    if (!legacy.error) {
      return {
        rows: Array.isArray(legacy.data) ? (legacy.data as ShiftRow[]) : [],
        error: null,
        source_table: "pl_shift_templates",
        selected_columns: "shift_code, shift_type",
        site_scope_supported: false,
      };
    }
    const legacyFallback = await supabaseAdmin
      .from("pl_shift_templates")
      .select("shift_type")
      .eq("org_id", orgId);
    return {
      rows: Array.isArray(legacyFallback.data) ? (legacyFallback.data as ShiftRow[]) : [],
      error: legacyFallback.error,
      source_table: "pl_shift_templates",
      selected_columns: "shift_type",
      site_scope_supported: false,
    };
  }

  const missingSiteId = hasMissingColumn(primary.error, "site_id");
  const missingShiftCode = hasMissingColumn(primary.error, "shift_code");
  const missingShiftType = hasMissingColumn(primary.error, "shift_type");

  const fallbackColumns: string[] = [];
  if (!missingSiteId) fallbackColumns.push("site_id");
  if (!missingShiftCode) fallbackColumns.push("shift_code");
  if (!missingShiftType) fallbackColumns.push("shift_type");
  if (!fallbackColumns.includes("shift_code") && !fallbackColumns.includes("shift_type")) {
    fallbackColumns.push("shift_type");
  }

  const fallbackSelect = fallbackColumns.join(", ");
  const fallback = await supabaseAdmin
    .from("shift_rules")
    .select(fallbackSelect)
    .eq("org_id", orgId);

  if (!fallback.error) {
    return {
      rows: Array.isArray(fallback.data) ? (fallback.data as ShiftRow[]) : [],
      error: null,
      source_table: "shift_rules",
      selected_columns: fallbackSelect,
      site_scope_supported: fallbackColumns.includes("site_id"),
    };
  }

  const minimal = await supabaseAdmin
    .from("shift_rules")
    .select("shift_type")
    .eq("org_id", orgId);
  if (!minimal.error) {
    return {
      rows: Array.isArray(minimal.data) ? (minimal.data as ShiftRow[]) : [],
      error: null,
      source_table: "shift_rules",
      selected_columns: "shift_type",
      site_scope_supported: false,
    };
  }

  return {
    rows: [],
    error: minimal.error ?? fallback.error ?? primary.error,
    source_table: "shift_rules",
    selected_columns: "shift_type",
    site_scope_supported: false,
  };
}

/** Distinct shift_code values from schedule config + date shift instances, org/site scoped. */
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
          source_table: "shift_rules + shifts",
          reason: "missing_date_param",
          intermediate_counts: {
            schedule_org_total_rows: 0,
            schedule_org_site_total_rows: org.activeSiteId ? 0 : null,
            schedule_org_site_scope_total_rows: 0,
            schedule_derived_code_counts: {},
            org_date_total_shifts: 0,
            org_site_date_total_shifts: org.activeSiteId ? 0 : null,
            org_site_scope_total_shifts: 0,
            before_gating_derived_code_counts: {},
            union_total_shift_codes: 0,
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

    const scheduleResult = await fetchScheduleRows(org.activeOrgId);
    if (scheduleResult.error) {
      console.error("[cockpit/shift-codes] schedule query error:", scheduleResult.error);
    }
    const scheduleRows = scheduleResult.error ? [] : scheduleResult.rows;
    const scheduleSiteScopedRows =
      scheduleResult.site_scope_supported && org.activeSiteId
        ? scheduleRows.filter((r) => r.site_id == null || r.site_id === org.activeSiteId)
        : scheduleRows;
    const scheduleDistinctCodes = [
      ...new Set(
        scheduleSiteScopedRows
          .map((r) => deriveShiftCode(r))
          .filter((v): v is string => v.length > 0)
      ),
    ];

    if (!debugMode) {
      const shiftsResult = await fetchShiftRows({
        orgId: org.activeOrgId,
        date,
        activeSiteId: org.activeSiteId,
        applySiteScope: true,
      });

      if (shiftsResult.error) {
        console.error("[cockpit/shift-codes] shifts query error:", shiftsResult.error);
      }

      const dateDistinctCodes = shiftsResult.error
        ? []
        : [
            ...new Set(
              shiftsResult.rows
                .map((r) => deriveShiftCode(r))
                .filter((v): v is string => v.length > 0)
            ),
          ];

      const shift_codes = sortShiftCodes([
        ...new Set(
          [...scheduleDistinctCodes, ...dateDistinctCodes]
        ),
      ]);
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
    }

    const shiftRows = shiftsDebugQuery.error ? [] : shiftsDebugQuery.rows;
    const shiftSiteScopedRows = org.activeSiteId
      ? shiftRows.filter((r) => r.site_id == null || r.site_id === org.activeSiteId)
      : shiftRows;
    const shiftSiteOnlyRows = org.activeSiteId
      ? shiftRows.filter((r) => r.site_id === org.activeSiteId)
      : null;
    const nonEmptyShiftRows = shiftSiteScopedRows.filter((r) => deriveShiftCode(r).length > 0);
    const dateDistinctCodes = [
      ...new Set(nonEmptyShiftRows.map((r) => deriveShiftCode(r)).filter((v) => v.length > 0)),
    ];

    const scheduleSiteOnlyRows =
      scheduleResult.site_scope_supported && org.activeSiteId
        ? scheduleRows.filter((r) => r.site_id === org.activeSiteId)
        : null;

    const shift_codes = sortShiftCodes([
      ...new Set(
        [...scheduleDistinctCodes, ...dateDistinctCodes]
      ),
    ]);

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
      source_table: "shift_rules + shifts",
      source_tables: {
        schedule: {
          table: scheduleResult.source_table,
          selected_columns: scheduleResult.selected_columns,
          site_scope_supported: scheduleResult.site_scope_supported,
          query_error: scheduleResult.error?.message ?? null,
        },
        shifts: {
          table: "shifts",
          selected_columns: shiftsDebugQuery.selected_columns,
          site_scope_supported: true,
          query_error: shiftsDebugQuery.error?.message ?? null,
        },
      },
      intermediate_counts: {
        schedule_org_total_rows: scheduleRows.length,
        schedule_org_site_total_rows: scheduleSiteOnlyRows ? scheduleSiteOnlyRows.length : null,
        schedule_org_site_scope_total_rows: scheduleSiteScopedRows.length,
        schedule_derived_code_counts: countByDerivedCode(scheduleSiteScopedRows),
        org_date_total_shifts: shiftRows.length,
        org_site_date_total_shifts: shiftSiteOnlyRows ? shiftSiteOnlyRows.length : null,
        org_site_scope_total_shifts: shiftSiteScopedRows.length,
        before_gating_derived_code_counts: countByDerivedCode(shiftSiteScopedRows),
        union_total_shift_codes: shift_codes.length,
      },
      gating_steps: [
        {
          step: "site_scope_filter(site_id is null OR active_site_id)",
          applied: Boolean(org.activeSiteId),
          input_rows: shiftRows.length,
          output_rows: shiftSiteScopedRows.length,
          dropped_rows: shiftRows.length - shiftSiteScopedRows.length,
        },
        {
          step: "derived_code_non_empty_filter(prefer shift_code, fallback shift_type)",
          applied: true,
          input_rows: shiftSiteScopedRows.length,
          output_rows: nonEmptyShiftRows.length,
          dropped_rows: shiftSiteScopedRows.length - nonEmptyShiftRows.length,
          output_derived_code_counts: countByDerivedCode(nonEmptyShiftRows),
        },
        {
          step: "distinct_shift_code_projection",
          applied: true,
          input_rows: nonEmptyShiftRows.length,
          output_rows: dateDistinctCodes.length,
          dropped_rows: nonEmptyShiftRows.length - dateDistinctCodes.length,
        },
        {
          step: "union_with_schedule_codes",
          applied: true,
          input_rows: dateDistinctCodes.length,
          output_rows: shift_codes.length,
          added_rows: Math.max(0, shift_codes.length - dateDistinctCodes.length),
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
