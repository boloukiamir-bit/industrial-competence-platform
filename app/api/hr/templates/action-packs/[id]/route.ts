/**
 * GET /api/hr/templates/action-packs/[id] — single action pack template with ordered steps.
 * Any org member can view (read-only for managers).
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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { supabase, pendingCookies } = await createSupabaseServerClient();
  const org = await getActiveOrgFromSession(request, supabase);
  if (!org.ok) {
    const res = NextResponse.json({ error: org.error }, { status: org.status });
    applySupabaseCookies(res, pendingCookies);
    return res;
  }

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "Missing template id" }, { status: 400 });
  }

  try {
    const result = await pool.query(
      `SELECT id, name, category, content
       FROM hr_templates
       WHERE id = $1 AND org_id = $2 AND is_active = true
         AND category = ANY($3::text[])`,
      [id, org.activeOrgId, ACTION_PACK_CATEGORIES]
    );

    const row = result.rows[0];
    if (!row) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }

    const content = (row.content ?? {}) as ContentShape;
    const rawSteps = Array.isArray(content.steps) ? content.steps : [];
    const steps = rawSteps
      .map((s, i) => ({
        step_order: typeof s.order === "number" ? s.order : i + 1,
        step_title: typeof s.title === "string" ? s.title : "",
        step_note: typeof s.note === "string" ? s.note : "",
      }))
      .sort((a, b) => a.step_order - b.step_order);

    return NextResponse.json({
      id: row.id,
      name: row.name,
      category: row.category,
      description: typeof content.description === "string" ? content.description : "",
      steps,
    });
  } catch (err) {
    console.error("GET /api/hr/templates/action-packs/[id] failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch template" },
      { status: 500 }
    );
  }
}
