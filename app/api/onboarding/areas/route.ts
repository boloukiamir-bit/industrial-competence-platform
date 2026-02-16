/**
 * GET /api/onboarding/areas — list active areas for the active org (for dropdowns).
 * Auth: org member.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseServerClient, applySupabaseCookies } from "@/lib/supabase/server";
import { getOrgIdFromSession } from "@/lib/orgSession";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

export type OnboardingAreaRow = {
  id: string;
  code: string;
  name: string;
  site_id: string | null;
};

export async function GET(request: NextRequest) {
  const { supabase, pendingCookies } = await createSupabaseServerClient();
  const session = await getOrgIdFromSession(request, supabase);
  if (!session.success) {
    const res = NextResponse.json({ error: session.error }, { status: session.status });
    applySupabaseCookies(res, pendingCookies);
    return res;
  }

  const { data, error } = await supabaseAdmin
    .from("areas")
    .select("id, code, name, site_id")
    .eq("org_id", session.orgId)
    .eq("is_active", true)
    .order("code", { ascending: true });

  if (error) {
    console.error("[onboarding/areas]", error);
    const res = NextResponse.json(
      { error: "Failed to load areas" },
      { status: 500 }
    );
    applySupabaseCookies(res, pendingCookies);
    return res;
  }

  const areas: OnboardingAreaRow[] = (data ?? []).map((r) => ({
    id: r.id,
    code: (r.code ?? "").trim(),
    name: (r.name ?? "").trim(),
    site_id: r.site_id ?? null,
  }));

  const res = NextResponse.json({ areas });
  applySupabaseCookies(res, pendingCookies);
  return res;
}
