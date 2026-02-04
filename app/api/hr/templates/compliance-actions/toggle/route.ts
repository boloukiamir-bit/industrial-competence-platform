/**
 * POST /api/hr/templates/compliance-actions/toggle — set is_active on a template. Admin/HR only.
 * Body: { id, is_active }
 */
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient, applySupabaseCookies } from "@/lib/supabase/server";
import { requireAdminOrHr } from "@/lib/server/requireAdminOrHr";

function errorPayload(step: string, error: unknown) {
  const msg = error instanceof Error ? error.message : String(error);
  return { ok: false as const, step, error: msg };
}

export async function POST(request: NextRequest) {
  const { supabase, pendingCookies } = await createSupabaseServerClient();
  const auth = await requireAdminOrHr(request, supabase);
  if (!auth.ok) {
    const res = NextResponse.json(errorPayload("auth", auth.error), { status: auth.status });
    applySupabaseCookies(res, pendingCookies);
    return res;
  }

  let body: Record<string, unknown> = {};
  try {
    body = await request.json().catch(() => ({}));
  } catch {
    body = {};
  }

  const id = typeof body.id === "string" ? body.id.trim() : "";
  const is_active = body.is_active === true;

  if (!id) {
    const res = NextResponse.json(errorPayload("validation", "id is required"), { status: 400 });
    applySupabaseCookies(res, pendingCookies);
    return res;
  }

  const { createClient } = await import("@supabase/supabase-js");
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { error } = await supabaseAdmin
    .from("hr_templates")
    .update({ is_active, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("org_id", auth.activeOrgId);

  if (error) {
    const res = NextResponse.json(errorPayload("update", error.message), { status: 500 });
    applySupabaseCookies(res, pendingCookies);
    return res;
  }

  const res = NextResponse.json({ ok: true });
  applySupabaseCookies(res, pendingCookies);
  return res;
}
