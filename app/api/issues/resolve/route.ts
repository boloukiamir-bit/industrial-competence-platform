import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient, applySupabaseCookies } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";
import { pool } from "@/lib/db/pool";
import { registerDevErrorHooks } from "@/lib/server/devErrorHooks";
import { getRequestId } from "@/lib/server/requestId";
import { lineShiftTargetId } from "@/lib/shared/decisionIds";
import { withMutationGovernance } from "@/lib/server/governance/withMutationGovernance";

export const runtime = "nodejs";

try {
  registerDevErrorHooks();
} catch (err) {
  console.error("Failed to register dev error hooks:", err);
}

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export const POST = withMutationGovernance(
  async (ctx) => {
    const requestId = getRequestId(ctx.request);
    const orgId = ctx.orgId;
    const userId = ctx.userId;

    const { data: membership } = await ctx.supabase
      .from("memberships")
      .select("role")
      .eq("user_id", userId)
      .eq("org_id", orgId)
      .eq("status", "active")
      .maybeSingle();

    const role = (membership as { role?: string } | null)?.role ?? null;
    if (role !== "admin" && role !== "hr") {
      const res = NextResponse.json(
        { error: "Forbidden: HR admin access required" },
        { status: 403 }
      );
      res.headers.set("X-Request-Id", requestId);
      return res;
    }

    console.log(`[${requestId}] POST /api/issues/resolve org=${orgId} user=${userId}`);

    const body = ctx.body as Record<string, unknown>;
    const source = body.source;
    const native_ref = body.native_ref as Record<string, unknown> | undefined;
    const note = body.note;

    if (!source || !native_ref) {
      const res = NextResponse.json(
        { error: "source and native_ref are required" },
        { status: 400 }
      );
      res.headers.set("X-Request-Id", requestId);
      return res;
    }

    if (source === "cockpit") {
      if (!native_ref.shift_assignment_id) {
        const res = NextResponse.json(
          { error: "native_ref.shift_assignment_id is required for cockpit source" },
          { status: 400 }
        );
        res.headers.set("X-Request-Id", requestId);
        return res;
      }

      const shiftAssignmentId = native_ref.shift_assignment_id as string;

      const { data: assignment, error: assignmentErr } = await ctx.admin
        .from("shift_assignments")
        .select(
          "org_id, id, station:station_id(line), shift:shift_id(shift_date, shift_type)"
        )
        .eq("id", shiftAssignmentId)
        .eq("org_id", orgId)
        .single();

      if (assignmentErr || !assignment) {
        const res = NextResponse.json(
          { error: "Shift assignment not found or access denied" },
          { status: 404 }
        );
        res.headers.set("X-Request-Id", requestId);
        return res;
      }

      const { data: profile } = await ctx.admin
        .from("profiles")
        .select("active_site_id")
        .eq("id", userId)
        .single();

      const activeSiteId = profile?.active_site_id as string | null | undefined;

      const station = assignment.station as { line?: string | null } | null | undefined;
      const shift = assignment.shift as { shift_date?: string | null; shift_type?: string | null } | null | undefined;
      const date = shift?.shift_date ? String(shift.shift_date).slice(0, 10) : "";
      const shiftType = shift?.shift_type ? String(shift.shift_type).trim().toLowerCase() : "";
      const line = station?.line ? String(station.line).trim() : "";

      const useLineShift = Boolean(date && shiftType && line);

      if (useLineShift) {
        const targetId = lineShiftTargetId(date, shiftType, line);
        const root_cause = JSON.stringify({
          type: "cockpit",
          message: "Resolved from Cockpit",
          details: { shift_assignment_id: shiftAssignmentId, date, shift: shiftType, line },
        });
        const actions = JSON.stringify({ chosen: "acknowledged" });

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
          orgId,
          activeSiteId || null,
          "resolve_no_go",
          "line_shift",
          targetId,
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
        res.headers.set("X-Request-Id", requestId);
        return res;
      }

      // Fallback: station has no line — write legacy shift_assignment decision for backwards compat
      const upsertQuery = `
        INSERT INTO execution_decisions (
          org_id,
          site_id,
          decision_type,
          target_type,
          target_id,
          reason,
          status,
          created_by,
          created_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
        ON CONFLICT (decision_type, target_type, target_id)
        DO UPDATE SET
          reason = EXCLUDED.reason
        RETURNING id, org_id, decision_type, target_type, target_id, reason, created_at
      `;

      const result = await pool.query(upsertQuery, [
        orgId,
        activeSiteId || null,
        "resolve_no_go",
        "shift_assignment",
        shiftAssignmentId,
        note || null,
        "active",
        userId,
      ]);

      const res = NextResponse.json({
        success: true,
        resolution: result.rows[0],
      });
      res.headers.set("X-Request-Id", requestId);
      return res;
    } else if (source === "hr") {
      // Forward to existing HR resolve endpoint
      const { task_source, task_id } = native_ref;
      if (!task_source || !task_id) {
        const res = NextResponse.json(
          { error: "native_ref.task_source and native_ref.task_id are required for hr source" },
          { status: 400 }
        );
        res.headers.set("X-Request-Id", requestId);
        return res;
      }

      // Call the existing HR resolve endpoint logic
      const upsertQuery = `
        INSERT INTO hr_task_resolutions (org_id, task_source, task_id, status, note, resolved_by, resolved_at)
        VALUES ($1, $2, $3, $4, $5, $6, NOW())
        ON CONFLICT (org_id, task_source, task_id)
        DO UPDATE SET
          status = EXCLUDED.status,
          note = EXCLUDED.note,
          resolved_by = EXCLUDED.resolved_by,
          resolved_at = NOW()
        RETURNING id, org_id, task_source, task_id, status, note, resolved_by, resolved_at
      `;

      const result = await pool.query(upsertQuery, [
        orgId,
        task_source,
        task_id,
        "resolved", // HR items are always resolved (not snoozed from this endpoint)
        note || null,
        userId,
      ]);

      const res = NextResponse.json({
        success: true,
        resolution: result.rows[0],
      });
      res.headers.set("X-Request-Id", requestId);
      return res;
    } else {
      const res = NextResponse.json(
        { error: "Invalid source. Must be 'cockpit' or 'hr'" },
        { status: 400 }
      );
      res.headers.set("X-Request-Id", requestId);
      return res;
    }
  },
  {
    route: "/api/issues/resolve",
    action: "ISSUES_RESOLVE",
    target_type: "resolution",
    allowNoShiftContext: true,
    getTargetIdAndMeta: (body) => ({
      target_id: (body.source as string) ?? "unknown",
      meta: { source: body.source },
    }),
  }
);
