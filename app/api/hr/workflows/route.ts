/**
 * GET /api/hr/workflows — active HR workflows with steps for current org/site.
 * Tenant-safe: org_id from session; site_id filter when activeSiteId present.
 */
import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db/pool";
import { getActiveOrgFromSession } from "@/lib/server/activeOrg";
import { createSupabaseServerClient, applySupabaseCookies } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const { supabase, pendingCookies } = await createSupabaseServerClient();
  const org = await getActiveOrgFromSession(request, supabase);
  if (!org.ok) {
    const res = NextResponse.json({ error: org.error }, { status: org.status });
    applySupabaseCookies(res, pendingCookies);
    return res;
  }

  const { activeOrgId, activeSiteId } = org;
  try {
    const rows = await pool.query(
      `SELECT w.id AS workflow_id, w.code, w.name, w.description,
              s.code AS step_code, s.name AS step_name, s.step_order, s.default_due_days, s.required
       FROM hr_workflows w
       LEFT JOIN hr_workflow_steps s ON s.workflow_id = w.id
       WHERE w.org_id = $1 AND w.is_active = true
         AND ($2::uuid IS NULL OR w.site_id IS NULL OR w.site_id = $2)
       ORDER BY w.code, s.step_order NULLS LAST`,
      [activeOrgId, activeSiteId]
    );

    const byWorkflow = new Map<
      string,
      { code: string; name: string; description: string | null; steps: Array<{ code: string; name: string; order: number; defaultDueDays: number | null; required: boolean }> }
    >();
    for (const row of rows.rows) {
      const key = row.workflow_id;
      if (!byWorkflow.has(key)) {
        byWorkflow.set(key, {
          code: row.code,
          name: row.name,
          description: row.description ?? null,
          steps: [],
        });
      }
      if (row.step_code != null) {
        byWorkflow.get(key)!.steps.push({
          code: row.step_code,
          name: row.step_name,
          order: row.step_order,
          defaultDueDays: row.default_due_days ?? null,
          required: row.required ?? true,
        });
      }
    }
    const workflows = [...byWorkflow.values()];

    return NextResponse.json(workflows);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (/relation .* does not exist|connect ECONNREFUSED|Missing DATABASE_URL/i.test(message)) {
      return NextResponse.json([]);
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch workflows" },
      { status: 500 }
    );
  }
}
