/**
 * GET /api/org/identity — active organization + active site for header/identity layer.
 * Session required (401 if missing). Org required (403 if no active org).
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseServerClient, applySupabaseCookies } from "@/lib/supabase/server";
import { getActiveOrgFromSession } from "@/lib/server/activeOrg";

function getAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase configuration");
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

export async function GET(request: NextRequest) {
  const { supabase, pendingCookies } = await createSupabaseServerClient(request);
  const org = await getActiveOrgFromSession(request, supabase);

  if (!org.ok) {
    const status = org.status;
    const res = NextResponse.json(
      { ok: false, error: org.error },
      { status }
    );
    applySupabaseCookies(res, pendingCookies);
    return res;
  }

  const admin = getAdmin();
  const { data: orgRow, error: orgErr } = await admin
    .from("organizations")
    .select("id, name, logo_url")
    .eq("id", org.activeOrgId)
    .maybeSingle();

  if (orgErr || !orgRow) {
    const res = NextResponse.json(
      { ok: false, error: "Organization not found" },
      { status: 403 }
    );
    applySupabaseCookies(res, pendingCookies);
    return res;
  }

  const orgPayload = {
    id: (orgRow as { id: string }).id,
    name: (orgRow as { name: string }).name ?? "",
    logo_url: (orgRow as { logo_url?: string | null }).logo_url ?? undefined,
  };

  let sitePayload: { id: string; name: string } | null = null;
  if (org.activeSiteId) {
    const { data: siteRow, error: siteErr } = await admin
      .from("sites")
      .select("id, name")
      .eq("id", org.activeSiteId)
      .eq("org_id", org.activeOrgId)
      .maybeSingle();
    if (!siteErr && siteRow) {
      sitePayload = {
        id: (siteRow as { id: string }).id,
        name: (siteRow as { name: string }).name ?? "",
      };
    }
  }

  const res = NextResponse.json({
    ok: true,
    org: orgPayload,
    site: sitePayload,
  });
  applySupabaseCookies(res, pendingCookies);
  return res;
}
