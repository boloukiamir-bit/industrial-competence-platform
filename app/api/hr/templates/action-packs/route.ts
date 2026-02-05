/**
 * GET /api/hr/templates/action-packs — list compliance action pack templates grouped by category.
 * Categories: license, medical, contract. Any org member can view (managers + admin/hr).
 * Returns { categories: [ { category, templates: [{ id, name, description, stepCount }] } ] }.
 */
import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db/pool";
import { getActiveOrgFromSession } from "@/lib/server/activeOrg";
import { createSupabaseServerClient, applySupabaseCookies } from "@/lib/supabase/server";

export const runtime = "nodejs";

const ACTION_PACK_CATEGORIES = ["license", "medical", "contract"] as const;

type ContentShape = {
  description?: string;
  steps?: Array<{ order?: number; title?: string; note?: string }>;
};

function parseTemplate(row: { id: string; name: string; content: unknown }) {
  const content = (row.content ?? {}) as ContentShape;
  const steps = Array.isArray(content.steps) ? content.steps : [];
  return {
    id: row.id,
    name: row.name,
    description: typeof content.description === "string" ? content.description : "",
    stepCount: steps.length,
  };
}

export async function GET(request: NextRequest) {
  const { supabase, pendingCookies } = await createSupabaseServerClient();
  const org = await getActiveOrgFromSession(request, supabase);
  if (!org.ok) {
    const res = NextResponse.json({ error: org.error }, { status: org.status });
    applySupabaseCookies(res, pendingCookies);
    return res;
  }

  try {
    const result = await pool.query(
      `SELECT id, name, category, content
       FROM hr_templates
       WHERE org_id = $1 AND is_active = true
         AND category = ANY($2::text[])
       ORDER BY category, name`,
      [org.activeOrgId, ACTION_PACK_CATEGORIES]
    );

    const byCategory = new Map<string, { id: string; name: string; description: string; stepCount: number }[]>();
    for (const cat of ACTION_PACK_CATEGORIES) {
      byCategory.set(cat, []);
    }
    for (const row of result.rows) {
      const category = row.category as string;
      if (ACTION_PACK_CATEGORIES.includes(category as (typeof ACTION_PACK_CATEGORIES)[number])) {
        const list = byCategory.get(category) ?? [];
        list.push(parseTemplate({ id: row.id, name: row.name, content: row.content }));
        byCategory.set(category, list);
      }
    }

    const categories = Array.from(byCategory.entries()).map(([category, templates]) => ({
      category,
      templates,
    }));

    return NextResponse.json({ categories });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (/relation .* does not exist|connect ECONNREFUSED|Missing DATABASE_URL/i.test(message)) {
      return NextResponse.json({ categories: [] });
    }
    console.error("GET /api/hr/templates/action-packs failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch action packs" },
      { status: 500 }
    );
  }
}
