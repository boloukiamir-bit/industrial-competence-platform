import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getOrgIdFromSession } from "@/lib/orgSession";
import { createSupabaseServerClient, applySupabaseCookies } from "@/lib/supabase/server";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export type CockpitSummaryResponse = {
  active_total: number;
  active_blocking: number;
  active_nonblocking: number;
  top_actions: Array<{ action: string; count: number }>;
  by_type: Array<{ type: string; count: number }>;
};

function isBlocking(rootCause: unknown): boolean {
  if (rootCause == null || typeof rootCause !== "object") return true;
  const rc = rootCause as Record<string, unknown>;
  const b = rc.blocking;
  if (b === false || b === "false") return false;
  return true;
}

function getActionStrings(actions: unknown): string[] {
  if (actions == null || typeof actions !== "object") return [];
  const a = actions as Record<string, unknown>;
  const selected = Array.isArray(a.selected) ? (a.selected as string[]) : [];
  const recommended = Array.isArray(a.recommended) ? (a.recommended as string[]) : [];
  return selected.length > 0 ? selected : recommended;
}

export async function GET(request: NextRequest) {
  try {
    const { supabase, pendingCookies } = await createSupabaseServerClient();
    const session = await getOrgIdFromSession(request, supabase);
    if (!session.success) {
      const res = NextResponse.json({ error: session.error }, { status: session.status });
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const searchParams = request.nextUrl.searchParams;
    const date = searchParams.get("date") || undefined;
    const shift = searchParams.get("shift") || undefined;
    const line = searchParams.get("line") || undefined;

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("active_org_id, active_site_id")
      .eq("id", session.userId)
      .single();

    if (!profile?.active_org_id) {
      const res = NextResponse.json({ error: "No active organization" }, { status: 403 });
      applySupabaseCookies(res, pendingCookies);
      return res;
    }
    const activeOrgId = profile.active_org_id as string;
    const activeSiteId = profile?.active_site_id as string | null | undefined;

    let list: Array<{ root_cause: unknown; actions: unknown }>;

    if (date || shift || line) {
      let shiftsQuery = supabaseAdmin
        .from("shifts")
        .select("id")
        .eq("org_id", activeOrgId);

      if (date) shiftsQuery = shiftsQuery.eq("shift_date", date);
      if (shift) shiftsQuery = shiftsQuery.eq("shift_type", shift);
      if (line) shiftsQuery = shiftsQuery.eq("line", line);

      const { data: shiftRows, error: shiftsErr } = await shiftsQuery;

      if (shiftsErr) {
        console.error("cockpit/summary: shifts query error", shiftsErr);
        const res = NextResponse.json({ error: "Failed to fetch summary" }, { status: 500 });
        applySupabaseCookies(res, pendingCookies);
        return res;
      }

      const shiftIds = (shiftRows || []).map((r: { id: string }) => r.id).filter(Boolean);
      if (shiftIds.length === 0) {
        const body: CockpitSummaryResponse = {
          active_total: 0,
          active_blocking: 0,
          active_nonblocking: 0,
          top_actions: [],
          by_type: [],
        };
        const res = NextResponse.json(body);
        applySupabaseCookies(res, pendingCookies);
        return res;
      }

      const { data: saRows, error: saErr } = await supabaseAdmin
        .from("shift_assignments")
        .select("id")
        .in("shift_id", shiftIds);

      if (saErr) {
        console.error("cockpit/summary: shift_assignments query error", saErr);
        const res = NextResponse.json({ error: "Failed to fetch summary" }, { status: 500 });
        applySupabaseCookies(res, pendingCookies);
        return res;
      }

      const saIds = (saRows || []).map((r: { id: string }) => r.id).filter(Boolean);
      if (saIds.length === 0) {
        const body: CockpitSummaryResponse = {
          active_total: 0,
          active_blocking: 0,
          active_nonblocking: 0,
          top_actions: [],
          by_type: [],
        };
        const res = NextResponse.json(body);
        applySupabaseCookies(res, pendingCookies);
        return res;
      }

      let edQuery = supabaseAdmin
        .from("execution_decisions")
        .select("root_cause, actions")
        .eq("org_id", activeOrgId)
        .eq("status", "active")
        .eq("target_type", "shift_assignment")
        .in("target_id", saIds);

      if (activeSiteId) {
        edQuery = edQuery.or(`site_id.is.null,site_id.eq.${activeSiteId}`);
      }

      const { data: rows, error } = await edQuery;
      if (error) {
        console.error("cockpit/summary: execution_decisions query error", error);
        const res = NextResponse.json({ error: "Failed to fetch summary" }, { status: 500 });
        applySupabaseCookies(res, pendingCookies);
        return res;
      }
      list = (rows || []) as Array<{ root_cause: unknown; actions: unknown }>;
    } else {
      let query = supabaseAdmin
        .from("execution_decisions")
        .select("root_cause, actions")
        .eq("org_id", activeOrgId)
        .eq("status", "active");

      if (activeSiteId) {
        query = query.or(`site_id.is.null,site_id.eq.${activeSiteId}`);
      }

      const { data: rows, error } = await query;

      if (error) {
        console.error("cockpit/summary: execution_decisions query error", error);
        const res = NextResponse.json(
          { error: "Failed to fetch summary" },
          { status: 500 }
        );
        applySupabaseCookies(res, pendingCookies);
        return res;
      }

      list = (rows || []) as Array<{ root_cause: unknown; actions: unknown }>;
    }

    let active_blocking = 0;
    let active_nonblocking = 0;
    const typeCounts = new Map<string, number>();
    const actionCounts = new Map<string, number>();

    for (const row of list) {
      if (isBlocking(row.root_cause)) {
        active_blocking += 1;
      } else {
        active_nonblocking += 1;
      }

      const rc = row.root_cause as Record<string, unknown> | null | undefined;
      const t = rc && typeof rc.type === "string" ? rc.type : "unknown";
      typeCounts.set(t, (typeCounts.get(t) || 0) + 1);

      for (const action of getActionStrings(row.actions)) {
        if (typeof action === "string" && action) {
          actionCounts.set(action, (actionCounts.get(action) || 0) + 1);
        }
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

    const body: CockpitSummaryResponse = {
      active_total: list.length,
      active_blocking,
      active_nonblocking,
      top_actions,
      by_type,
    };

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
