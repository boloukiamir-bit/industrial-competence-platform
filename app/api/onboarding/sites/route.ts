/**
 * GET /api/onboarding/sites — list sites for the active org (tenant-scoped).
 * Any org member. Used by onboarding UI for bootstrap site dropdown.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseServerClient, applySupabaseCookies } from "@/lib/supabase/server";
import { getOrgIdFromSession } from "@/lib/orgSession";
import { getSitesByOrg } from "@/lib/onboarding/resolveSites";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

export async function GET(request: NextRequest) {
  const { supabase, pendingCookies } = await createSupabaseServerClient();
  const session = await getOrgIdFromSession(request, supabase);
  if (!session.success) {
    const res = NextResponse.json({ error: session.error }, { status: session.status });
    applySupabaseCookies(res, pendingCookies);
    return res;
  }

  const sites = await getSitesByOrg(supabaseAdmin, session.orgId);
  const res = NextResponse.json({ sites });
  applySupabaseCookies(res, pendingCookies);
  return res;
}
