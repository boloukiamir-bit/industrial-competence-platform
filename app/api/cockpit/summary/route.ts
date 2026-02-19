import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseServerClient, applySupabaseCookies } from "@/lib/supabase/server";
import {
  fetchCockpitIssues,
  normalizeShiftParam,
} from "@/lib/server/fetchCockpitIssues";
import { getActiveOrgFromSession } from "@/lib/server/activeOrg";
import { getCockpitReadiness } from "@/lib/server/getCockpitReadiness";
import { toPolicyEnvelope, type PolicyEnvelope } from "@/lib/server/policyEnvelope";
import { assertExecutionLegitimacy } from "@/lib/server/governance/runtimeGuard";

export type CockpitSummaryResponse = {
  active_total: number;
  active_blocking: number;
  active_nonblocking: number;
  top_actions: Array<{ action: string; count: number }>;
  by_type: Array<{ type: string; count: number }>;
  readiness_status: "GO" | "WARNING" | "NO_GO";
  legitimacy_status: "LEGAL_STOP" | "OK";
  reason_codes: string[];
  /** Canonical envelope: always { units, compliance }. */
  policy: PolicyEnvelope;
};

export async function GET(request: NextRequest) {
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

    const searchParams = request.nextUrl.searchParams;
    const date = searchParams.get("date")?.trim() || undefined;
    const rawShift = searchParams.get("shift_code") ?? searchParams.get("shift");
    const lineParam = (searchParams.get("line") ?? searchParams.get("area"))?.trim();
    const lineFilter = lineParam && lineParam !== "all" ? lineParam : undefined;
    const showResolved = searchParams.get("show_resolved") === "1";
    const debug = searchParams.get("debug") === "1";

    if (!date || !rawShift) {
      const res = NextResponse.json(
        { error: "date and shift are required" },
        { status: 400 }
      );
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const shift = normalizeShiftParam(rawShift);
    if (!shift) {
      const res = NextResponse.json(
        { ok: false, error: "Invalid shift parameter", details: { shift: rawShift } },
        { status: 400 }
      );
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const admin =
      process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
        ? createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL,
            process.env.SUPABASE_SERVICE_ROLE_KEY
          )
        : null;

    const [readiness, { issues, debug: debugInfo }] = await Promise.all([
      getCockpitReadiness({
        supabase,
        admin,
        orgId: org.activeOrgId,
        siteId: org.activeSiteId,
        date,
        shift_code: shift,
      }),
      fetchCockpitIssues({
        org_id: org.activeOrgId,
        site_id: org.activeSiteId,
        date,
        shift_code: shift,
        line: lineFilter,
        include_go: false,
        show_resolved: showResolved,
        debug,
      }),
    ]);

    const runtime = assertExecutionLegitimacy({
      readiness_status: readiness.readiness_status,
      reason_codes: readiness.reason_codes ?? [],
    });
    if (!runtime.allowed) {
      const res = NextResponse.json(
        { ok: false, error: runtime.error },
        { status: runtime.status }
      );
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const useZeroCounts = readiness.legitimacy_status === "LEGAL_STOP";

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

    const body: CockpitSummaryResponse & { _debug?: unknown } = {
      active_total: useZeroCounts ? 0 : issues.length,
      active_blocking: useZeroCounts ? 0 : active_blocking,
      active_nonblocking: useZeroCounts ? 0 : active_nonblocking,
      top_actions: useZeroCounts ? [] : top_actions,
      by_type: useZeroCounts ? [] : by_type,
      readiness_status: readiness.readiness_status,
      legitimacy_status: readiness.legitimacy_status,
      reason_codes: readiness.reason_codes,
      policy: toPolicyEnvelope(readiness.policy, readiness.policy_compliance),
    };
    if (debugInfo) body._debug = debugInfo;

    const res = NextResponse.json(body);
    applySupabaseCookies(res, pendingCookies);
    return res;
  } catch (err) {
    console.error("cockpit/summary error:", err);
    return NextResponse.json(
      { error: "Failed to load summary" },
      { status: 500 }
    );
  }
}
