import { NextRequest, NextResponse } from "next/server";
import { getOrgIdFromSession } from "@/lib/orgSession";
import { createSupabaseServerClient, applySupabaseCookies } from "@/lib/supabase/server";
import { getRequestId } from "@/lib/server/requestId";
import { pool } from "@/lib/db/pool";

export const runtime = "nodejs";

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

    // Verify user has access to HR tasks (admin or hr role)
    if (session.role !== "admin" && session.role !== "hr") {
      const res = NextResponse.json({ error: "Forbidden: HR admin access required" }, { status: 403 });
      res.headers.set("X-Request-Id", requestId);
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const orgId = session.orgId;
    const userId = session.userId;
    if (orgId == null || orgId === undefined) {
      const res = NextResponse.json({ error: "Missing org" }, { status: 401 });
      res.headers.set("X-Request-Id", requestId);
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const thirtyDaysFromNow = new Date(today);
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
    const y = thirtyDaysFromNow.getFullYear();
    const m = String(thirtyDaysFromNow.getMonth() + 1).padStart(2, "0");
    const d = String(thirtyDaysFromNow.getDate()).padStart(2, "0");
    const cutoffISO = `${y}-${m}-${d}`;
    const thirtyDaysStr = cutoffISO;
    console.log(
      `[${requestId}] GET /api/hr/tasks org=${orgId} user=${userId} cutoff=${cutoffISO}`
    );

    const tasks: ExpiringTask[] = [];

    // Helper function to query expiring items with fallback if hr_task_resolutions doesn't exist
    async function queryExpiring(category: "medical_check" | "certificate") {
      const baseWhere = `
        WHERE e.org_id = $1
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
          e.name as employee_name,
          htr.status as resolution_status,
          htr.note as resolution_note
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
          e.name as employee_name,
          NULL::text as resolution_status,
          NULL::text as resolution_note
        FROM person_events pe
        INNER JOIN employees e ON pe.employee_id = e.id
        ${baseWhere}
        ORDER BY pe.due_date ASC
      `;

      try {
        const r = await pool.query(withResolutions, [orgId, category, thirtyDaysStr]);
        return r.rows;
      } catch (err: any) {
        // If hr_task_resolutions doesn't exist yet, fall back cleanly
        if (String(err?.code) === "42P01" || String(err?.message || "").includes("hr_task_resolutions")) {
          const r2 = await pool.query(withoutResolutions, [orgId, category, thirtyDaysStr]);
          return r2.rows;
        }
        throw err;
      }
    }

    // Fetch expiring medical checks and certificates (exact SQL used by route)
    let medicalRows: Array<{ id: string; employee_id: string; title: string; due_date: string; status: string | null; employee_name: string | null }> = [];
    let certRows: Array<{ id: string; employee_id: string; title: string; due_date: string; status: string | null; employee_name: string | null }> = [];
    try {
      medicalRows = await queryExpiring("medical_check");
    } catch (err) {
      console.error(`[${requestId}] Error fetching medical events:`, err);
    }
    try {
      certRows = await queryExpiring("certificate");
    } catch (err) {
      console.error(`[${requestId}] Error fetching certificates:`, err);
    }

    console.log(`[${requestId}] hr/tasks medical rows=${medicalRows.length}`);
    console.log(`[${requestId}] hr/tasks cert rows=${certRows.length}`);
    if (medicalRows.length > 0) {
      const r = medicalRows[0];
      console.log(
        `[${requestId}] hr/tasks medical first: id=${r.id} employee_id=${r.employee_id} title=${r.title} due_date=${r.due_date} status=${r.status} employee_name=${r.employee_name}`
      );
    }
    if (certRows.length > 0) {
      const r = certRows[0];
      console.log(
        `[${requestId}] hr/tasks cert first: id=${r.id} employee_id=${r.employee_id} title=${r.title} due_date=${r.due_date} status=${r.status} employee_name=${r.employee_name}`
      );
    }

    // If both counts 0, run diagnostics to isolate mismatch
    if (medicalRows.length === 0 && certRows.length === 0) {
      try {
        const a = await pool.query(
          "SELECT count(*) as c FROM employees WHERE org_id=$1 AND is_active=true",
          [orgId]
        );
        console.log(`[${requestId}] hr/tasks diag A employees(org,active): c=${(a.rows[0] as { c: string } | undefined)?.c ?? "?"}`);

        const b = await pool.query(
          `SELECT pe.id, pe.category, pe.status, pe.due_date, e.org_id
           FROM person_events pe
           JOIN employees e ON e.id=pe.employee_id
           WHERE e.org_id=$1
           ORDER BY pe.due_date ASC
           LIMIT 20`,
          [orgId]
        );
        console.log(`[${requestId}] hr/tasks diag B join rows=${b.rows.length}`, b.rows.slice(0, 3));

        const c = await pool.query(
          `SELECT pe.status, count(*)
           FROM person_events pe
           JOIN employees e ON e.id=pe.employee_id
           WHERE e.org_id=$1 AND pe.category IN ('medical_check','certificate')
           GROUP BY pe.status`,
          [orgId]
        );
        console.log(`[${requestId}] hr/tasks diag C status counts:`, c.rows);
      } catch (diagErr) {
        console.error(`[${requestId}] hr/tasks diagnostics failed:`, diagErr);
      }
    }

    for (const row of medicalRows) {
      const dueDate = new Date(row.due_date);
      dueDate.setHours(0, 0, 0, 0);
      const daysDiff = Math.floor((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      let severity: "P0" | "P1" | "P2";
      if (daysDiff < 0) severity = "P0";
      else if (daysDiff <= 7) severity = "P1";
      else severity = "P2";
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
    for (const row of certRows) {
      const expiryDate = new Date(row.due_date);
      expiryDate.setHours(0, 0, 0, 0);
      const daysDiff = Math.floor((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      let severity: "P0" | "P1" | "P2";
      if (daysDiff < 0) severity = "P0";
      else if (daysDiff <= 7) severity = "P1";
      else severity = "P2";
      tasks.push({
        id: row.id,
        employee_id: row.employee_id,
        employee_name: row.employee_name,
        type: "cert",
        item_name: row.title,
        expires_on: row.due_date,
        days_to_expiry: daysDiff,
        severity,
      });
    }

    tasks.sort((a, b) => {
      const severityOrder = { P0: 0, P1: 1, P2: 2 };
      const d = severityOrder[a.severity] - severityOrder[b.severity];
      if (d !== 0) return d;
      return a.days_to_expiry - b.days_to_expiry;
    });

    const medicalCount = tasks.filter((t) => t.type === "medical").length;
    const certCount = tasks.filter((t) => t.type === "cert").length;

    const res = NextResponse.json({
      tasks,
      meta: { medical_count: medicalCount, cert_count: certCount, total_count: tasks.length },
    });
    res.headers.set("X-Request-Id", requestId);
    applySupabaseCookies(res, pendingCookies);
    return res;
  } catch (err) {
    console.error(`[${requestId}] GET /api/hr/tasks failed:`, err);
    const res = NextResponse.json({ error: "Internal error" }, { status: 500 });
    res.headers.set("X-Request-Id", requestId);
    try {
      const { pendingCookies } = await createSupabaseServerClient();
      applySupabaseCookies(res, pendingCookies);
    } catch {
      /* ignore cookie errors on error path */
    }
    return res;
  }
}
