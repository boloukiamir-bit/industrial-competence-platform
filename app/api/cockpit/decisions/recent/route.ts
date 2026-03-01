/**
 * GET /api/cockpit/decisions/recent?date=YYYY-MM-DD&shift_code=Day|Evening|Night
 * Returns recent COCKPIT_INCIDENT decisions for the current SHIFT (auth: active org).
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseServerClient, applySupabaseCookies } from "@/lib/supabase/server";
import { getActiveOrgFromSession } from "@/lib/server/activeOrg";
import { normalizeShiftParam } from "@/lib/server/normalizeShift";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const LIMIT = 20;

export type RecentDecisionItem = {
  id: string;
  created_at: string;
  action: string;
  reason: string;
  issue_type: string;
  station_code: string | null;
};

export async function GET(request: NextRequest) {
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

  const url = new URL(request.url);
  const date = (url.searchParams.get("date") ?? "").trim().slice(0, 10);
  const shiftCodeRaw = (url.searchParams.get("shift_code") ?? "").trim();
  const normalized = normalizeShiftParam(shiftCodeRaw);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    const res = NextResponse.json(
      { ok: false, error: "date is required (YYYY-MM-DD)" },
      { status: 400 }
    );
    applySupabaseCookies(res, pendingCookies);
    return res;
  }
  if (!normalized) {
    const res = NextResponse.json(
      { ok: false, error: "shift_code must be Day, Evening, or Night" },
      { status: 400 }
    );
    applySupabaseCookies(res, pendingCookies);
    return res;
  }

  try {
    const { data: rows } = await supabaseAdmin
      .from("execution_decisions")
      .select("id, created_at, root_cause")
      .eq("org_id", org.activeOrgId)
      .eq("target_type", "COCKPIT_INCIDENT")
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(100);

    const decisions: RecentDecisionItem[] = [];
    for (const row of rows ?? []) {
      const rc = row.root_cause as Record<string, unknown> | null;
      if (!rc) continue;
      const shift = rc.shift as Record<string, unknown> | null;
      if (shift?.date !== date || shift?.shift_code !== normalized) continue;
      const decision = rc.decision as Record<string, unknown> | null;
      const issue = rc.issue as Record<string, unknown> | null;
      const action = (decision?.action as string) ?? "—";
      const reason = typeof decision?.reason === "string" ? decision.reason : "";
      const issueType =
        typeof issue?.type === "string"
          ? issue.type
          : typeof issue?.issue_type === "string"
            ? issue.issue_type
            : "—";
      const stationCode =
        typeof issue?.station_code === "string" ? issue.station_code : null;
      decisions.push({
        id: row.id as string,
        created_at: (row.created_at as string) ?? "",
        action,
        reason,
        issue_type: issueType,
        station_code: stationCode,
      });
      if (decisions.length >= LIMIT) break;
    }

    const res = NextResponse.json({ ok: true, decisions });
    applySupabaseCookies(res, pendingCookies);
    return res;
  } catch (err) {
    console.error("[cockpit/decisions/recent] error:", err);
    const res = NextResponse.json(
      { ok: false, error: "Failed to load decisions" },
      { status: 500 }
    );
    applySupabaseCookies(res, pendingCookies);
    return res;
  }
}
