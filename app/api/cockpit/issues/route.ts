import { NextRequest, NextResponse } from "next/server";
import { getActiveOrgFromSession } from "@/lib/server/activeOrg";
import { createSupabaseServerClient, applySupabaseCookies } from "@/lib/supabase/server";
import { fetchCockpitIssues, fetchCockpitIssuesGlobal, type CockpitIssue } from "@/lib/server/fetchCockpitIssues";
import { normalizeShiftParam } from "@/lib/server/normalizeShift";

export type CockpitIssueRow = CockpitIssue;

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const mode = (url.searchParams.get("mode") ?? "shift").toLowerCase();
  const dateParam = (url.searchParams.get("date") ?? "").trim();
  const shift_code =
    (url.searchParams.get("shift_code") ?? url.searchParams.get("shift") ?? "").trim();

  const isGlobal = mode === "global";

  if (!isGlobal && (!dateParam || !shift_code)) {
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

    const normalized = shift_code ? normalizeShiftParam(shift_code) : undefined;
    if (!isGlobal && !normalized) {
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

    const { issues, debug: debugInfo } = isGlobal
      ? await fetchCockpitIssuesGlobal({
          org_id: org.activeOrgId,
          site_id: org.activeSiteId,
          line: lineFilter,
          include_go: includeGo,
          show_resolved: showResolved,
          debug,
        })
      : await fetchCockpitIssues({
          org_id: org.activeOrgId,
          site_id: org.activeSiteId,
          date: dateParam,
          shift_code: normalized!,
          line: lineFilter,
          include_go: includeGo,
          show_resolved: showResolved,
          debug,
        });

    const res = NextResponse.json({
      ok: true,
      issues,
      _debug: debugInfo ?? { summaryCount: issues.length, issuesLength: issues.length, reconciled: true },
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
