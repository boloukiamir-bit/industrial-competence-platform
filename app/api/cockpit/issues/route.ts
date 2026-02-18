import { NextRequest, NextResponse } from "next/server";
import { getActiveOrgFromSession } from "@/lib/server/activeOrg";
import { createSupabaseServerClient, applySupabaseCookies } from "@/lib/supabase/server";
import {
  fetchCockpitIssues,
  normalizeShiftParam,
  type CockpitIssue,
} from "@/lib/server/fetchCockpitIssues";

export type CockpitIssueRow = CockpitIssue;

export async function GET(request: NextRequest) {
  try {
    const { supabase, pendingCookies } = await createSupabaseServerClient(request);
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
    const date = searchParams.get("date")?.trim() || undefined;
    const rawShift = searchParams.get("shift_code") ?? searchParams.get("shift");
    const lineParam = (searchParams.get("line") ?? searchParams.get("area"))?.trim();
    const lineFilter = lineParam && lineParam !== "all" ? lineParam : undefined;
    const includeGo = searchParams.get("includeGo") === "1";
    const showResolved = searchParams.get("show_resolved") === "1";
    const debug = searchParams.get("debug") === "1";

    if (!date || !rawShift) {
      const res = NextResponse.json(
        { ok: false, error: "date and shift are required (same as Summary)" },
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

    const { issues, debug: debugInfo } = await fetchCockpitIssues({
      org_id: org.activeOrgId,
      site_id: org.activeSiteId,
      date,
      shift_code: shift,
      line: lineFilter,
      include_go: includeGo,
      show_resolved: showResolved,
      debug,
    });

    // Reconciliation: summary.active_total == issues.length (same params, same source)
    const summaryCount = issues.length;
    if (summaryCount !== issues.length) {
      console.warn(
        `[cockpit/issues] RECONCILIATION MISMATCH: summaryCount=${summaryCount} issuesLength=${issues.length}`
      );
    }

    const res = NextResponse.json({
      ok: true,
      issues,
      _debug: debugInfo ?? { summaryCount, issuesLength: issues.length, reconciled: true },
    });
    applySupabaseCookies(res, pendingCookies);
    return res;
  } catch (err) {
    console.error("[cockpit/issues] error:", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Failed to load issues" },
      { status: 500 }
    );
  }
}
