/**
 * POST /api/employees/[id]/competence/upsert — upsert one skill rating.
 * Uses public.employee_skills as single source of truth.
 * Auth: admin/hr only. Tenant: org_id from session.
 * Body: { skill_id: string, level: number (0-4), valid_to?: string|null (YYYY-MM-DD) }
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireAdminOrHr } from "@/lib/server/requireAdminOrHr";
import { createSupabaseServerClient, applySupabaseCookies } from "@/lib/supabase/server";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: "Employee id required" }, { status: 400 });
    }

    const { supabase, pendingCookies } = await createSupabaseServerClient();
    const auth = await requireAdminOrHr(request, supabase);
    if (!auth.ok) {
      const res = NextResponse.json({ error: auth.error }, { status: auth.status });
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const body = await request.json().catch(() => ({}));
    const skillId = typeof body.skill_id === "string" ? body.skill_id.trim() : "";
    let level = typeof body.level === "number" ? body.level : parseInt(String(body.level ?? ""), 10);
    const validTo =
      body.valid_to === null || body.valid_to === undefined
        ? null
        : typeof body.valid_to === "string" && body.valid_to.trim()
          ? body.valid_to.trim()
          : null;

    if (!skillId) {
      const res = NextResponse.json({ error: "skill_id required" }, { status: 400 });
      applySupabaseCookies(res, pendingCookies);
      return res;
    }
    if (!Number.isFinite(level) || level < 0 || level > 4) {
      const res = NextResponse.json({ error: "level must be 0-4" }, { status: 400 });
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const { data: emp, error: empErr } = await supabaseAdmin
      .from("employees")
      .select("id")
      .eq("id", id)
      .eq("org_id", auth.activeOrgId)
      .maybeSingle();

    if (empErr || !emp) {
      const res = NextResponse.json({ error: "Employee not found" }, { status: 404 });
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const { data: skill, error: skillErr } = await supabaseAdmin
      .from("skills")
      .select("id")
      .eq("id", skillId)
      .eq("org_id", auth.activeOrgId)
      .maybeSingle();

    if (skillErr || !skill) {
      const res = NextResponse.json({ error: "Skill not found" }, { status: 404 });
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const row: Record<string, unknown> = {
      employee_id: id,
      skill_id: skillId,
      level,
    };
    if (validTo !== undefined) {
      row.valid_to = validTo;
    }

    const { error: upsertErr } = await supabaseAdmin
      .from("employee_skills")
      .upsert(row, {
        onConflict: "employee_id,skill_id",
      });

    if (upsertErr) {
      console.error("[api/employees/[id]/competence/upsert]", upsertErr);
      const res = NextResponse.json(
        { error: upsertErr.message || "Failed to upsert" },
        { status: 500 }
      );
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const res = NextResponse.json({ success: true });
    applySupabaseCookies(res, pendingCookies);
    return res;
  } catch (err) {
    console.error("[api/employees/[id]/competence/upsert]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
