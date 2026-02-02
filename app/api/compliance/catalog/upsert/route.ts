/**
 * POST /api/compliance/catalog/upsert — upsert catalog item by (org_id, code). Admin/HR only.
 * Body: { code, name, category, description?, default_validity_days?, site_id?, is_active? }
 */
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient, applySupabaseCookies } from "@/lib/supabase/server";
import { getActiveOrgFromSession } from "@/lib/server/activeOrg";
import { isHrAdmin } from "@/lib/auth";

const CATEGORIES = ["license", "medical", "contract"] as const;

function errorPayload(step: string, error: unknown, details?: string) {
  const msg = error instanceof Error ? error.message : String(error);
  return { ok: false as const, step, error: msg, ...(details != null && { details }) };
}

export async function POST(request: NextRequest) {
  const { supabase, pendingCookies } = await createSupabaseServerClient();
  const org = await getActiveOrgFromSession(request, supabase);
  if (!org.ok) {
    const res = NextResponse.json(errorPayload("getActiveOrg", org.error), { status: org.status });
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
    const res = NextResponse.json(errorPayload("forbidden", "Admin/HR only"), { status: 403 });
    applySupabaseCookies(res, pendingCookies);
    return res;
  }

  let body: Record<string, unknown> = {};
  try {
    body = await request.json();
  } catch {
    const res = NextResponse.json(errorPayload("body", "Invalid JSON"), { status: 400 });
    applySupabaseCookies(res, pendingCookies);
    return res;
  }

  const code = typeof body.code === "string" ? body.code.trim() : "";
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const category = typeof body.category === "string" && (CATEGORIES as readonly string[]).includes(body.category) ? body.category : null;
  if (!code || !name || !category) {
    const res = NextResponse.json(
      errorPayload("validation", "code, name, and category (license|medical|contract) are required"),
      { status: 400 }
    );
    applySupabaseCookies(res, pendingCookies);
    return res;
  }

  const description = typeof body.description === "string" ? body.description.trim() || null : null;
  const default_validity_days = typeof body.default_validity_days === "number" ? body.default_validity_days : null;
  const site_id = typeof body.site_id === "string" ? body.site_id || null : null;
  const is_active = body.is_active !== false;

  try {
    const row = {
      org_id: org.activeOrgId,
      site_id,
      category,
      code,
      name,
      description,
      default_validity_days,
      is_active,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from("compliance_catalog")
      .upsert(row, { onConflict: "org_id,code", ignoreDuplicates: false })
      .select("id, org_id, site_id, category, code, name, description, default_validity_days, is_active, created_at, updated_at")
      .single();

    if (error) {
      console.error("compliance/catalog/upsert", { step: "upsert", error });
      const res = NextResponse.json(errorPayload("upsert", error.message, error.details ?? undefined), { status: 500 });
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const item = data
      ? {
          id: data.id,
          org_id: data.org_id,
          site_id: data.site_id ?? null,
          category: data.category,
          code: data.code,
          name: data.name,
          description: data.description ?? null,
          default_validity_days: data.default_validity_days ?? null,
          is_active: data.is_active,
          created_at: data.created_at,
          updated_at: data.updated_at,
        }
      : null;

    const res = NextResponse.json({ ok: true, item });
    applySupabaseCookies(res, pendingCookies);
    return res;
  } catch (err) {
    console.error("POST /api/compliance/catalog/upsert failed:", err);
    const res = NextResponse.json(errorPayload("unexpected", err), { status: 500 });
    applySupabaseCookies(res, pendingCookies);
    return res;
  }
}
