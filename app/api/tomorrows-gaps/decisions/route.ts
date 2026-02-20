import { NextResponse } from "next/server";
import { withMutationGovernance } from "@/lib/server/governance/withMutationGovernance";
import { pool } from "@/lib/db/pool";
import { lineShiftTargetId } from "@/lib/shared/decisionIds";

const ALLOWED_DECISION_TYPES = [
  "swap_operator",
  "call_in",
  "accept_risk",
  "escalate",
  "acknowledged",
] as const;

export const POST = withMutationGovernance(
  async (ctx) => {
    const line = typeof ctx.body.line === "string" ? ctx.body.line.trim() : "";
    const decision_type =
      typeof ctx.body.decision_type === "string" ? ctx.body.decision_type.trim() : "";
    const note = typeof ctx.body.note === "string" ? ctx.body.note.trim() : null;

    if (!line) {
      return NextResponse.json(
        { error: "date, shift, and line are required" },
        { status: 400 }
      );
    }

    const date = ctx.date ?? "";
    const shift = ctx.shift_code ?? "";
    const target_id = lineShiftTargetId(date, shift, line);

    const normalizedDecision = ALLOWED_DECISION_TYPES.includes(
      decision_type as (typeof ALLOWED_DECISION_TYPES)[number]
    )
      ? (decision_type as (typeof ALLOWED_DECISION_TYPES)[number])
      : "accept_risk";

    const bodyRootCause = ctx.body.root_cause as { primary?: string; causes?: string[] } | undefined;
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
      ctx.orgId,
      ctx.siteId || null,
      "resolve_no_go",
      "line_shift",
      target_id,
      note || null,
      root_cause,
      actions,
      "active",
      ctx.userId,
    ]);

    return NextResponse.json({
      ok: true,
      success: true,
      resolution: queryResult.rows[0],
    });
  },
  {
    route: "/api/tomorrows-gaps/decisions",
    action: "TOMORROWS_GAPS_DECISION_CREATE",
    target_type: "line_shift",
    shiftCodeKey: "shift",
    getTargetIdAndMeta: (body, shift) => {
      const date = shift.date ?? (typeof body.date === "string" ? body.date.trim().slice(0, 10) : "");
      const shiftVal =
        shift.shift_code ?? (typeof body.shift === "string" ? body.shift.trim() : "");
      const line = typeof body.line === "string" ? body.line.trim() : "";
      const target_id = date && shiftVal && line ? lineShiftTargetId(date, shiftVal, line) : "unknown";
      const decision_type =
        typeof body.decision_type === "string" ? body.decision_type.trim() : "accept_risk";
      return {
        target_id,
        meta: {
          date,
          shift_code: shiftVal,
          line,
          decision: ALLOWED_DECISION_TYPES.includes(decision_type as (typeof ALLOWED_DECISION_TYPES)[number])
            ? decision_type
            : "accept_risk",
        },
      };
    },
  }
);
