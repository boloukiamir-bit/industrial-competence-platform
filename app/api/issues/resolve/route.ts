import { NextRequest, NextResponse } from "next/server";
import { getOrgIdFromSession } from "@/lib/orgSession";
import { createSupabaseServerClient, applySupabaseCookies } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";
import pool from "@/lib/pgClient";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    // Authenticate and get org session
    const { supabase, pendingCookies } = await createSupabaseServerClient();
    const session = await getOrgIdFromSession(request, supabase);
    if (!session.success) {
      const res = NextResponse.json({ error: session.error }, { status: session.status });
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    // Verify user has access (admin or hr role)
    if (session.role !== "admin" && session.role !== "hr") {
      const res = NextResponse.json(
        { error: "Forbidden: HR admin access required" },
        { status: 403 }
      );
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const orgId = session.orgId;
    const userId = session.userId;

    // Parse request body
    const body = await request.json();
    const { source, native_ref, note } = body;

    // Validate inputs
    if (!source || !native_ref) {
      const res = NextResponse.json(
        { error: "source and native_ref are required" },
        { status: 400 }
      );
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    if (source === "cockpit") {
      // Validate cockpit-specific fields
      if (!native_ref.shift_assignment_id) {
        const res = NextResponse.json(
          { error: "native_ref.shift_assignment_id is required for cockpit source" },
          { status: 400 }
        );
        applySupabaseCookies(res, pendingCookies);
        return res;
      }

      const targetId = native_ref.shift_assignment_id as string;

      // Verify the shift_assignment belongs to this org (tenant-safe)
      const { data: assignment, error: assignmentErr } = await supabaseAdmin
        .from("shift_assignments")
        .select("org_id, id")
        .eq("id", targetId)
        .eq("org_id", orgId)
        .single();

      if (assignmentErr || !assignment) {
        const res = NextResponse.json(
          { error: "Shift assignment not found or access denied" },
          { status: 404 }
        );
        applySupabaseCookies(res, pendingCookies);
        return res;
      }

      // Get active site filter if available
      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("active_site_id")
        .eq("id", userId)
        .single();

      const activeSiteId = profile?.active_site_id as string | null | undefined;

      // Upsert resolution using ON CONFLICT with the unique index
      // The unique index is: (decision_type, target_type, target_id) WHERE status='active'
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
        WHERE status = 'active'
        DO UPDATE SET
          reason = EXCLUDED.reason,
          created_by = EXCLUDED.created_by,
          created_at = NOW()
        RETURNING id, org_id, decision_type, target_type, target_id, reason, created_at
      `;

      const result = await pool.query(upsertQuery, [
        orgId,
        activeSiteId || null,
        "resolve_no_go",
        "shift_assignment",
        targetId,
        note || null,
        "active",
        userId,
      ]);

      const res = NextResponse.json({
        success: true,
        resolution: result.rows[0],
      });
      applySupabaseCookies(res, pendingCookies);
      return res;
    } else if (source === "hr") {
      // Forward to existing HR resolve endpoint
      const { task_source, task_id } = native_ref;
      if (!task_source || !task_id) {
        const res = NextResponse.json(
          { error: "native_ref.task_source and native_ref.task_id are required for hr source" },
          { status: 400 }
        );
        applySupabaseCookies(res, pendingCookies);
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
      applySupabaseCookies(res, pendingCookies);
      return res;
    } else {
      const res = NextResponse.json(
        { error: "Invalid source. Must be 'cockpit' or 'hr'" },
        { status: 400 }
      );
      applySupabaseCookies(res, pendingCookies);
      return res;
    }
  } catch (err) {
    console.error("issues/resolve error:", err);
    const errorMessage = err instanceof Error ? err.message : "Failed to resolve issue";
    const res = NextResponse.json({ error: errorMessage }, { status: 500 });
    try {
      const { pendingCookies } = await createSupabaseServerClient();
      applySupabaseCookies(res, pendingCookies);
    } catch {
      // Ignore cookie errors on error path
    }
    return res;
  }
}
