/**
 * POST /api/hr/tasks/create — create a training task from Cockpit "Plan training" (admin/HR only).
 * Body: { template_id, title?, decision_id?, station_id?, station_name?, line?, shift?, shift_date?, due_date?, owner_role?, metadata? }
 * metadata: optional JSON object; stored as-is (expect keys: station_id, station_name, shift_code, issue_severity, compliance_risk_points, blockers[]).
 * Validation: template required; title optional (defaults to template name); due_date optional (default shift_date+14 or today+14); owner optional (default HR).
 * Dates: shift_date and due_date stored as DATE (YYYY-MM-DD); API returns ISO strings.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { pool } from "@/lib/db/pool";
import { parseDateForStorage, addDaysISO, toISODateString } from "@/lib/dateIso";
import { getActiveOrgFromSession } from "@/lib/server/activeOrg";
import { requireGovernedMutation } from "@/lib/server/governance/firewall";
import { withGovernanceGate } from "@/lib/server/governance/withGovernanceGate";
import { createSupabaseServerClient, applySupabaseCookies } from "@/lib/supabase/server";

export const runtime = "nodejs";

const VALID_OWNERS = ["Ops", "Supervisor", "HR"] as const;

function getAdmin(): ReturnType<typeof createClient> | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
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
    context: { route: "/api/hr/tasks/create", action: "HR_TASK_CREATE" },
  });
  if (!fw.ok) {
    const res = NextResponse.json(fw.body, { status: fw.status });
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
    const res = NextResponse.json(
      { error: "Forbidden: only admins and HR can create training tasks" },
      { status: 403 }
    );
    applySupabaseCookies(res, pendingCookies);
    return res;
  }

  let body: {
    template_id?: string;
    title?: string;
    decision_id?: string;
    station_id?: string;
    station_name?: string;
    line?: string;
    shift?: string;
    shift_date?: string;
    due_date?: string;
    owner_role?: string;
    target_employee_id?: string;
    metadata?: Record<string, unknown>;
  };
  try {
    body = await request.json();
  } catch {
    const res = NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    applySupabaseCookies(res, pendingCookies);
    return res;
  }

  const templateId = typeof body.template_id === "string" ? body.template_id.trim() : "";
  const sourceDecisionId =
    typeof body.decision_id === "string" ? body.decision_id.trim() || null : null;
  const stationId = typeof body.station_id === "string" ? body.station_id.trim() || null : null;
  const stationName = typeof body.station_name === "string" ? body.station_name.trim() || null : null;
  const line = typeof body.line === "string" ? body.line.trim() || null : null;
  const shiftCode = typeof body.shift === "string" ? body.shift.trim() || null : null;
  const shiftDate = parseDateForStorage(body.shift_date);
  const targetEmployeeId =
    typeof body.target_employee_id === "string" ? body.target_employee_id.trim() || null : null;
  const ownerRole =
    body.owner_role && VALID_OWNERS.includes(body.owner_role as (typeof VALID_OWNERS)[number])
      ? body.owner_role
      : "HR";

  let dueDate = parseDateForStorage(body.due_date);
  if (!dueDate) {
    dueDate = addDaysISO(shiftDate, 14);
  }

  if (!templateId) {
    const res = NextResponse.json({ error: "template_id is required" }, { status: 400 });
    applySupabaseCookies(res, pendingCookies);
    return res;
  }

  const target_id = `task:template:${templateId}:station:${stationId ?? "na"}:employee:${targetEmployeeId ?? "na"}`;

  try {
    const result = await withGovernanceGate({
    supabase,
    admin: admin!,
    orgId: activeOrgId,
    siteId: activeSiteId,
    context: {
      action: "HR_TASK_CREATE",
      target_type: "hr_task",
      target_id,
      meta: {
        route: "/api/hr/tasks/create",
        template_id: templateId,
        station_id: stationId ?? null,
        employee_id: targetEmployeeId ?? null,
      },
    },
    handler: async () => {
  const verify = await pool.query(
      `SELECT id, name FROM hr_workflows WHERE id = $1 AND org_id = $2 AND is_active = true LIMIT 1`,
      [templateId, activeOrgId]
    );
    if (verify.rows.length === 0) {
      throw new Error("Template not found or not in your org");
    }

    const templateName = (verify.rows[0]?.name as string) || "Training task";
    const customTitle = typeof body.title === "string" ? body.title.trim() || null : null;
    const title = customTitle ?? templateName;

    const metadata =
      body.metadata != null && typeof body.metadata === "object" && !Array.isArray(body.metadata)
        ? JSON.stringify(body.metadata)
        : "{}";

    let insert: { rows: { id: string; title: string; owner_role: string; due_date: unknown; status: string; created_at: unknown }[] };
    let metadataSupported = true;
    try {
      insert = await pool.query(
        `INSERT INTO hr_tasks (
           org_id, site_id, source_decision_id, template_id, title, owner_role, due_date, status, created_by,
           line, station_id, station_name, shift_code, shift_date, target_employee_id, metadata
         ) VALUES ($1, $2, $3, $4, $5, $6, $7::date, 'open', $8, $9, $10, $11, $12, $13::date, $14, $15::jsonb)
         RETURNING id, title, owner_role, due_date, status, created_at`,
        [
          activeOrgId,
          activeSiteId ?? null,
          sourceDecisionId,
          templateId,
          title,
          ownerRole,
          dueDate,
          userId,
          line,
          stationId,
          stationName,
          shiftCode,
          shiftDate,
          targetEmployeeId,
          metadata,
        ]
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (/column .* does not exist|42703/i.test(msg)) {
        console.warn("[HR_TASKS_METADATA_MISSING] falling back to insert without metadata");
        metadataSupported = false;
        insert = await pool.query(
          `INSERT INTO hr_tasks (
             org_id, site_id, source_decision_id, template_id, title, owner_role, due_date, status, created_by,
             line, station_id, station_name, shift_code, shift_date, target_employee_id
           ) VALUES ($1, $2, $3, $4, $5, $6, $7::date, 'open', $8, $9, $10, $11, $12, $13::date, $14)
           RETURNING id, title, owner_role, due_date, status, created_at`,
          [
            activeOrgId,
            activeSiteId ?? null,
            sourceDecisionId,
            templateId,
            title,
            ownerRole,
            dueDate,
            userId,
            line,
            stationId,
            stationName,
            shiftCode,
            shiftDate,
            targetEmployeeId,
          ]
        );
      } else {
        throw err;
      }
    }
    const row = insert.rows[0];
    return {
      success: true,
      id: row.id,
      title: row.title,
      owner_role: row.owner_role,
      shift_date: toISODateString(shiftDate),
      due_date: toISODateString(row.due_date) ?? dueDate,
      status: row.status,
      created_at: row.created_at,
      metadata_supported: metadataSupported,
    };
    }
  });

  if (!result.ok) {
    const res = NextResponse.json(
      { ok: false, error: result.error },
      { status: result.status }
    );
    applySupabaseCookies(res, pendingCookies);
    return res;
  }

  const res = NextResponse.json({ ok: true, ...result.data }, { status: 201 });
  applySupabaseCookies(res, pendingCookies);
  return res;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg === "Template not found or not in your org") {
      const res = NextResponse.json(
        { error: "Template not found or not in your org" },
        { status: 404 }
      );
      applySupabaseCookies(res, pendingCookies);
      return res;
    }
    if (/relation .* does not exist|42P01/i.test(msg)) {
      const res = NextResponse.json(
        { error: "Training tasks not available. Run database migrations." },
        { status: 503 }
      );
      applySupabaseCookies(res, pendingCookies);
      return res;
    }
    console.error("[hr/tasks/create] POST", err);
    const res = NextResponse.json({ error: "Failed to create task" }, { status: 500 });
    applySupabaseCookies(res, pendingCookies);
    return res;
  }
}
