import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient, applySupabaseCookies } from "@/lib/supabase/server";
import { resolveAuthFromRequest } from "@/lib/server/auth";

type ActiveOrganizationContext = {
  ok: true;
  org_id: string | null;
  org_name: string | null;
  site_id: string | null;
  site_name: string | null;
  logo_url: string | null;
};

export async function GET(request: NextRequest) {
  try {
    const { supabase, pendingCookies } = await createSupabaseServerClient(request);
    const resolved = await resolveAuthFromRequest(request, { supabase, pendingCookies });
    if (!resolved.ok || !resolved.user) {
      const res = NextResponse.json(
        { ok: false, error: resolved.ok ? "Invalid or expired session" : resolved.error },
        { status: 401 }
      );
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const { data: profile } = await resolved.supabase
      .from("profiles")
      .select("active_org_id, active_site_id")
      .eq("id", resolved.user.id)
      .single();

    const activeOrgId = (profile as { active_org_id?: string | null } | null)?.active_org_id ?? null;
    const activeSiteId = (profile as { active_site_id?: string | null } | null)?.active_site_id ?? null;

    const orgRow = activeOrgId
      ? await resolved.supabase
          .from("organizations")
          .select("id, name, logo_url")
          .eq("id", activeOrgId)
          .maybeSingle()
      : { data: null, error: null };
    if (orgRow.error) {
      console.error("[context/active-organization] org lookup failed:", orgRow.error);
    }

    const siteRow = activeSiteId
      ? await resolved.supabase
          .from("sites")
          .select("id, name")
          .eq("id", activeSiteId)
          .maybeSingle()
      : { data: null, error: null };
    if (siteRow.error) {
      console.error("[context/active-organization] site lookup failed:", siteRow.error);
    }

    const payload: ActiveOrganizationContext = {
      ok: true,
      org_id: activeOrgId,
      org_name: orgRow.data?.name ?? null,
      site_id: activeSiteId,
      site_name: siteRow.data?.name ?? null,
      logo_url: orgRow.data?.logo_url ?? null,
    };

    const res = NextResponse.json(payload);
    applySupabaseCookies(res, resolved.pendingCookies ?? pendingCookies);
    return res;
  } catch (err) {
    console.error("[context/active-organization] unexpected error:", err);
    return NextResponse.json({ error: "Failed to load organization context" }, { status: 500 });
  }
}
