/**
 * GET /api/hr/jobs — list HR jobs for current org. Admin/HR only.
 * POST /api/hr/jobs — create HR job.
 *   Either: template_id + employee_id + optional title/rendered_body (existing flow).
 *   Or: template_code + employee_id + optional metadata { compliance_name, valid_to, status } (server prefills from template + metadata).
 */
import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db/pool";
import { requireAdminOrHr } from "@/lib/server/requireAdminOrHr";
import { createSupabaseServerClient, applySupabaseCookies, type CookieToSet } from "@/lib/supabase/server";

export const runtime = "nodejs";

function withCookies(res: NextResponse, pendingCookies: CookieToSet[]) {
  applySupabaseCookies(res, pendingCookies);
  return res;
}

function replacePlaceholders(text: string, vars: Record<string, string>): string {
  return text.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? "");
}

export async function GET(request: NextRequest) {
  const { supabase, pendingCookies } = await createSupabaseServerClient();
  const auth = await requireAdminOrHr(request, supabase);
  if (!auth.ok) {
    const res = NextResponse.json({ error: auth.error }, { status: auth.status });
    applySupabaseCookies(res, pendingCookies);
    return res;
  }

  const activeOnly = request.nextUrl.searchParams.get("active") === "true";

  try {
    const result = activeOnly
      ? await pool.query(
          `SELECT j.id, j.org_id, j.template_id, j.employee_id, j.title, j.rendered_body, j.status, j.created_at,
                  t.name AS template_name,
                  e.name AS employee_name, e.first_name, e.last_name, e.employee_number
           FROM hr_jobs j
           JOIN hr_templates t ON t.id = j.template_id
           JOIN employees e ON e.id = j.employee_id
           WHERE j.org_id = $1 AND j.status IN ('CREATED', 'SENT', 'SIGNED')
           ORDER BY CASE j.status WHEN 'CREATED' THEN 1 WHEN 'SENT' THEN 2 WHEN 'SIGNED' THEN 3 ELSE 4 END, j.created_at ASC
           LIMIT 200`,
          [auth.activeOrgId]
        )
      : await pool.query(
          `SELECT j.id, j.org_id, j.template_id, j.employee_id, j.title, j.rendered_body, j.status, j.created_at,
                  t.name AS template_name,
                  e.name AS employee_name, e.first_name, e.last_name, e.employee_number
           FROM hr_jobs j
           JOIN hr_templates t ON t.id = j.template_id
           JOIN employees e ON e.id = j.employee_id
           WHERE j.org_id = $1
           ORDER BY j.created_at DESC
           LIMIT 200`,
          [auth.activeOrgId]
        );

    const jobs = result.rows.map((row) => ({
      id: row.id,
      templateId: row.template_id,
      employeeId: row.employee_id,
      title: row.title,
      renderedBody: row.rendered_body,
      status: row.status,
      createdAt: row.created_at,
      templateName: row.template_name,
      employeeName: row.employee_name ?? ([row.first_name, row.last_name].filter(Boolean).join(" ") || "—"),
      employeeNumber: row.employee_number ?? "",
    }));

    const res = NextResponse.json(jobs);
    applySupabaseCookies(res, pendingCookies);
    return res;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("GET /api/hr/jobs failed:", msg);
    return withCookies(NextResponse.json({ error: msg }, { status: 500 }), pendingCookies);
  }
}

