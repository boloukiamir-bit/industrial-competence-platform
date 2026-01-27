import { NextRequest, NextResponse } from "next/server";
import { getOrgIdFromSession } from "@/lib/orgSession";
import { createSupabaseServerClient, applySupabaseCookies } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";
import { pool } from "@/lib/db/pool";
import type { IssueInboxItem } from "@/types/issues";
import { registerDevErrorHooks } from "@/lib/server/devErrorHooks";
import { getRequestId } from "@/lib/server/requestId";

export const runtime = "nodejs";

// Register dev error hooks on module load (safe - won't throw)
try {
  registerDevErrorHooks();
} catch (err) {
  console.error("Failed to register dev error hooks:", err);
}

// Initialize supabase admin client
// Note: If env vars are missing, this will throw at runtime when used
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function isBlocking(rootCause: unknown): boolean {
  if (rootCause == null || typeof rootCause !== "object") return true;
  const rc = rootCause as Record<string, unknown>;
  const b = rc.blocking;
  if (b === false || b === "false") return false;
  return true;
}

function severityToPriority(severity: "NO-GO" | "WARNING"): "P0" | "P1" | "P2" {
  if (severity === "NO-GO") return "P0";
  return "P1";
}

function daysToExpiryToSeverity(daysDiff: number): "P0" | "P1" | "P2" {
  if (daysDiff < 0) return "P0";
  if (daysDiff <= 7) return "P1";
  return "P2";
}

