import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getActiveOrgFromSession } from "@/lib/server/activeOrg";
import { createSupabaseServerClient, applySupabaseCookies } from "@/lib/supabase/server";
import { withGovernanceGate } from "@/lib/server/governance/withGovernanceGate";
import { pool } from "@/lib/db/pool";
import { lineShiftTargetId } from "@/lib/shared/decisionIds";
import { normalizeShiftTypeOrDefault } from "@/lib/shift";

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

const ALLOWED_DECISION_TYPES = [
  "swap_operator",
  "call_in",
  "accept_risk",
  "escalate",
  "acknowledged",
] as const;

export async function POST(request: NextRequest) {
  try {
    const { supabase, pendingCookies } = await createSupabaseServerClient(request);
    const org = await getActiveOrgFromSession(request, supabase);
    if (!org.ok) {
      const res = NextResponse.json({ error: org.error }, { status: org.status });
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const admin = getAdmin();
    if (!admin) {
      const res = NextResponse.json(
        { error: "Governance not configured (service role required)" },
        { status: 503 }
      );
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

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

    const result = await withGovernanceGate({
      supabase,
      admin,
      orgId: org.activeOrgId,
      siteId: org.activeSiteId,
      context: {
        action: "TOMORROWS_GAPS_DECISION_CREATE",
        target_type: "line_shift",
        target_id,
        meta: {
          route: "/api/tomorrows-gaps/decisions",
          date,
          shift_code: shift,
          line,
          decision: normalizedDecision,
        },
        date,
        shift_code: shift,
      },
      handler: async () => {
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

        const queryResult = await pool.query(upsertQuery, [
          org.activeOrgId,
          org.activeSiteId || null,
          "resolve_no_go",
          "line_shift",
          target_id,
          note || null,
          root_cause,
          actions,
          "active",
          org.userId,
        ]);

        return {
          success: true,
          resolution: queryResult.rows[0],
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

    const res = NextResponse.json({ ok: true, ...result.data });
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
