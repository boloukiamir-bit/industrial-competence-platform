/**
 * GET /api/hr/templates/compliance-actions — templates for compliance action drafts.
 * Admin/HR only. Returns templatesByActionType[action_type][channel] = { id, code, name, title, body, site_id }.
 * Merge: org-wide (site_id null) first, then overwrite with site-specific when activeSiteId provided.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseServerClient, applySupabaseCookies } from "@/lib/supabase/server";
import { getActiveOrgFromSession } from "@/lib/server/activeOrg";
import { isHrAdmin } from "@/lib/auth";
import {
  COMPLIANCE_ACTION_DRAFT_CATEGORY,
  buildCode,
  parseTemplate,
  type HrTemplateRow,
  type ParsedComplianceTemplate,
} from "@/lib/hrTemplatesCompliance";

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

  const activeSiteId = org.activeSiteId ?? null;

  try {
    let query = supabaseAdmin
      .from("hr_templates")
      .select("id, org_id, site_id, code, name, category, content, is_active")
      .eq("org_id", org.activeOrgId)
      .eq("category", COMPLIANCE_ACTION_DRAFT_CATEGORY)
      .eq("is_active", true);

    if (activeSiteId) {
      query = query.or(`site_id.is.null,site_id.eq.${activeSiteId}`);
    } else {
      query = query.is("site_id", null);
    }

    const { data: rows, error } = await query;

    if (error) {
      console.error("hr/templates/compliance-actions list", error);
      const res = NextResponse.json(errorPayload("list", error.message), { status: 500 });
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const templates = (rows ?? []) as HrTemplateRow[];
    type ByChannel = Record<string, ParsedComplianceTemplate & { site_id: string | null }>;
    const templatesByActionType: Record<string, ByChannel> = {};

    const orgRows = templates.filter((r) => r.site_id == null);
    const siteRows = activeSiteId ? templates.filter((r) => r.site_id === activeSiteId) : [];
    for (const row of [...orgRows, ...siteRows]) {
      const parsed = parseTemplate(row);
      if (!templatesByActionType[parsed.action_type]) {
        templatesByActionType[parsed.action_type] = {};
      }
      templatesByActionType[parsed.action_type]![parsed.channel] = {
        ...parsed,
        site_id: row.site_id ?? null,
      };
    }

    const res = NextResponse.json({
      ok: true,
      templatesByActionType,
    });
    applySupabaseCookies(res, pendingCookies);
    return res;
  } catch (err) {
    console.error("GET /api/hr/templates/compliance-actions failed:", err);
    const res = NextResponse.json(errorPayload("unexpected", err), { status: 500 });
    applySupabaseCookies(res, pendingCookies);
    return res;
  }
}
