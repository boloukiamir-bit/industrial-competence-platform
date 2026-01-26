import { NextRequest, NextResponse } from "next/server";
import { getOrgIdFromSession } from "@/lib/orgSession";
import { createSupabaseServerClient, applySupabaseCookies } from "@/lib/supabase/server";
import pool from "@/lib/pgClient";

export type ExpiringTask = {
  id: string;
  employee_id: string;
  employee_name: string | null;
  type: "medical" | "cert";
  item_name: string;
  expires_on: string;
  days_to_expiry: number;
  severity: "P0" | "P1" | "P2";
};

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

    // Verify user has access to HR tasks (admin or hr role)
    if (session.role !== "admin" && session.role !== "hr") {
      const res = NextResponse.json({ error: "Forbidden: HR admin access required" }, { status: 403 });
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const orgId = session.orgId;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const thirtyDaysFromNow = new Date(today);
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
    const todayStr = today.toISOString().slice(0, 10);
    const thirtyDaysStr = thirtyDaysFromNow.toISOString().slice(0, 10);

    const tasks: ExpiringTask[] = [];

    // Fetch expiring medical checks using JOIN to filter by org_id (tenant-safe, no IN list)
    // Exclude items that are resolved (LEFT JOIN and filter out resolved)
    const medicalQuery = `
      SELECT 
        pe.id,
        pe.employee_id,
        pe.title,
        pe.due_date,
        e.name as employee_name,
        htr.status as resolution_status
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

    try {
      const medicalResult = await pool.query(medicalQuery, [orgId, thirtyDaysStr]);
      
      for (const row of medicalResult.rows) {
        const dueDate = new Date(row.due_date);
        dueDate.setHours(0, 0, 0, 0);
        const daysDiff = Math.floor((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

        let severity: "P0" | "P1" | "P2";
        if (daysDiff < 0) {
          severity = "P0";
        } else if (daysDiff <= 7) {
          severity = "P1";
        } else {
          severity = "P2";
        }

        tasks.push({
          id: row.id,
          employee_id: row.employee_id,
          employee_name: row.employee_name,
          type: "medical",
          item_name: row.title,
          expires_on: row.due_date,
          days_to_expiry: daysDiff,
          severity,
        });
      }
    } catch (err) {
      console.error("Error fetching medical events:", err);
    }

    // Fetch expiring certificates using JOIN to filter by org_id (tenant-safe, no IN list)
    // Exclude items that are resolved (LEFT JOIN and filter out resolved)
    const certQuery = `
      SELECT 
        d.id,
        d.employee_id,
        d.title,
        d.valid_to,
        e.name as employee_name,
        htr.status as resolution_status
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

    try {
      const certResult = await pool.query(certQuery, [orgId, thirtyDaysStr]);
      
      for (const row of certResult.rows) {
        const expiryDate = new Date(row.valid_to);
        expiryDate.setHours(0, 0, 0, 0);
        const daysDiff = Math.floor((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

        let severity: "P0" | "P1" | "P2";
        if (daysDiff < 0) {
          severity = "P0";
        } else if (daysDiff <= 7) {
          severity = "P1";
        } else {
          severity = "P2";
        }

        tasks.push({
          id: row.id,
          employee_id: row.employee_id,
          employee_name: row.employee_name,
          type: "cert",
          item_name: row.title,
          expires_on: row.valid_to,
          days_to_expiry: daysDiff,
          severity,
        });
      }
    } catch (err) {
      console.error("Error fetching certificates:", err);
    }

    // Sort by severity (P0 first) then by days_to_expiry (most urgent first)
    tasks.sort((a, b) => {
      const severityOrder = { P0: 0, P1: 1, P2: 2 };
      const severityDiff = severityOrder[a.severity] - severityOrder[b.severity];
      if (severityDiff !== 0) return severityDiff;
      return a.days_to_expiry - b.days_to_expiry;
    });

    const medicalCount = tasks.filter((t) => t.type === "medical").length;
    const certCount = tasks.filter((t) => t.type === "cert").length;

    const res = NextResponse.json({
      tasks,
      meta: {
        medical_count: medicalCount,
        cert_count: certCount,
        total_count: tasks.length,
      },
    });
    applySupabaseCookies(res, pendingCookies);
    return res;
  } catch (err) {
    console.error("HR Tasks API error:", err);
    const errorMessage = err instanceof Error ? err.message : "Failed to fetch HR tasks";
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
