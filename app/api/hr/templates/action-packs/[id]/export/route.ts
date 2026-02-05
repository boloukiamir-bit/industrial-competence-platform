/**
 * GET /api/hr/templates/action-packs/[id]/export — CSV export of template steps.
 * Admin/HR only. Columns: step_order, step_title, step_note.
 */
import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db/pool";
import { getActiveOrgFromSession } from "@/lib/server/activeOrg";
import { createSupabaseServerClient, applySupabaseCookies } from "@/lib/supabase/server";
import { isHrAdmin } from "@/lib/auth";
import { escapeCsvField } from "@/lib/csvEscape";

export const runtime = "nodejs";

const ACTION_PACK_CATEGORIES = ["license", "medical", "contract"] as const;

type ContentShape = {
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

  const { data: membership } = await supabase
    .from("memberships")
    .select("role")
    .eq("user_id", org.userId)
    .eq("org_id", org.activeOrgId)
    .eq("status", "active")
    .maybeSingle();

  if (!isHrAdmin(membership?.role)) {
    const res = NextResponse.json({ error: "Admin/HR only" }, { status: 403 });
    applySupabaseCookies(res, pendingCookies);
    return res;
  }

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "Missing template id" }, { status: 400 });
  }

  try {
    const result = await pool.query(
      `SELECT id, name, content
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

    const header = ["step_order", "step_title", "step_note"];
    const csvRows = [
      header.map(escapeCsvField).join(","),
      ...steps.map((s) =>
        [String(s.step_order), s.step_title, s.step_note].map(escapeCsvField).join(",")
      ),
    ];
    const csv = csvRows.join("\n");
    const filename = `action-pack-${(row.name as string).replace(/[^a-zA-Z0-9-_]/g, "-")}-${new Date().toISOString().slice(0, 10)}.csv`;

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    console.error("GET /api/hr/templates/action-packs/[id]/export failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Export failed" },
      { status: 500 }
    );
  }
}
