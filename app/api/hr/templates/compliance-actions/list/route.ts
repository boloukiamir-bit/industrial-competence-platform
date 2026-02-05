/**
 * GET /api/hr/templates/compliance-actions/list — list compliance action draft templates for manager UI.
 * Admin/HR only. Returns templates (id, site_id, code, name, is_active, updated_at, content).
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseServerClient, applySupabaseCookies } from "@/lib/supabase/server";
import { getActiveOrgFromSession } from "@/lib/server/activeOrg";
import { isHrAdmin } from "@/lib/auth";
import { getActiveSiteName } from "@/lib/server/siteName";
import { normalizeProfileActiveSiteIfStale } from "@/lib/server/validateActiveSite";
import { COMPLIANCE_ACTION_DRAFT_CATEGORY } from "@/lib/hrTemplatesCompliance";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function errorPayload(step: string, error: unknown) {
  const msg = error instanceof Error ? error.message : String(error);
  return { ok: false as const, step, error: msg };
}

export async function GET(request: NextRequest) {
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

  const activeSiteIdRaw = org.activeSiteId ?? null;
  const activeSiteNameRaw =
    activeSiteIdRaw != null ? await getActiveSiteName(supabaseAdmin, activeSiteIdRaw, org.activeOrgId) : null;
  const { activeSiteId, activeSiteName } = await normalizeProfileActiveSiteIfStale(
    supabaseAdmin,
    org.userId,
    activeSiteIdRaw,
    activeSiteNameRaw
  );

  try {
    const { data: rows, error } = await supabaseAdmin
      .from("hr_templates")
      .select("id, site_id, code, name, is_active, updated_at, content")
      .eq("org_id", org.activeOrgId)
      .eq("category", COMPLIANCE_ACTION_DRAFT_CATEGORY)
      .order("code");

    if (error) {
      const res = NextResponse.json(errorPayload("list", error.message), { status: 500 });
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const templates = (rows ?? []).map((r: Record<string, unknown>) => ({
      id: r.id,
      site_id: r.site_id ?? null,
      code: r.code,
      name: r.name,
      is_active: r.is_active ?? true,
      updated_at: r.updated_at ?? null,
      content: (r.content as Record<string, unknown>) ?? {},
    }));

    const res = NextResponse.json({
      ok: true,
      templates,
      activeSiteId,
      activeSiteName,
    });
    applySupabaseCookies(res, pendingCookies);
    return res;
  } catch (err) {
    console.error("GET /api/hr/templates/compliance-actions/list failed:", err);
    const res = NextResponse.json(errorPayload("unexpected", err), { status: 500 });
    applySupabaseCookies(res, pendingCookies);
    return res;
  }
}
