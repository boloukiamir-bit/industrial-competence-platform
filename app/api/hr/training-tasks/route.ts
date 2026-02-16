/**
 * GET /api/hr/training-tasks — list open training tasks (admin/HR only).
 * POST /api/hr/training-tasks — create a training task (admin/HR only).
 * Body: { source_decision_id?, template_id, title, owner_role?, shift_date?, due_date? }
 * Dates: shift_date/due_date stored as DATE; API returns ISO "YYYY-MM-DD".
 * If due_date not provided, default due_date = shift_date+14 or today+14.
 */
import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db/pool";
import { getActiveOrgFromSession } from "@/lib/server/activeOrg";
import { createSupabaseServerClient, applySupabaseCookies } from "@/lib/supabase/server";
import { toISODateString, parseDateForStorage, addDaysISO } from "@/lib/dateIso";

export const runtime = "nodejs";

const VALID_OWNERS = ["Ops", "Supervisor", "HR"] as const;

export async function GET(request: NextRequest) {
  const { supabase, pendingCookies } = await createSupabaseServerClient();
  const org = await getActiveOrgFromSession(request, supabase);
  if (!org.ok) {
    const res = NextResponse.json({ error: org.error }, { status: org.status });
    applySupabaseCookies(res, pendingCookies);
    return res;
  }

  const { activeOrgId, userId } = org;
  const roleResult = await pool.query(
    `SELECT role FROM memberships WHERE user_id = $1 AND org_id = $2 AND status = 'active' LIMIT 1`,
    [userId, activeOrgId]
  );
  const role = roleResult.rows[0]?.role as string | undefined;
  if (!role || (role !== "admin" && role !== "hr")) {
    const res = NextResponse.json({ error: "Forbidden: HR admin access required" }, { status: 403 });
    applySupabaseCookies(res, pendingCookies);
    return res;
  }

  try {
    const rows = await pool.query(
      `SELECT t.id, t.org_id, t.site_id, t.source_decision_id, t.template_id, t.title, t.owner_role, t.owner_id, t.due_date, t.status, t.created_at,
              t.line, t.station_id, t.station_name, t.shift_code, t.shift_date, t.target_employee_id,
              w.code AS template_code, w.name AS template_name,
              e.name AS target_employee_name
       FROM hr_tasks t
       JOIN hr_workflows w ON w.id = t.template_id
       LEFT JOIN employees e ON e.id = t.target_employee_id AND e.org_id = t.org_id
       WHERE t.org_id = $1 AND t.status = 'open'
       ORDER BY t.due_date ASC, t.created_at ASC`,
      [activeOrgId]
    );
    const tasks = (rows.rows || []).map((r: Record<string, unknown>) => ({
      id: r.id,
      source_decision_id: r.source_decision_id ?? null,
      template_id: r.template_id,
      template_code: r.template_code,
      template_name: r.template_name,
      title: r.title,
      owner_role: r.owner_role ?? "HR",
      due_date: toISODateString(r.due_date),
      status: r.status,
      created_at: r.created_at,
      line: r.line ?? null,
      station_id: r.station_id ?? null,
      station_name: r.station_name ?? null,
      shift_code: r.shift_code ?? null,
      shift_date: toISODateString(r.shift_date),
      target_employee_id: r.target_employee_id ?? null,
      target_employee_name: r.target_employee_name ?? null,
    }));
    const res = NextResponse.json({ tasks });
    applySupabaseCookies(res, pendingCookies);
    return res;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/relation .* does not exist|42P01/i.test(msg)) {
      const res = NextResponse.json({ tasks: [] });
      applySupabaseCookies(res, pendingCookies);
      return res;
    }
    console.error("[hr/training-tasks] GET", err);
    const res = NextResponse.json({ error: "Failed to list tasks" }, { status: 500 });
    applySupabaseCookies(res, pendingCookies);
    return res;
  }
}

export async function POST(request: NextRequest) {
  const { supabase, pendingCookies } = await createSupabaseServerClient();
  const org = await getActiveOrgFromSession(request, supabase);
  if (!org.ok) {
    const res = NextResponse.json({ error: org.error }, { status: org.status });
    applySupabaseCookies(res, pendingCookies);
    return res;
  }

  const { activeOrgId, activeSiteId, userId } = org;
  const roleResult = await pool.query(
    `SELECT role FROM memberships WHERE user_id = $1 AND org_id = $2 AND status = 'active' LIMIT 1`,
    [userId, activeOrgId]
  );
  const role = roleResult.rows[0]?.role as string | undefined;
  if (!role || (role !== "admin" && role !== "hr")) {
    const res = NextResponse.json({ error: "Forbidden: only admins and HR can create training tasks" }, { status: 403 });
    applySupabaseCookies(res, pendingCookies);
    return res;
  }

  let body: { source_decision_id?: string; template_id?: string; title?: string; owner_role?: string; shift_date?: string; due_date?: string };
  try {
    body = await request.json();
  } catch {
    const res = NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    applySupabaseCookies(res, pendingCookies);
    return res;
  }

  const templateId = typeof body.template_id === "string" ? body.template_id.trim() : "";
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const ownerRole = body.owner_role && VALID_OWNERS.includes(body.owner_role as (typeof VALID_OWNERS)[number]) ? body.owner_role : "HR";
  const sourceDecisionId = typeof body.source_decision_id === "string" ? body.source_decision_id.trim() || null : null;
  const shiftDate = parseDateForStorage(body.shift_date);
  let dueDate = parseDateForStorage(body.due_date);
  if (!dueDate) {
    dueDate = addDaysISO(shiftDate, 14);
  }

  if (!templateId) {
    const res = NextResponse.json({ error: "template_id is required" }, { status: 400 });
    applySupabaseCookies(res, pendingCookies);
    return res;
  }
  if (!title) {
    const res = NextResponse.json({ error: "title is required" }, { status: 400 });
    applySupabaseCookies(res, pendingCookies);
    return res;
  }

  try {
    const verify = await pool.query(
      `SELECT id FROM hr_workflows WHERE id = $1 AND org_id = $2 AND is_active = true LIMIT 1`,
      [templateId, activeOrgId]
    );
    if (verify.rows.length === 0) {
      const res = NextResponse.json({ error: "Template not found or not in your org" }, { status: 404 });
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const insert = await pool.query(
      `INSERT INTO hr_tasks (org_id, site_id, source_decision_id, template_id, title, owner_role, due_date, status, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7::date, 'open', $8)
       RETURNING id, title, owner_role, due_date, status, created_at`,
      [activeOrgId, activeSiteId ?? null, sourceDecisionId, templateId, title, ownerRole, dueDate, userId]
    );
    const row = insert.rows[0];
    const res = NextResponse.json({
      success: true,
      id: row.id,
      title: row.title,
      owner_role: row.owner_role,
      due_date: toISODateString(row.due_date) ?? dueDate,
      status: row.status,
      created_at: row.created_at,
    });
    applySupabaseCookies(res, pendingCookies);
    return res;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/relation .* does not exist|42P01/i.test(msg)) {
      const res = NextResponse.json(
        { error: "Training tasks not available. Run database migrations." },
        { status: 503 }
      );
      applySupabaseCookies(res, pendingCookies);
      return res;
    }
    console.error("[hr/training-tasks] POST", err);
    const res = NextResponse.json({ error: "Failed to create task" }, { status: 500 });
    applySupabaseCookies(res, pendingCookies);
    return res;
  }
}
