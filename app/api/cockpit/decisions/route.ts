import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getOrgIdFromSession } from "@/lib/orgSession";
import { createSupabaseServerClient, applySupabaseCookies } from "@/lib/supabase/server";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export type CockpitDecisionRow = {
  shift_assignment_id: string;
  station_name: string;
  employee_name: string | null;
  decision_id: string | null;
  status: "active" | "none";
  root_cause: unknown;
  severity: "NO-GO" | "WARNING" | "RESOLVED";
};

function severity(
  decision: { root_cause?: unknown } | null
): "NO-GO" | "WARNING" | "RESOLVED" {
  if (!decision) return "RESOLVED";
  const rc = decision.root_cause;
  if (rc == null || typeof rc !== "object") return "NO-GO";
  const b = (rc as Record<string, unknown>).blocking;
  if (b === false || b === "false") return "WARNING";
  return "NO-GO";
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
    const date = searchParams.get("date");
    const shift = searchParams.get("shift");
    const line = searchParams.get("line") || "all";

    if (!date || !shift) {
      const res = NextResponse.json(
        { error: "date and shift are required" },
        { status: 400 }
      );
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

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

    let shiftsQuery = supabaseAdmin
      .from("shifts")
      .select("id")
      .eq("org_id", activeOrgId)
      .eq("shift_date", date)
      .eq("shift_type", shift);

    if (line !== "all") {
      shiftsQuery = shiftsQuery.eq("line", line);
    }

    const { data: shiftRows, error: shiftsErr } = await shiftsQuery;

    if (shiftsErr) {
      console.error("cockpit/decisions: shifts query error", shiftsErr);
      const res = NextResponse.json({ error: "Failed to fetch decisions" }, { status: 500 });
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const shiftIds = (shiftRows || []).map((r: { id: string }) => r.id).filter(Boolean);
    if (shiftIds.length === 0) {
      const res = NextResponse.json([]);
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const { data: saRows, error: saErr } = await supabaseAdmin
      .from("shift_assignments")
      .select("id, station:station_id(name), employee:employee_id(name)")
      .in("shift_id", shiftIds);

    if (saErr) {
      console.error("cockpit/decisions: shift_assignments query error", saErr);
      const res = NextResponse.json({ error: "Failed to fetch decisions" }, { status: 500 });
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const assignments = (saRows || []) as Array<{
      id: string;
      station?: { name?: string } | null;
      employee?: { name?: string } | null;
    }>;
    const saIds = assignments.map((a) => a.id).filter(Boolean);

    if (saIds.length === 0) {
      const res = NextResponse.json([]);
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    let edQuery = supabaseAdmin
      .from("execution_decisions")
      .select("id, target_id, root_cause")
      .eq("org_id", activeOrgId)
      .eq("status", "active")
      .eq("target_type", "shift_assignment")
      .in("target_id", saIds);

    if (activeSiteId) {
      edQuery = edQuery.or(`site_id.is.null,site_id.eq.${activeSiteId}`);
    }

    const { data: edRows, error: edErr } = await edQuery;

    if (edErr) {
      console.error("cockpit/decisions: execution_decisions query error", edErr);
      const res = NextResponse.json({ error: "Failed to fetch decisions" }, { status: 500 });
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const decisionByTarget = new Map<string, { id: string; root_cause: unknown }>();
    for (const row of (edRows || []) as Array<{ id: string; target_id: string; root_cause: unknown }>) {
      if (row.target_id) {
        decisionByTarget.set(row.target_id, { id: row.id, root_cause: row.root_cause });
      }
    }

    const rows: CockpitDecisionRow[] = assignments.map((a) => {
      const dec = decisionByTarget.get(a.id) || null;
      return {
        shift_assignment_id: a.id,
        station_name: (a.station?.name ?? "Station") as string,
        employee_name: (a.employee?.name ?? null) as string | null,
        decision_id: dec?.id ?? null,
        status: dec ? "active" : "none",
        root_cause: dec?.root_cause ?? null,
        severity: severity(dec ? { root_cause: dec.root_cause } : null),
      };
    });

    const res = NextResponse.json(rows);
    applySupabaseCookies(res, pendingCookies);
    return res;
  } catch (err) {
    console.error("cockpit/decisions error:", err);
    return NextResponse.json(
      { error: "Failed to load decisions" },
      { status: 500 }
    );
  }
}
