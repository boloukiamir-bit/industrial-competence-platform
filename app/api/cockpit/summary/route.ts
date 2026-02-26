import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseServerClient, applySupabaseCookies } from "@/lib/supabase/server";
import { fetchCockpitIssues } from "@/lib/server/fetchCockpitIssues";
import { normalizeShiftParam } from "@/lib/server/normalizeShift";
import { getActiveOrgFromSession } from "@/lib/server/activeOrg";
import { getFirstShiftIdForCockpit } from "@/lib/server/getCockpitReadiness";
import { evaluateEmployeeLegitimacy } from "@/lib/domain/legitimacy/evaluateEmployeeLegitimacy";
import type { ComplianceStatusForLegitimacy } from "@/lib/domain/legitimacy/evaluateEmployeeLegitimacy";
import { evaluateShiftLegitimacy } from "@/lib/domain/legitimacy/evaluateShiftLegitimacy";
import { evaluateEmployeeComplianceV2 } from "@/lib/server/compliance/evaluateEmployeeComplianceV2";
import { getInductionStatusForLegitimacy } from "@/lib/server/induction/inductionService";
import type { EvaluatorCellStatus } from "@/lib/server/compliance/evaluateEmployeeComplianceV2";

const DATA_SOURCE_VIEW = "v_cockpit_station_summary";

function evaluatorStatusToExpiryStatus(s: EvaluatorCellStatus): ComplianceStatusForLegitimacy {
  if (s === "overdue") return "ILLEGAL";
  if (s === "expiring") return "WARNING";
  return "VALID";
}

