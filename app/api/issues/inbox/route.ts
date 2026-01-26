import { NextRequest, NextResponse } from "next/server";
import { getOrgIdFromSession } from "@/lib/orgSession";
import { createSupabaseServerClient, applySupabaseCookies } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";
import pool from "@/lib/pgClient";
import type { IssueInboxItem } from "@/types/issues";

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
        console.error("issues/inbox: execution_decisions query error", edErr);
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
      console.error("Error fetching cockpit issues:", err);
    }

    // 2. Fetch HR expiring issues (medical and cert)
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const thirtyDaysFromNow = new Date(today);
      thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
      const todayStr = today.toISOString().slice(0, 10);
      const thirtyDaysStr = thirtyDaysFromNow.toISOString().slice(0, 10);

      // Fetch expiring medical checks
      const medicalQuery = `
        SELECT 
          pe.id,
          pe.employee_id,
          pe.title,
          pe.due_date,
          pe.updated_at,
          e.name as employee_name,
          htr.status as resolution_status,
          htr.note as resolution_note,
          htr.resolved_at as resolution_updated_at
        FROM person_events pe
        INNER JOIN employees e ON pe.employee_id = e.id
        LEFT JOIN hr_task_resolutions htr ON htr.org_id = e.org_id
          AND htr.task_source = 'medical_check'
          AND htr.task_id = pe.id
        WHERE e.org_id = $1
          AND e.is_active = true
          AND pe.category = 'medical_check'
          AND pe.completed_date IS NULL
          AND pe.due_date <= $2
          AND (htr.status IS NULL OR htr.status != 'resolved')
        ORDER BY pe.due_date ASC
      `;

      const medicalResult = await pool.query(medicalQuery, [orgId, thirtyDaysStr]);

      for (const row of medicalResult.rows) {
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
          native_ref: {
            task_source: "medical_check",
            task_id: row.id,
          },
          resolution_status: row.resolution_status === "snoozed" ? "snoozed" : null,
          resolution_note: row.resolution_note || null,
          updated_at: row.resolution_updated_at || row.updated_at || row.due_date,
        });
      }

      // Fetch expiring certificates
      const certQuery = `
        SELECT 
          d.id,
          d.employee_id,
          d.title,
          d.valid_to,
          d.updated_at,
          e.name as employee_name,
          htr.status as resolution_status,
          htr.note as resolution_note,
          htr.resolved_at as resolution_updated_at
        FROM documents d
        INNER JOIN employees e ON d.employee_id = e.id
        LEFT JOIN hr_task_resolutions htr ON htr.org_id = e.org_id
          AND htr.task_source = 'certificate'
          AND htr.task_id = d.id
        WHERE e.org_id = $1
          AND e.is_active = true
          AND d.type = 'certificate'
          AND d.valid_to IS NOT NULL
          AND d.valid_to <= $2
          AND (htr.status IS NULL OR htr.status != 'resolved')
        ORDER BY d.valid_to ASC
      `;

      const certResult = await pool.query(certQuery, [orgId, thirtyDaysStr]);

      for (const row of certResult.rows) {
        const expiryDate = new Date(row.valid_to);
        expiryDate.setHours(0, 0, 0, 0);
        const daysDiff = Math.floor((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

        items.push({
          id: `hr:cert:${row.id}`,
          source: "hr",
          issue_type: "cert_expiring",
          severity: daysToExpiryToSeverity(daysDiff),
          title: row.title || "Certificate",
          subtitle: row.employee_name,
          due_date: row.valid_to,
          native_ref: {
            task_source: "certificate",
            task_id: row.id,
          },
          resolution_status: row.resolution_status === "snoozed" ? "snoozed" : null,
          resolution_note: row.resolution_note || null,
          updated_at: row.resolution_updated_at || row.updated_at || row.valid_to,
        });
      }
    } catch (err) {
      console.error("Error fetching HR issues:", err);
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
    applySupabaseCookies(res, pendingCookies);
    return res;
  } catch (err) {
    console.error("issues/inbox error:", err);
    const errorMessage = err instanceof Error ? err.message : "Failed to fetch issues";
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
