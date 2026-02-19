/**
 * GET /api/hr/template-jobs — list jobs (scoped org/site). Query: status, q.
 * POST /api/hr/template-jobs — create job. Body: template_code, employee_id, owner_user_id?, due_date?, notes?, filled_values?
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { pool } from "@/lib/db/pool";
import { getActiveOrgFromSession } from "@/lib/server/activeOrg";
import { requireGovernedMutation } from "@/lib/server/governance/firewall";
import { withGovernanceGate } from "@/lib/server/governance/withGovernanceGate";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { createSupabaseServerClient, applySupabaseCookies } from "@/lib/supabase/server";

export const runtime = "nodejs";

function getAdmin(): ReturnType<typeof createClient> | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

function err(step: string, msg: string, status: number) {
  return NextResponse.json({ error: msg, step }, { status });
}

export async function GET(request: NextRequest) {
  const { supabase, pendingCookies } = await createSupabaseServerClient();
  const org = await getActiveOrgFromSession(request, supabase);
  if (!org.ok) {
    const res = NextResponse.json({ error: org.error }, { status: org.status });
    applySupabaseCookies(res, pendingCookies);
    return res;
  }
  const status = request.nextUrl.searchParams.get("status")?.trim() || null;
  const q = request.nextUrl.searchParams.get("q")?.trim() || null;

  try {
    let sql = `
      SELECT j.id, j.template_code, j.employee_id, j.owner_user_id, j.status, j.due_date, j.notes,
             j.filled_values, j.created_at, j.created_by,
             e.name as employee_name, e.employee_number
      FROM hr_template_jobs j
      JOIN employees e ON e.id = j.employee_id AND e.org_id = j.org_id
      WHERE j.org_id = $1 AND (j.site_id IS NULL OR j.site_id = $2)
    `;
    const params: (string | null)[] = [org.activeOrgId, org.activeSiteId];
    let i = 3;
    if (status) {
      sql += ` AND j.status = $${i}`;
      params.push(status);
      i++;
    }
    if (q) {
      sql += ` AND (e.name ILIKE $${i} OR e.employee_number ILIKE $${i} OR j.template_code ILIKE $${i})`;
      params.push(`%${q}%`);
      i++;
    }
    sql += ` ORDER BY j.created_at DESC LIMIT 100`;
    const result = await pool.query(sql, params);
    const jobs = result.rows.map((r) => ({
      id: r.id,
      templateCode: r.template_code,
      employeeId: r.employee_id,
      employeeName: r.employee_name ?? "",
      employeeNumber: r.employee_number ?? "",
      ownerUserId: r.owner_user_id ?? null,
      status: r.status,
      dueDate: r.due_date ?? null,
      notes: r.notes ?? null,
      filledValues: r.filled_values ?? {},
      createdAt: r.created_at,
      createdBy: r.created_by,
    }));
    const res = NextResponse.json({ jobs });
    applySupabaseCookies(res, pendingCookies);
    return res;
  } catch (e) {
    console.error("[template-jobs] GET error", e);
    const res = NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to fetch jobs" },
      { status: 500 }
    );
    applySupabaseCookies(res, pendingCookies);
    return res;
  }
}

export async function POST(request: NextRequest) {
  const { supabase, pendingCookies } = await createSupabaseServerClient(request);
  const org = await getActiveOrgFromSession(request, supabase);
  if (!org.ok) {
    const res = NextResponse.json({ error: org.error }, { status: org.status });
    applySupabaseCookies(res, pendingCookies);
    return res;
  }

  const admin = getAdmin();
  const fw = requireGovernedMutation({
    admin,
    governed: true,
    context: { route: "/api/hr/template-jobs", action: "HR_TEMPLATE_JOB_CREATE" },
  });
  if (!fw.ok) {
    const res = NextResponse.json(fw.body, { status: fw.status });
    applySupabaseCookies(res, pendingCookies);
    return res;
  }

  let body: {
    template_code?: string;
    employee_id?: string;
    owner_user_id?: string | null;
    due_date?: string | null;
    notes?: string | null;
    filled_values?: Record<string, unknown>;
  };
  try {
    body = await request.json();
  } catch {
    const res = err("body", "Invalid JSON", 400);
    applySupabaseCookies(res, pendingCookies);
    return res;
  }
  const templateCode = typeof body.template_code === "string" ? body.template_code.trim() : "";
  const employeeId = typeof body.employee_id === "string" ? body.employee_id.trim() : "";
  if (!templateCode || !employeeId) {
    const res = err("validation", "template_code and employee_id required", 400);
    applySupabaseCookies(res, pendingCookies);
    return res;
  }
  const ownerUserId =
    body.owner_user_id === null || body.owner_user_id === undefined
      ? org.userId
      : typeof body.owner_user_id === "string"
        ? body.owner_user_id.trim() || org.userId
        : org.userId;
  const dueDate =
    body.due_date == null ? null : typeof body.due_date === "string" ? body.due_date.trim() || null : null;
  const notes = body.notes == null ? null : typeof body.notes === "string" ? body.notes.trim() || null : null;
  const filledValues =
    body.filled_values != null && typeof body.filled_values === "object" ? body.filled_values : {};

  const target_id = `template:${templateCode}:employee:${employeeId}`;

  try {
    const result = await withGovernanceGate({
    supabase,
    admin: admin!,
    orgId: org.activeOrgId,
    siteId: org.activeSiteId,
    context: {
      action: "HR_TEMPLATE_JOB_CREATE",
      target_type: "hr_template_job",
      target_id,
      meta: {
        route: "/api/hr/template-jobs",
        template_id: templateCode,
        employee_id: employeeId,
      },
    },
    handler: async () => {
      const ins = await pool.query(
        `INSERT INTO hr_template_jobs (org_id, site_id, template_code, employee_id, owner_user_id, status, due_date, notes, filled_values, created_by)
         VALUES ($1, $2, $3, $4, $5, 'OPEN', $6, $7, $8::jsonb, $9)
         RETURNING id, template_code, employee_id, owner_user_id, status, due_date, notes, filled_values, created_at`,
        [
          org.activeOrgId,
          org.activeSiteId ?? null,
          templateCode,
          employeeId,
          ownerUserId ?? null,
          dueDate,
          notes,
          JSON.stringify(filledValues),
          org.userId,
        ]
      );
      const row = ins.rows[0];
      const supabaseAdmin = getSupabaseAdmin();
      const root_cause = { type: "hr_template_job", template_code: templateCode, employee_id: employeeId };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabaseAdmin as any).from("execution_decisions").insert({
        org_id: org.activeOrgId,
        site_id: org.activeSiteId ?? null,
        decision_type: "hr_template_job_created",
        target_type: "hr_template_job",
        target_id: row.id,
        reason: `Job created: ${templateCode} for employee ${employeeId}`,
        root_cause,
        actions: { status: "OPEN" },
        status: "active",
        created_by: org.userId,
      });
      return {
        id: row.id,
        templateCode: row.template_code,
        employeeId: row.employee_id,
        ownerUserId: row.owner_user_id ?? null,
        status: row.status,
        dueDate: row.due_date ?? null,
        notes: row.notes ?? null,
        filledValues: row.filled_values ?? {},
        createdAt: row.created_at,
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
  } catch (e) {
    console.error("[template-jobs] POST error", e);
    const res = NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to create job" },
      { status: 500 }
    );
    applySupabaseCookies(res, pendingCookies);
    return res;
  }
}
