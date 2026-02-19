import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getOrgIdFromSession } from "@/lib/orgSession";
import { createSupabaseServerClient, applySupabaseCookies } from "@/lib/supabase/server";
import { normalizeShift } from "@/lib/shift";
import { lineShiftTargetId } from "@/lib/shared/decisionIds";
import { getActiveOrgFromSession } from "@/lib/server/activeOrg";
import { normalizeShiftParam } from "@/lib/server/fetchCockpitIssues";
import { withGovernanceGate } from "@/lib/server/governance/withGovernanceGate";

function getAdmin(): ReturnType<typeof createClient> | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

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
      const res = NextResponse.json({ ok: false, error: session.error }, { status: session.status });
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const searchParams = request.nextUrl.searchParams;
    const date = searchParams.get("date");
    const shiftRaw = searchParams.get("shift");
    const shift = normalizeShift(shiftRaw);
    const line = searchParams.get("line") || "all";

    if (!date) {
      const res = NextResponse.json(
        { ok: false, error: "date is required", step: "validation" },
        { status: 400 }
      );
      applySupabaseCookies(res, pendingCookies);
      return res;
    }
    
    if (!shift) {
      const res = NextResponse.json(
        { ok: false, error: "Invalid shift parameter", step: "validation", details: { shift: shiftRaw } },
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
      const res = NextResponse.json(
        { ok: false, error: "No active organization", step: "auth" },
        { status: 403 }
      );
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
      .eq("shift_type", shift as string);

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
      .select("id, station:station_id(name, line), employee:employee_id(name)")
      .in("shift_id", shiftIds);

    if (saErr) {
      console.error("[cockpit/decisions] shift_assignments query error:", saErr);
      const res = NextResponse.json(
        { ok: false, error: "Failed to fetch decisions", step: "assignments", details: saErr.message },
        { status: 500 }
      );
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const assignments = (saRows || []) as Array<{
      id: string;
      station?: { name?: string; line?: string | null } | null;
      employee?: { name?: string } | null;
    }>;
    const saIds = assignments.map((a) => a.id).filter(Boolean);

    if (saIds.length === 0) {
      const res = NextResponse.json([]);
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const lineShiftIds = [...new Set(assignments.map((a) => a.station?.line).filter((l): l is string => Boolean(l)).map((l) => lineShiftTargetId(date, shift as string, l)))];

    let legacyEdQuery = supabaseAdmin
      .from("execution_decisions")
      .select("id, target_id, root_cause")
      .eq("org_id", activeOrgId)
      .eq("status", "active")
      .eq("target_type", "shift_assignment")
      .in("target_id", saIds);
    if (activeSiteId) {
      legacyEdQuery = legacyEdQuery.or(`site_id.is.null,site_id.eq.${activeSiteId}`);
    }
    const legacyRes = await legacyEdQuery;

    let lineShiftEdQuery =
      lineShiftIds.length > 0
        ? supabaseAdmin
            .from("execution_decisions")
            .select("id, target_id, root_cause")
            .eq("org_id", activeOrgId)
            .eq("status", "active")
            .eq("decision_type", "resolve_no_go")
            .eq("target_type", "line_shift")
            .in("target_id", lineShiftIds)
        : null;
    if (lineShiftEdQuery && activeSiteId) {
      lineShiftEdQuery = lineShiftEdQuery.or(`site_id.is.null,site_id.eq.${activeSiteId}`);
    }
    const lineShiftRes = lineShiftEdQuery ? await lineShiftEdQuery : { data: [] as unknown[], error: null };

    if (legacyRes.error) {
      console.error("cockpit/decisions: execution_decisions (legacy) query error", legacyRes.error);
      const res = NextResponse.json({ error: "Failed to fetch decisions" }, { status: 500 });
      applySupabaseCookies(res, pendingCookies);
      return res;
    }
    if (lineShiftRes.error) {
      console.error("cockpit/decisions: execution_decisions (line_shift) query error", lineShiftRes.error);
      const res = NextResponse.json({ error: "Failed to fetch decisions" }, { status: 500 });
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const decisionByTarget = new Map<string, { id: string; root_cause: unknown }>();
    for (const row of (legacyRes.data || []) as Array<{ id: string; target_id: string; root_cause: unknown }>) {
      if (row.target_id) {
        decisionByTarget.set(row.target_id, { id: row.id, root_cause: row.root_cause });
      }
    }
    const lineShiftResolvedIds = new Set(
      ((lineShiftRes.data || []) as Array<{ target_id: string }>).map((r) => r.target_id)
    );

    const rows: CockpitDecisionRow[] = assignments.map((a) => {
      const legacyDec = decisionByTarget.get(a.id) ?? null;
      const lineShiftId = a.station?.line ? lineShiftTargetId(date, shift, a.station.line) : null;
      const resolvedByLine = lineShiftId != null && lineShiftResolvedIds.has(lineShiftId);
      const dec = legacyDec ?? (resolvedByLine ? { id: null as string | null, root_cause: null } : null);
      return {
        shift_assignment_id: a.id,
        station_name: (a.station?.name ?? "Station") as string,
        employee_name: (a.employee?.name ?? null) as string | null,
        decision_id: dec?.id ?? null,
        status: legacyDec || resolvedByLine ? "active" : "none",
        root_cause: legacyDec?.root_cause ?? null,
        severity: severity(legacyDec ? { root_cause: legacyDec.root_cause } : resolvedByLine ? { root_cause: null } : null),
      };
    });

    const res = NextResponse.json(rows);
    applySupabaseCookies(res, pendingCookies);
    return res;
  } catch (err) {
    console.error("[cockpit/decisions] error:", err);
    const message = err instanceof Error ? err.message : "Failed to load decisions";
    return NextResponse.json(
      { ok: false, error: message, step: "exception" },
      { status: 500 }
    );
  }
}

/** POST: create/update line_shift decision. Governance gate via withGovernanceGate; 412 when blocked. */
export async function POST(request: NextRequest) {
  const { supabase, pendingCookies } = await createSupabaseServerClient(request);
  const org = await getActiveOrgFromSession(request, supabase);
  if (!org.ok) {
    const res = NextResponse.json({ ok: false, error: org.error }, { status: org.status });
    applySupabaseCookies(res, pendingCookies);
    return res;
  }

  const admin = getAdmin();
  if (!admin) {
    const res = NextResponse.json(
      { ok: false, error: "Governance not configured (service role required)" },
      { status: 503 }
    );
    applySupabaseCookies(res, pendingCookies);
    return res;
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    const res = NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
    applySupabaseCookies(res, pendingCookies);
    return res;
  }

  const b = body as Record<string, unknown>;
  const dateRaw = typeof b.date === "string" ? b.date.trim() : "";
  const shiftCodeRaw = typeof b.shift_code === "string" ? b.shift_code.trim() : "";
  const lineRaw = typeof b.line === "string" ? b.line.trim() : "all";
  const decisionRaw = typeof b.decision === "string" ? b.decision.trim().toLowerCase() : "acknowledged";
  const note = typeof b.note === "string" ? b.note.trim() || null : null;

  const dateMatch = dateRaw.match(/^\d{4}-\d{2}-\d{2}$/);
  const date = dateMatch ? dateRaw : "";
  const shift = normalizeShiftParam(shiftCodeRaw);
  const line = lineRaw || "all";

  if (!date) {
    const res = NextResponse.json(
      { ok: false, error: "date is required (YYYY-MM-DD)" },
      { status: 400 }
    );
    applySupabaseCookies(res, pendingCookies);
    return res;
  }
  if (!shift) {
    const res = NextResponse.json(
      { ok: false, error: "Invalid shift_code", details: { shift_code: shiftCodeRaw } },
      { status: 400 }
    );
    applySupabaseCookies(res, pendingCookies);
    return res;
  }

  const target_id = lineShiftTargetId(date, shift, line);

  const result = await withGovernanceGate({
    supabase,
    admin,
    orgId: org.activeOrgId,
    siteId: org.activeSiteId,
    context: {
      action: "COCKPIT_DECISION_CREATE",
      target_type: "line_shift",
      target_id,
      meta: {
        route: "/api/cockpit/decisions",
        date,
        shift_code: shift,
        line,
        decision: decisionRaw,
      },
      date,
      shift_code: shift,
    },
    handler: async () => {
      const root_cause = {
        type: "cockpit",
        message: "Line shift decision from Cockpit",
        date,
        shift,
        line,
        decision: decisionRaw,
      };
      const actions = { chosen: decisionRaw, note: note ?? undefined };

      const { data, error } = await supabaseAdmin
        .from("execution_decisions")
        .upsert(
          {
            org_id: org.activeOrgId,
            site_id: org.activeSiteId,
            decision_type: "resolve_no_go",
            target_type: "line_shift",
            target_id,
            reason: note,
            root_cause,
            actions,
            status: "active",
            created_by: org.userId,
          },
          { onConflict: "decision_type,target_type,target_id" }
        )
        .select("id, target_id, created_at")
        .single();

      if (error) {
        console.error("[cockpit/decisions] POST execution_decisions upsert error:", error);
        throw new Error(error.message);
      }

      return {
        decision_id: data?.id,
        target_id,
        created_at: data?.created_at,
      };
    },
  });

  if (!result.ok) {
    const res = NextResponse.json(
      { ok: false, error: result.error },
      { status: result.status }
    );
    applySupabaseCookies(res, pendingCookies);
    return res;
  }

  const res = NextResponse.json({
    ok: true,
    ...result.data,
  });
  applySupabaseCookies(res, pendingCookies);
  return res;
}
