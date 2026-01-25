import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getOrgIdFromSession } from "@/lib/orgSession";

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
    const session = await getOrgIdFromSession(request);
    if (!session.success) {
      return NextResponse.json({ error: session.error }, { status: session.status });
    }

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("active_org_id, active_site_id")
      .eq("id", session.userId)
      .single();

    const activeOrgId = (profile?.active_org_id as string) || session.orgId;
    const activeSiteId = profile?.active_site_id as string | null | undefined;

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
      return NextResponse.json(
        { error: "Failed to fetch summary" },
        { status: 500 }
      );
    }

    const list = (rows || []) as Array<{ root_cause: unknown; actions: unknown }>;

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

    return NextResponse.json(body);
  } catch (err) {
    console.error("cockpit/summary error:", err);
    return NextResponse.json(
      { error: "Failed to load summary" },
      { status: 500 }
    );
  }
}
