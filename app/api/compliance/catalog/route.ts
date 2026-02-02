/**
 * GET /api/compliance/catalog — active catalog grouped by category.
 * Scope: active_org_id. Auth from cookies/bearer. Fail loud with { ok: false, step, error, details }.
 */
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient, applySupabaseCookies } from "@/lib/supabase/server";
import { getActiveOrgFromSession } from "@/lib/server/activeOrg";

function errorPayload(step: string, error: unknown, details?: string) {
  const msg = error instanceof Error ? error.message : String(error);
  return { ok: false as const, step, error: msg, ...(details != null && { details }) };
}

export async function GET(request: NextRequest) {
  const { supabase, pendingCookies } = await createSupabaseServerClient();
  const org = await getActiveOrgFromSession(request, supabase);
  if (!org.ok) {
    const res = NextResponse.json(errorPayload("getActiveOrg", org.error), { status: org.status });
    applySupabaseCookies(res, pendingCookies);
    return res;
  }

  try {
    const { data, error } = await supabase
      .from("compliance_catalog")
      .select("id, org_id, site_id, category, code, name, description, default_validity_days, is_active, created_at, updated_at")
      .eq("org_id", org.activeOrgId)
      .eq("is_active", true)
      .order("category")
      .order("code");

    if (error) {
      console.error("compliance/catalog GET", { step: "select", error });
      const res = NextResponse.json(errorPayload("catalog_select", error.message, error.details ?? undefined), { status: 500 });
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    type CatalogRow = { id: string; org_id: string; site_id: string | null; category: string; code: string; name: string; description: string | null; default_validity_days: number | null; is_active: boolean; created_at: string; updated_at: string };
    const items = (data ?? []).map((r: CatalogRow) => ({
      id: r.id,
      org_id: r.org_id,
      site_id: r.site_id ?? null,
      category: r.category,
      code: r.code,
      name: r.name,
      description: r.description ?? null,
      default_validity_days: r.default_validity_days ?? null,
      is_active: r.is_active,
      created_at: r.created_at,
      updated_at: r.updated_at,
    }));

    const byCategory: Record<string, typeof items> = {};
    for (const item of items) {
      const cat = item.category;
      if (!byCategory[cat]) byCategory[cat] = [];
      byCategory[cat].push(item);
    }

    const res = NextResponse.json({ ok: true, catalog: items, byCategory });
    applySupabaseCookies(res, pendingCookies);
    return res;
  } catch (err) {
    console.error("GET /api/compliance/catalog failed:", err);
    const res = NextResponse.json(errorPayload("unexpected", err), { status: 500 });
    applySupabaseCookies(res, pendingCookies);
    return res;
  }
}
