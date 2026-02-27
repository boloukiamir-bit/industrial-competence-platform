/**
 * GET /api/hr/requirements/catalog
 * Compliance requirement catalog for the org. Auth: requireAdminOrHr. Tenant: activeOrgId.
 * Query: q (optional, ilike on code/name), activeOnly (default true).
 * Returns: { ok: true, requirements: [{ id, code, name, category }] }
 */
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient, applySupabaseCookies } from "@/lib/supabase/server";
import { requireAdminOrHr } from "@/lib/server/requireAdminOrHr";

function escapeIlike(q: string): string {
  return q.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

export type CatalogRequirement = {
  id: string;
  code: string;
  name: string;
  category: string | null;
  description: string | null;
  criticality: string;
  is_active: boolean;
};

export async function GET(request: NextRequest) {
  const { supabase, pendingCookies } = await createSupabaseServerClient(request);
  const auth = await requireAdminOrHr(request, supabase);
  if (!auth.ok) {
    const res = NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
    applySupabaseCookies(res, pendingCookies);
    return res;
  }

  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") ?? "").trim();
  const activeOnly = searchParams.get("activeOnly") !== "false";

  try {
    let query = supabase
      .from("compliance_requirements")
      .select("id, code, name, category, description, criticality, is_active")
      .eq("org_id", auth.activeOrgId);

    if (activeOnly) {
      query = query.eq("is_active", true);
    }
    if (q.length > 0) {
      const escaped = escapeIlike(q).replace(/,/g, " ");
      const pattern = `%${escaped}%`;
      query = query.or(`code.ilike.${pattern},name.ilike.${pattern}`);
    }

    const { data: rows, error } = await query.order("code", { ascending: true });

    if (error) {
      console.error("[hr/requirements/catalog] fetch error", error);
      const res = NextResponse.json(
        { ok: false, error: "Failed to load catalog" },
        { status: 500 }
      );
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const requirements: CatalogRequirement[] = (rows ?? []).map(
      (r: {
        id: string;
        code: string;
        name: string;
        category: string | null;
        description: string | null;
        criticality: string;
        is_active: boolean;
      }) => ({
        id: r.id,
        code: r.code,
        name: r.name,
        category: r.category ?? null,
        description: r.description ?? null,
        criticality: r.criticality ?? "MEDIUM",
        is_active: r.is_active ?? true,
      })
    );

    const res = NextResponse.json({ ok: true, requirements });
    applySupabaseCookies(res, pendingCookies);
    return res;
  } catch (err) {
    console.error("[hr/requirements/catalog] unexpected error", err);
    const res = NextResponse.json(
      { ok: false, error: "Internal error" },
      { status: 500 }
    );
    applySupabaseCookies(res, pendingCookies);
    return res;
  }
}
