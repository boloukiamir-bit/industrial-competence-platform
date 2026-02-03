/**
 * GET /api/hr/templates — active HR templates for current org/site, grouped by category.
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
    const result = await pool.query(
      `SELECT code, name, category, content
       FROM hr_templates
       WHERE org_id = $1 AND is_active = true
         AND ($2::uuid IS NULL OR site_id IS NULL OR site_id = $2)
       ORDER BY category, code`,
      [activeOrgId, activeSiteId]
    );

    const byCategory = new Map<string, { code: string; name: string; content: unknown }[]>();
    for (const row of result.rows) {
      const list = byCategory.get(row.category) ?? [];
      list.push({
        code: row.code,
        name: row.name,
        content: row.content ?? {},
      });
      byCategory.set(row.category, list);
    }

    const data = Array.from(byCategory.entries()).map(([category, templates]) => ({
      category,
      templates,
    }));

    return NextResponse.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (/relation .* does not exist|connect ECONNREFUSED|Missing DATABASE_URL/i.test(message)) {
      return NextResponse.json([]);
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch templates" },
      { status: 500 }
    );
  }
}
