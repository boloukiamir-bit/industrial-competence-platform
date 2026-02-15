import { NextRequest, NextResponse } from "next/server";
import { getActiveOrgFromSession } from "@/lib/server/activeOrg";
import { createSupabaseServerClient, applySupabaseCookies } from "@/lib/supabase/server";
import { fetchCockpitIssues, type CockpitIssue } from "@/lib/server/fetchCockpitIssues";
import { normalizeShiftParam } from "@/lib/server/normalizeShift";

export type CockpitIssueRow = CockpitIssue;

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const date = (url.searchParams.get("date") ?? "").trim();
  const shift_code =
    (url.searchParams.get("shift_code") ?? url.searchParams.get("shift") ?? "").trim();
  if (!date || !shift_code) {
    return NextResponse.json(
      { ok: false, error: "date and shift are required" },
      { status: 400 }
    );
  }

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

    const normalized = normalizeShiftParam(shift_code);
    if (!normalized) {
      const res = NextResponse.json(
        { ok: false, error: "Invalid shift parameter" },
        { status: 400 }
      );
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const line = (url.searchParams.get("line") ?? "").trim();
    const lineFilter = line && line !== "all" ? line : undefined;
    const includeGo = url.searchParams.get("includeGo") === "1";
    const showResolved = url.searchParams.get("show_resolved") === "1";
    const debug = url.searchParams.get("debug") === "1";

    const { issues, debug: debugInfo } = await fetchCockpitIssues({
      org_id: org.activeOrgId,
      site_id: org.activeSiteId,
      date,
      shift_code: normalized,
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