export type CockpitSummaryResponse = {
  active_total: number;
  active_blocking: number;
  active_nonblocking: number;
  top_actions: Array<{ action: string; count: number }>;
  by_type: Array<{ type: string; count: number }>;
  shift_legitimacy_status: "GO" | "WARNING" | "ILLEGAL";
  illegal_count: number;
  restricted_count: number;
  warning_count: number;
  contract_illegal_count: number;
  contract_warning_count: number;
  medical_illegal_count: number;
  medical_warning_count: number;
};

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const date = (url.searchParams.get("date") ?? "").trim();
  const shift_code =
    (url.searchParams.get("shift_code") ?? url.searchParams.get("shift") ?? "").trim();
  if (!date || !shift_code) {
    return NextResponse.json(
      { error: "date and shift are required" },
      { status: 400 }
    );
  }

  try {
    const { supabase, pendingCookies } = await createSupabaseServerClient(request);
    const org = await getActiveOrgFromSession(request, supabase);
    if (!org.ok) {
      const res = NextResponse.json(
        { error: org.error },
        { status: org.status }
      );
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const normalized = normalizeShiftParam(shift_code);
    if (!normalized) {
      const res = NextResponse.json(
        { error: "Invalid shift parameter" },
        { status: 400 }
      );
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const line = (url.searchParams.get("line") ?? "").trim();
    const lineFilter = line && line !== "all" ? line : undefined;
    const showResolved = url.searchParams.get("show_resolved") === "1";
    const debug = url.searchParams.get("debug") === "1";

    const { issues, debug: debugInfo } = await fetchCockpitIssues({
      org_id: org.activeOrgId,
      site_id: org.activeSiteId,
      date,
      shift_code: normalized,
      line: lineFilter,
      include_go: false,
      show_resolved: showResolved,
      debug,
    });

    let active_blocking = 0;
    let active_nonblocking = 0;
    const typeCounts = new Map<string, number>();
    const actionCounts = new Map<string, number>();

    for (const issue of issues) {
      if (issue.severity === "BLOCKING") {
        active_blocking += 1;
      } else {
        active_nonblocking += 1;
      }
      typeCounts.set(issue.type, (typeCounts.get(issue.type) || 0) + 1);
      if (issue.recommended_action) {
        actionCounts.set(
          issue.recommended_action,
          (actionCounts.get(issue.recommended_action) || 0) + 1
        );
      }
      for (const a of issue.decision_actions ?? []) {
        if (a) actionCounts.set(a, (actionCounts.get(a) || 0) + 1);
      }
    }

    const top_actions = Array.from(actionCounts.entries())
      .map(([action, count]) => ({ action, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    const by_type = Array.from(typeCounts.entries()).map(([type, count]) => ({
      type,
      count,
    }));

    let shift_legitimacy_status: "GO" | "WARNING" | "ILLEGAL" = "GO";
    let illegal_count = 0;
    let restricted_count = 0;
    let warning_count = 0;
    let contract_illegal_count = 0;
    let contract_warning_count = 0;
    let medical_illegal_count = 0;
    let medical_warning_count = 0;

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (supabaseUrl && serviceRoleKey) {
      const admin = createClient(supabaseUrl, serviceRoleKey);
      const shiftId = await getFirstShiftIdForCockpit(admin, {
        orgId: org.activeOrgId,
        siteId: org.activeSiteId,
        date,
        shift_code: normalized,
      });
      if (shiftId) {
        const { data: saRows } = await admin
          .from("shift_assignments")
          .select("employee_id")
          .eq("shift_id", shiftId)
          .eq("org_id", org.activeOrgId);
        const employeeIds = [
          ...new Set(
            (saRows ?? [])
              .map((r: { employee_id: string | null }) => r.employee_id)
              .filter((id): id is string => id != null && id !== "")
          ),
        ];
        const referenceDate = (() => {
          const d = new Date(date + "T00:00:00.000Z");
          return isNaN(d.getTime()) ? new Date() : d;
        })();
        const siteId = org.activeSiteId ?? null;
        const legitimacies: Array<"GO" | "WARNING" | "ILLEGAL" | "RESTRICTED"> = [];
        for (const employeeId of employeeIds) {
          const applicableRows = await evaluateEmployeeComplianceV2(admin, {
            orgId: org.activeOrgId,
            siteId,
            employeeId,
            referenceDate,
            expiringDaysDefault: 30,
          });
          const complianceStatuses: ComplianceStatusForLegitimacy[] = applicableRows.map((r) =>
            evaluatorStatusToExpiryStatus(r.status)
          );
          const inductionStatus = await getInductionStatusForLegitimacy(admin, {
            orgId: org.activeOrgId,
            siteId,
            employeeId,
          });
          const result = evaluateEmployeeLegitimacy({
            complianceStatuses,
            inductionStatus,
            disciplinaryRestriction: false,
          });
          legitimacies.push(result.legitimacyStatus);
        }
        const aggregated = evaluateShiftLegitimacy({ employeeLegitimacies: legitimacies });
        shift_legitimacy_status = aggregated.shiftStatus;
        illegal_count = aggregated.illegalCount;
        restricted_count = aggregated.restrictedCount;
        warning_count = aggregated.warningCount;
      }

      let contractQuery = admin
        .from("v_employee_contract_status")
        .select("status")
        .eq("org_id", org.activeOrgId)
        .in("status", ["ILLEGAL", "WARNING"]);
      if (org.activeSiteId) {
        contractQuery = contractQuery.or(`site_id.is.null,site_id.eq.${org.activeSiteId}`);
      }
      const { data: contractRows } = await contractQuery;
      contract_illegal_count = (contractRows ?? []).filter(
        (r: { status: string }) => r.status === "ILLEGAL"
      ).length;
      contract_warning_count = (contractRows ?? []).filter(
        (r: { status: string }) => r.status === "WARNING"
      ).length;
      illegal_count += contract_illegal_count;
      warning_count += contract_warning_count;

      let medicalQuery = admin
        .from("v_employee_medical_status")
        .select("status")
        .eq("org_id", org.activeOrgId)
        .in("status", ["ILLEGAL", "WARNING"]);
      if (org.activeSiteId) {
        medicalQuery = medicalQuery.or(`site_id.is.null,site_id.eq.${org.activeSiteId}`);
      }
      const { data: medicalRows } = await medicalQuery;
      medical_illegal_count = (medicalRows ?? []).filter(
        (r: { status: string }) => r.status === "ILLEGAL"
      ).length;
      medical_warning_count = (medicalRows ?? []).filter(
        (r: { status: string }) => r.status === "WARNING"
      ).length;
      illegal_count += medical_illegal_count;
      warning_count += medical_warning_count;
    }

    const body: CockpitSummaryResponse & { _debug?: unknown; _debug_error?: { message: string; code?: string } } = {
      active_total: issues.length,
      active_blocking,
      active_nonblocking,
      top_actions,
      by_type,
      shift_legitimacy_status,
      illegal_count,
      restricted_count,
      warning_count,
      contract_illegal_count,
      contract_warning_count,
      medical_illegal_count,
      medical_warning_count,
    };
    if (debugInfo) body._debug = debugInfo;

    const wantDebug = url.searchParams.get("_debug") === "1";
    if (wantDebug) {
      let raw_rows_count: number = 0;
      let raw_sample: Array<{ station_id: string; station_code: string | null; station_shift_status: string }> = [];
      try {
        let q = supabase
          .from(DATA_SOURCE_VIEW)
          .select("station_id, station_code, station_shift_status", { count: "exact", head: false })
          .eq("org_id", org.activeOrgId)
          .eq("shift_date", date)
          .eq("shift_code", normalized);
        if (org.activeSiteId) {
          q = q.or(`site_id.is.null,site_id.eq.${org.activeSiteId}`);
        }
        if (lineFilter) {
          q = q.eq("area", lineFilter);
        }
        const { count, data, error } = await q
          .order("severity_rank", { ascending: true })
          .order("area", { ascending: true, nullsFirst: false })
          .order("station_code", { ascending: true, nullsFirst: false })
          .limit(3);
        if (error) {
          body._debug_error = { message: error.message ?? "Debug query failed", code: error.code };
        } else {
          const sampleRows = data ?? null;
          raw_rows_count = count ?? 0;
          raw_sample = (sampleRows ?? []).map((r: { station_id: string; station_code: string | null; station_shift_status: string }) => ({
            station_id: r.station_id,
            station_code: r.station_code ?? null,
            station_shift_status: r.station_shift_status,
          }));
        }
      } catch (e) {
        const err = e as { message?: string; code?: string };
        body._debug_error = { message: typeof err?.message === "string" ? err.message : "Debug query failed", code: err?.code };
      }
      body._debug = {
        ...(typeof body._debug === "object" && body._debug !== null ? body._debug : {}),
        org_id: org.activeOrgId,
        site_id: org.activeSiteId,
        date,
        shift_code: normalized,
        line: lineFilter ?? "all",
        data_source: DATA_SOURCE_VIEW,
        raw_rows_count,
        raw_sample,
      };
    }

    const res = NextResponse.json(body);
    applySupabaseCookies(res, pendingCookies);
    return res;
  } catch (err) {
    console.error("cockpit/summary error:", err);
    const isProd =
      process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production";
    const payload: { error: string; _dev_error?: { message: string; name: string | null; code: string | null; hint: string | null } } = {
      error: "Failed to load summary",
    };
    if (!isProd) {
      const e = err as { message?: string; name?: string; code?: string; hint?: string } | undefined;
      payload._dev_error = {
        message: e?.message ?? String(err),
        name: e?.name ?? null,
        code: e?.code ?? null,
        hint: e?.hint ?? null,
      };
    }
    return NextResponse.json(payload, { status: 500 });
  }
}
