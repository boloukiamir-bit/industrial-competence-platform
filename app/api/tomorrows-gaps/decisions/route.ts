import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getOrgIdFromSession } from "@/lib/orgSession";
import { createSupabaseServerClient, applySupabaseCookies } from "@/lib/supabase/server";
import { pool } from "@/lib/db/pool";
import { lineShiftTargetId } from "@/lib/shared/decisionIds";
import { normalizeShiftTypeOrDefault } from "@/lib/shift";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const ALLOWED_DECISION_TYPES = [
  "swap_operator",
  "call_in",
  "accept_risk",
  "escalate",
  "acknowledged",
] as const;

export async function POST(request: NextRequest) {
  try {
    const { supabase, pendingCookies } = await createSupabaseServerClient();
    const session = await getOrgIdFromSession(request, supabase);
    if (!session.success) {
      const res = NextResponse.json({ error: session.error }, { status: session.status });
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("active_org_id, active_site_id")
      .eq("id", session.userId)
      .single();
    if (profileError) {
      throw profileError;
    }
    if (!profile?.active_org_id) {
      const res = NextResponse.json({ error: "No active organization" }, { status: 403 });
      applySupabaseCookies(res, pendingCookies);
      return res;
    }
    const activeOrgId = profile.active_org_id as string;
    const activeSiteId = profile?.active_site_id as string | null | undefined;
    const userId = session.userId;

    const body = await request.json().catch(() => ({}));
    const date = typeof body.date === "string" ? body.date.trim().slice(0, 10) : "";
    const shiftRaw = typeof body.shift === "string" ? body.shift.trim() : "";
    const shift = shiftRaw ? normalizeShiftTypeOrDefault(shiftRaw) : "";
    const line = typeof body.line === "string" ? body.line.trim() : "";
    const decision_type = typeof body.decision_type === "string" ? body.decision_type.trim() : "";
    const note = typeof body.note === "string" ? body.note.trim() : null;

    if (!date || !shift || !line) {
      const res = NextResponse.json(
        { error: "date, shift, and line are required" },
        { status: 400 }
      );
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const normalizedDecision =
      ALLOWED_DECISION_TYPES.includes(decision_type as (typeof ALLOWED_DECISION_TYPES)[number])
        ? (decision_type as (typeof ALLOWED_DECISION_TYPES)[number])
        : "accept_risk";

    const target_id = lineShiftTargetId(date, shift, line);

    const bodyRootCause = body.root_cause as { primary?: string; causes?: string[] } | undefined;
    const root_cause = JSON.stringify({
      type: bodyRootCause?.primary ?? "CAPACITY",
      message: "Tomorrow's Gaps line resolution",
      details: { date, shift, line },
      causes: bodyRootCause?.causes ?? [],
    });
    const actions = JSON.stringify({ chosen: normalizedDecision });

    const upsertQuery = `
      INSERT INTO execution_decisions (
        org_id,
        site_id,
        decision_type,
        target_type,
        target_id,
        reason,
        root_cause,
        actions,
        status,
        created_by,
        created_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, $9, $10, NOW())
      ON CONFLICT (decision_type, target_type, target_id)
      DO UPDATE SET
        reason = EXCLUDED.reason,
        root_cause = EXCLUDED.root_cause,
        actions = EXCLUDED.actions
      RETURNING id, org_id, decision_type, target_type, target_id, reason, created_at
    `;

    const result = await pool.query(upsertQuery, [
      activeOrgId,
      activeSiteId || null,
      "resolve_no_go",
      "line_shift",
      target_id,
      note || null,
      root_cause,
      actions,
      "active",
      userId,
    ]);

    const res = NextResponse.json({
      success: true,
      resolution: result.rows[0],
    });
    applySupabaseCookies(res, pendingCookies);
    return res;
  } catch (error) {
    console.error("POST /api/tomorrows-gaps/decisions failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal error" },
      { status: 500 }
    );
  }
}