export async function GET(request: NextRequest) {
  const requestId = getRequestId(request);
  try {
    // Authenticate and get org session
    const { supabase, pendingCookies } = await createSupabaseServerClient();
    const session = await getOrgIdFromSession(request, supabase);
    if (!session.success) {
      const res = NextResponse.json({ error: session.error }, { status: session.status });
      res.headers.set("X-Request-Id", requestId);
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    // Log request with correlation ID
    console.log(
      `[${requestId}] GET /api/issues/inbox org=${session.orgId} user=${session.userId}`
    );

    // Verify user has access (admin or hr role)
    if (session.role !== "admin" && session.role !== "hr") {
      const res = NextResponse.json(
        { error: "Forbidden: HR admin access required" },
        { status: 403 }
      );
      res.headers.set("X-Request-Id", requestId);
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    // Read includeResolved query param (default false)
    const searchParams = request.nextUrl.searchParams;
    const includeResolved = searchParams.get("includeResolved") === "1" || searchParams.get("includeResolved") === "true";

    const orgId = session.orgId;

    // Get active site filter if available
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("active_site_id")
      .eq("id", session.userId)
      .single();

    const activeSiteId = profile?.active_site_id as string | null | undefined;

    const items: IssueInboxItem[] = [];

    // 1. Fetch cockpit issues (execution_decisions with active status)
    try {
      let edQuery = supabaseAdmin
        .from("execution_decisions")
        .select("id, target_id, root_cause, created_at, updated_at")
        .eq("org_id", orgId)
        .eq("status", "active")
        .eq("target_type", "shift_assignment")
        .not("root_cause", "is", null);

      if (activeSiteId) {
        edQuery = edQuery.or(`site_id.is.null,site_id.eq.${activeSiteId}`);
      }

      const { data: edRows, error: edErr } = await edQuery;

      if (edErr) {
        console.error(`[${requestId}] issues/inbox: execution_decisions query error`, edErr);
      } else if (edRows && edRows.length > 0) {
        // Get shift assignment details
        const targetIds = edRows.map((r) => r.target_id).filter(Boolean) as string[];
        const { data: saRows } = await supabaseAdmin
          .from("shift_assignments")
          .select("id, station:station_id(name), employee:employee_id(name), shift:shift_id(shift_date, shift_type)")
          .in("id", targetIds);

        const assignments = (saRows || []) as Array<{
          id: string;
          station?: { name?: string } | null;
          employee?: { name?: string } | null;
          shift?: { shift_date?: string; shift_type?: string } | null;
        }>;

        const assignmentMap = new Map(assignments.map((a) => [a.id, a]));

        // Check for resolution status (look for resolve_no_go decisions)
        const { data: resolveRows } = await supabaseAdmin
          .from("execution_decisions")
          .select("target_id, reason, updated_at")
          .eq("org_id", orgId)
          .eq("status", "active")
          .eq("decision_type", "resolve_no_go")
          .eq("target_type", "shift_assignment")
          .in("target_id", targetIds);

        const resolvedByTarget = new Map(
          (resolveRows || []).map((r) => [
            r.target_id,
            { note: r.reason || null, updated_at: r.updated_at },
          ])
        );

        // Build cockpit items
        for (const ed of edRows) {
          const assignment = assignmentMap.get(ed.target_id);
          if (!assignment) continue;

          const isBlockingIssue = isBlocking(ed.root_cause);
          const severity = isBlockingIssue ? "NO-GO" : "WARNING";
          const resolution = resolvedByTarget.get(ed.target_id);

          const stationName = assignment.station?.name || "Station";
          const employeeName = assignment.employee?.name || "Unassigned";
          const shiftDate = assignment.shift?.shift_date || null;
          const shiftType = assignment.shift?.shift_type || null;

          items.push({
            id: `cockpit:${ed.id}`,
            source: "cockpit",
            issue_type: isBlockingIssue ? "no_go" : "warning",
            severity: severityToPriority(severity),
            title: `${stationName} - ${employeeName}`,
            subtitle: shiftDate && shiftType ? `${shiftDate} ${shiftType}` : null,
            due_date: shiftDate || null,
            native_ref: {
              shift_assignment_id: ed.target_id,
            },
            resolution_status: resolution ? "resolved" : null,
            resolution_note: resolution?.note || null,
            updated_at: resolution?.updated_at || ed.updated_at || ed.created_at,
          });
        }
      }
    } catch (err) {
      console.error(`[${requestId}] Error fetching cockpit issues:`, err);
    }

    // 2. Fetch HR expiring issues (medical and cert) — pg errors propagate → 500 with requestId
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const thirtyDaysFromNow = new Date(today);
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
    const todayStr = today.toISOString().slice(0, 10);
    const thirtyDaysStr = thirtyDaysFromNow.toISOString().slice(0, 10);

    async function queryExpiring(category: "medical_check" | "certificate") {
      const baseWhere = `
        WHERE e.org_id = $1
          AND e.is_active = true
          AND pe.category = $2
          AND pe.due_date IS NOT NULL
          AND pe.due_date <= $3
          AND (pe.status IS NULL OR pe.status != 'completed')
      `;

      const withResolutions = `
        SELECT
          pe.id,
          pe.employee_id,
          pe.title,
          pe.due_date,
          pe.status,
          pe.created_at,
          e.name as employee_name,
          htr.status as resolution_status,
          htr.note as resolution_note,
          htr.resolved_at as resolution_updated_at
        FROM person_events pe
        INNER JOIN employees e ON pe.employee_id = e.id
        LEFT JOIN hr_task_resolutions htr
          ON htr.org_id = e.org_id
         AND htr.task_source = $2
         AND htr.task_id = pe.id
        ${baseWhere}
          AND (htr.status IS NULL OR htr.status != 'resolved')
        ORDER BY pe.due_date ASC
      `;

      const withoutResolutions = `
        SELECT
          pe.id,
          pe.employee_id,
          pe.title,
          pe.due_date,
          pe.status,
          pe.created_at,
          e.name as employee_name,
          NULL::text as resolution_status,
          NULL::text as resolution_note,
          NULL::timestamptz as resolution_updated_at
        FROM person_events pe
        INNER JOIN employees e ON pe.employee_id = e.id
        ${baseWhere}
        ORDER BY pe.due_date ASC
      `;

      try {
        const r = await pool.query(withResolutions, [orgId, category, thirtyDaysStr]);
        return r.rows;
      } catch (err: unknown) {
        if (String((err as { code?: string })?.code) === "42P01" || String((err as Error)?.message || "").includes("hr_task_resolutions")) {
          const r2 = await pool.query(withoutResolutions, [orgId, category, thirtyDaysStr]);
          return r2.rows;
        }
        throw err;
      }
    }

    const medicalRows = await queryExpiring("medical_check");
    for (const row of medicalRows) {
      const dueDate = new Date(row.due_date);
      dueDate.setHours(0, 0, 0, 0);
      const daysDiff = Math.floor((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      items.push({
        id: `hr:medical:${row.id}`,
        source: "hr",
        issue_type: "medical_expiring",
        severity: daysToExpiryToSeverity(daysDiff),
        title: row.title || "Medical Check",
        subtitle: row.employee_name,
        due_date: row.due_date,
        native_ref: { task_source: "medical_check", task_id: row.id },
        resolution_status: row.resolution_status === "snoozed" ? "snoozed" : null,
        resolution_note: row.resolution_note || null,
        updated_at: row.resolution_updated_at || row.created_at || row.due_date,
      });
    }

    const certRows = await queryExpiring("certificate");
    for (const row of certRows) {
      const expiryDate = new Date(row.due_date);
      expiryDate.setHours(0, 0, 0, 0);
      const daysDiff = Math.floor((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      items.push({
        id: `hr:cert:${row.id}`,
        source: "hr",
        issue_type: "cert_expiring",
        severity: daysToExpiryToSeverity(daysDiff),
        title: row.title || "Certificate",
        subtitle: row.employee_name,
        due_date: row.due_date,
        native_ref: { task_source: "certificate", task_id: row.id },
        resolution_status: row.resolution_status === "snoozed" ? "snoozed" : null,
        resolution_note: row.resolution_note || null,
        updated_at: row.resolution_updated_at || row.created_at || row.due_date,
      });
    }

    // 3. Filter out resolved items if includeResolved is false (default)
    const filteredItems = includeResolved
      ? items
      : items.filter((item) => item.resolution_status !== "resolved");

    // 4. Sort by severity (P0 first), then due_date ascending (nulls last)
    filteredItems.sort((a, b) => {
      const severityOrder = { P0: 0, P1: 1, P2: 2 };
      const severityDiff = severityOrder[a.severity] - severityOrder[b.severity];
      if (severityDiff !== 0) return severityDiff;

      // Then by due_date (nulls last)
      if (!a.due_date && !b.due_date) return 0;
      if (!a.due_date) return 1;
      if (!b.due_date) return -1;
      return a.due_date.localeCompare(b.due_date);
    });

    // 5. Limit to top 200 items
    const limitedItems = filteredItems.slice(0, 200);

    const res = NextResponse.json(limitedItems);
    res.headers.set("X-Request-Id", requestId);
    applySupabaseCookies(res, pendingCookies);
    return res;
  } catch (err) {
    // Use the requestId we got earlier, or generate a fallback
    const errorRequestId = requestId || `error-${Date.now()}`;
    
    // Log with full error details
    const errorDetails = {
      message: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
      name: err instanceof Error ? err.name : typeof err,
    };
    console.error(`[${errorRequestId}] GET /api/issues/inbox failed:`, errorDetails);
    
    // Always return JSON, never let Next.js return HTML error page
    const errorMessage = err instanceof Error ? err.message : "Failed to fetch issues";
    const res = NextResponse.json(
      { 
        error: errorMessage,
        requestId: errorRequestId,
      },
      { status: 500 }
    );
    res.headers.set("X-Request-Id", errorRequestId);
    res.headers.set("Content-Type", "application/json");
    
    try {
      const { pendingCookies } = await createSupabaseServerClient();
      applySupabaseCookies(res, pendingCookies);
    } catch {
      // Ignore cookie errors on error path
    }
    return res;
  }
}