export async function POST(request: NextRequest) {
  const { supabase, pendingCookies } = await createSupabaseServerClient();
  const auth = await requireAdminOrHr(request, supabase);
  if (!auth.ok) {
    return withCookies(NextResponse.json({ error: auth.error }, { status: auth.status }), pendingCookies);
  }

  let body: {
    template_id?: string;
    template_code?: string;
    employee_id?: string;
    title?: string;
    rendered_body?: string;
    metadata?: Record<string, unknown>;
  };
  try {
    body = await request.json();
  } catch {
    return withCookies(NextResponse.json({ error: "Invalid JSON" }, { status: 400 }), pendingCookies);
  }

  const templateId = typeof body.template_id === "string" ? body.template_id.trim() : "";
  const templateCode = typeof body.template_code === "string" ? body.template_code.trim() : "";
  const employeeId = typeof body.employee_id === "string" ? body.employee_id.trim() : "";
  let title = typeof body.title === "string" ? body.title.trim() : "";
  let renderedBody = typeof body.rendered_body === "string" ? body.rendered_body : "";

  if (!employeeId) {
    return withCookies(
      NextResponse.json({ error: "employee_id is required" }, { status: 400 }),
      pendingCookies
    );
  }

  if (!templateId && !templateCode) {
    return withCookies(
      NextResponse.json({ error: "template_id or template_code is required" }, { status: 400 }),
      pendingCookies
    );
  }

  let resolvedTemplateId = templateId;
  if (templateCode && !resolvedTemplateId) {
    const tRes = await pool.query(
      `SELECT id, name, content FROM hr_templates WHERE org_id = $1 AND code = $2 AND is_active = true LIMIT 1`,
      [auth.activeOrgId, templateCode]
    );
    const tRow = tRes.rows[0];
    if (!tRow) {
      return withCookies(
        NextResponse.json(
          { error: `Template with code "${templateCode}" not found. Create it in HR Templates (e.g. code: ${templateCode}).` },
          { status: 400 }
        ),
        pendingCookies
      );
    }
    resolvedTemplateId = tRow.id;

    const meta = body.metadata && typeof body.metadata === "object" ? body.metadata : {};

    const empRes = await pool.query(
      `SELECT name, first_name, last_name, employee_number, team, line_code FROM employees WHERE id = $1 AND org_id = $2`,
      [employeeId, auth.activeOrgId]
    );
    const emp = empRes.rows[0];
    if (!emp) {
      return withCookies(NextResponse.json({ error: "Employee not found" }, { status: 404 }), pendingCookies);
    }
    const firstName = emp.first_name ?? "";
    const lastName = emp.last_name ?? "";
    const name = emp.name ?? ([firstName, lastName].filter(Boolean).join(" ") || "—");
    const orgUnit = emp.team || emp.line_code || "—";
    const vars: Record<string, string> = {
      first_name: firstName,
      last_name: lastName,
      name,
      employee_number: emp.employee_number ?? "",
      org_unit: orgUnit,
    };
    for (const [k, v] of Object.entries(meta)) {
      if (typeof v === "string" && /^\w+$/.test(k)) vars[k] = v;
    }

    const content = tRow.content ?? {};
    const bodySrc =
      typeof content === "object" && content !== null && "body" in content && typeof (content as { body: unknown }).body === "string"
        ? (content as { body: string }).body
        : "";
    const titleSrc =
      typeof content === "object" && content !== null && "title" in content && typeof (content as { title: unknown }).title === "string"
        ? (content as { title: string }).title
        : tRow.name ?? "HR Job";
    renderedBody = replacePlaceholders(bodySrc, vars);
    title = replacePlaceholders(titleSrc, vars) || tRow.name || "HR Job";
  }

  if (!resolvedTemplateId) {
    return withCookies(
      NextResponse.json({ error: "template_id or template_code is required" }, { status: 400 }),
      pendingCookies
    );
  }

  try {
    const result = await pool.query(
      `INSERT INTO hr_jobs (org_id, template_id, employee_id, title, rendered_body, status)
       VALUES ($1, $2, $3, $4, $5, 'CREATED')
       RETURNING id, title, status, created_at`,
      [auth.activeOrgId, resolvedTemplateId, employeeId, title || "HR Job", renderedBody]
    );

    const row = result.rows[0];
    if (!row) {
      return withCookies(NextResponse.json({ error: "Insert failed" }, { status: 500 }), pendingCookies);
    }

    await pool.query(
      `INSERT INTO hr_job_events (org_id, job_id, event_type, to_status, actor_user_id, actor_email)
       VALUES ($1, $2, 'CREATED', 'CREATED', $3, $4)`,
      [auth.activeOrgId, row.id, auth.userId, auth.userEmail ?? null]
    );

    const res = NextResponse.json({
      id: row.id,
      title: row.title,
      status: row.status,
      createdAt: row.created_at,
    });
    applySupabaseCookies(res, pendingCookies);
    return res;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("POST /api/hr/jobs failed:", msg);
    return withCookies(NextResponse.json({ error: msg }, { status: 500 }), pendingCookies);
  }
}
