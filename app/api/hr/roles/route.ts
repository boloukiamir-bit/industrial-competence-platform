/**
 * GET /api/hr/roles — list roles for the active org (for requirement rules dropdown).
 * Auth: requireAdminOrHr. Tenant: activeOrgId.
 * Returns: { ok: true, roles: [{ id, code, name }] }
 */
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient, applySupabaseCookies } from "@/lib/supabase/server";
import { requireAdminOrHr } from "@/lib/server/requireAdminOrHr";

export type RoleRow = { id: string; code: string; name: string };

export async function GET(request: NextRequest) {
  const { supabase, pendingCookies } = await createSupabaseServerClient(request);
  const auth = await requireAdminOrHr(request, supabase);
  if (!auth.ok) {
    const res = NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
    applySupabaseCookies(res, pendingCookies);
    return res;
  }

  try {
    const { data: rows, error } = await supabase
      .from("roles")
      .select("id, code, name")
      .eq("org_id", auth.activeOrgId)
      .order("code", { ascending: true });

    if (error) {
      console.error("[hr/roles] list error", error);
      const res = NextResponse.json(
        { ok: false, error: "Failed to load roles" },
        { status: 500 }
      );
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const roles: RoleRow[] = (rows ?? []).map(
      (r: { id: string; code: string; name: string }) => ({
        id: r.id,
        code: r.code,
        name: r.name,
      })
    );

    const res = NextResponse.json({ ok: true, roles });
    applySupabaseCookies(res, pendingCookies);
    return res;
  } catch (err) {
    console.error("[hr/roles] unexpected error", err);
    const res = NextResponse.json(
      { ok: false, error: "Internal error" },
      { status: 500 }
    );
    applySupabaseCookies(res, pendingCookies);
    return res;
  }
}
