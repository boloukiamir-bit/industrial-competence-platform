/**
 * GET /api/hr/inbox — unified actionable HR task list.
 * Query: status=open (default), includeResolved=0|1
 * Returns InboxItem[] with full context for training, medical, cert.
 */
import { NextRequest, NextResponse } from "next/server";
import { getOrgIdFromSession } from "@/lib/orgSession";
import { createSupabaseServerClient, applySupabaseCookies } from "@/lib/supabase/server";
import { pool } from "@/lib/db/pool";
import type { InboxItem } from "@/types/inbox";
import { getRequestId } from "@/lib/server/requestId";
import { toISODateString } from "@/lib/dateIso";

export const runtime = "nodejs";

function daysToExpiryToSeverity(daysDiff: number): "P0" | "P1" | "P2" {
  if (daysDiff < 0) return "P0";
  if (daysDiff <= 7) return "P1";
  return "P2";
}

export async function GET(request: NextRequest) {
  const requestId = getRequestId(request);
  try {
    const { supabase, pendingCookies } = await createSupabaseServerClient();
    const session = await getOrgIdFromSession(request, supabase);
    if (!session.success) {
      const res = NextResponse.json({ error: session.error }, { status: session.status });
      res.headers.set("X-Request-Id", requestId);
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    if (session.role !== "admin" && session.role !== "hr") {
      const res = NextResponse.json(
        { error: "Forbidden: HR admin access required" },
        { status: 403 }
      );
      res.headers.set("X-Request-Id", requestId);
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const orgId = session.orgId;
    if (!orgId) {
      const res = NextResponse.json({ error: "Missing org" }, { status: 401 });
      res.headers.set("X-Request-Id", requestId);
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const searchParams = request.nextUrl.searchParams;
    const includeResolved =
      searchParams.get("includeResolved") === "1" || searchParams.get("includeResolved") === "true";

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const thirtyDaysFromNow = new Date(today);
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
    const todayStr = today.toISOString().slice(0, 10);
    const thirtyDaysStr = thirtyDaysFromNow.toISOString().slice(0, 10);

    const items: InboxItem[] = [];

    // 1. Medical & cert from person_events (same data source as /api/hr/tasks)
    async function queryExpiring(
      category: "medical_check" | "certificate"
    ): Promise<
      Array<{
        id: string;
        employee_id: string;
        title: string;
        employee_name: string;
        due_date: unknown;
        created_at: unknown;
        resolution_status: string | null;
      }>
    > {
      const baseWhere = `
        WHERE e.org_id = $1
          AND e.is_active = true
          AND pe.category = $2
          AND pe.due_date IS NOT NULL
          AND pe.due_date <= $3
          AND (pe.status IS NULL OR pe.status != 'completed')
      `;
      const withResolutions = `
        SELECT pe.id, pe.employee_id, pe.title, pe.due_date, pe.created_at, e.name as employee_name,
               htr.status as resolution_status
        FROM person_events pe
        INNER JOIN employees e ON pe.employee_id = e.id
        LEFT JOIN hr_task_resolutions htr
          ON htr.org_id = e.org_id AND htr.task_source = $2 AND htr.task_id = pe.id
        ${baseWhere}
        ${includeResolved ? "" : "AND (htr.status IS NULL OR htr.status != 'resolved')"}
        ORDER BY pe.due_date ASC
      `;
      const withoutResolutions = `
        SELECT pe.id, pe.employee_id, pe.title, pe.due_date, pe.created_at, e.name as employee_name,
               NULL::text as resolution_status
        FROM person_events pe
        INNER JOIN employees e ON pe.employee_id = e.id
        ${baseWhere}
        ORDER BY pe.due_date ASC
      `;
      try {
        const r = await pool.query(withResolutions, [orgId, category, thirtyDaysStr]);
        return r.rows;
      } catch (err: unknown) {
        if (
          String((err as { code?: string })?.code) === "42P01" ||
          String((err as Error)?.message || "").includes("hr_task_resolutions")
        ) {
          const r2 = await pool.query(withoutResolutions, [orgId, category, thirtyDaysStr]);
          return r2.rows;
        }
        throw err;
      }
    }

    const medicalRows = await queryExpiring("medical_check");
    for (const row of medicalRows) {
      const dueDateVal = row.due_date ? new Date(String(row.due_date)) : null;
      if (dueDateVal) dueDateVal.setHours(0, 0, 0, 0);
      const daysDiff = dueDateVal
        ? Math.floor((dueDateVal.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
        : 0;
      const resolved = row.resolution_status === "resolved";
      items.push({
        id: `hr:medical:${row.id}`,
        kind: "medical",
        title: row.title || "Medical Check",
        owner_role: "HR",
        target_employee_id: row.employee_id,
        target_employee_name: row.employee_name ?? null,
        due_date: toISODateString(row.due_date),
        severity: daysToExpiryToSeverity(daysDiff),
        status: resolved ? "resolved" : "open",
        created_at: String(row.created_at ?? ""),
        task_source: "medical_check",
        task_id: row.id,
      });
    }

    const certRows = await queryExpiring("certificate");
    for (const row of certRows) {
      const dueDateVal = row.due_date ? new Date(String(row.due_date)) : null;
      if (dueDateVal) dueDateVal.setHours(0, 0, 0, 0);
      const daysDiff = dueDateVal
        ? Math.floor((dueDateVal.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
        : 0;
      const resolved = row.resolution_status === "resolved";
      items.push({
        id: `hr:cert:${row.id}`,
        kind: "cert",
        title: row.title || "Certificate",
        owner_role: "HR",
        target_employee_id: row.employee_id,
        target_employee_name: row.employee_name ?? null,
        due_date: toISODateString(row.due_date),
        severity: daysToExpiryToSeverity(daysDiff),
        status: resolved ? "resolved" : "open",
        created_at: String(row.created_at ?? ""),
        task_source: "certificate",
        task_id: row.id,
      });
    }

    // 2. Training tasks from hr_tasks (Plan training writes here)
    try {
      let trainingRows: { rows: Record<string, unknown>[] };
      try {
        trainingRows = await pool.query(
          `SELECT t.id, t.title, t.due_date, t.created_at, t.owner_role, t.line, t.station_id, t.station_name,
                  t.shift_code, t.shift_date, t.source_decision_id, t.status,
                  e.name AS target_employee_name
           FROM hr_tasks t
           LEFT JOIN employees e ON e.id = t.target_employee_id AND e.org_id = t.org_id
           WHERE t.org_id = $1
           ${includeResolved ? "" : "AND t.status = 'open'"}
           ORDER BY t.due_date ASC, t.created_at ASC`,
          [orgId]
        );
      } catch (colErr) {
        const msg = String((colErr as Error)?.message ?? "");
        if (/column .* does not exist|42703/i.test(msg)) {
          trainingRows = await pool.query(
            `SELECT t.id, t.title, t.due_date, t.created_at, t.owner_role, t.source_decision_id, t.status
             FROM hr_tasks t WHERE t.org_id = $1
             ${includeResolved ? "" : "AND t.status = 'open'"}
             ORDER BY t.due_date ASC, t.created_at ASC`,
            [orgId]
          );
        } else {
          throw colErr;
        }
      }
      for (const row of (trainingRows?.rows ?? [])) {
        const dueDateVal = row.due_date ? new Date(String(row.due_date)) : null;
        if (dueDateVal) dueDateVal.setHours(0, 0, 0, 0);
        const daysDiff = dueDateVal
          ? Math.floor((dueDateVal.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
          : 0;
        const status = row.status === "done" || row.status === "cancelled" ? "resolved" : "open";
        items.push({
          id: `hr:training:${row.id}`,
          kind: "training",
          title: (row.title != null ? String(row.title) : null) ?? "Training task",
          owner_role: (row.owner_role != null ? String(row.owner_role) : null) ?? "HR",
          target_employee_id: row.target_employee_id != null ? String(row.target_employee_id) : null,
          target_employee_name: row.target_employee_name != null ? String(row.target_employee_name) : null,
          line: row.line != null ? String(row.line) : null,
          station_id: row.station_id != null ? String(row.station_id) : null,
          station_name: row.station_name != null ? String(row.station_name) : null,
          shift_code: row.shift_code != null ? String(row.shift_code) : null,
          shift_date: toISODateString(row.shift_date),
          due_date: toISODateString(row.due_date),
          severity: daysToExpiryToSeverity(daysDiff),
          source_decision_id: row.source_decision_id != null ? String(row.source_decision_id) : null,
          status,
          created_at: String(row.created_at ?? ""),
          task_source: "training",
          task_id: String(row.id),
        });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!/relation .* does not exist|42P01/i.test(msg)) {
        console.error(`[${requestId}] GET /api/hr/inbox: training tasks:`, err);
      }
    }

    // Filter resolved when includeResolved=false
    const filtered = includeResolved ? items : items.filter((i) => i.status === "open");

    // Sort: severity (P0 first), then due_date
    filtered.sort((a, b) => {
      const sevOrder = { P0: 0, P1: 1, P2: 2 };
      const aSev = a.severity ? sevOrder[a.severity] : 3;
      const bSev = b.severity ? sevOrder[b.severity] : 3;
      if (aSev !== bSev) return aSev - bSev;
      const dateA = a.due_date ?? "";
      const dateB = b.due_date ?? "";
      return dateA.localeCompare(dateB);
    });

    const limited = filtered.slice(0, 200);

    const res = NextResponse.json(limited);
    res.headers.set("X-Request-Id", requestId);
    applySupabaseCookies(res, pendingCookies);
    return res;
  } catch (err) {
    console.error(`[${requestId}] GET /api/hr/inbox failed:`, err);
    const res = NextResponse.json({ error: "Internal error" }, { status: 500 });
    res.headers.set("X-Request-Id", requestId);
    try {
      const { pendingCookies } = await createSupabaseServerClient();
      applySupabaseCookies(res, pendingCookies);
    } catch {
      /* ignore */
    }
    return res;
  }
}
