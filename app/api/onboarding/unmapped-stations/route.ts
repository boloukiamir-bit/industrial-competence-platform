/**
 * GET /api/onboarding/unmapped-stations — up to 50 stations in active org where area_id is null.
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

export type UnmappedStationRow = {
  id: string;
  code: string;
  name: string;
  area_code: string | null;
  line: string | null;
  is_active: boolean;
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
    .from("stations")
    .select("id, code, name, area_code, line, is_active")
    .eq("org_id", session.orgId)
    .eq("is_active", true)
    .is("area_id", null)
    .limit(50)
    .order("code", { ascending: true });

  if (error) {
    console.error("[onboarding/unmapped-stations]", error);
    const res = NextResponse.json(
      { error: "Failed to load unmapped stations" },
      { status: 500 }
    );
    applySupabaseCookies(res, pendingCookies);
    return res;
  }

  const stations: UnmappedStationRow[] = (data ?? []).map((r) => ({
    id: r.id,
    code: (r.code ?? "").trim(),
    name: (r.name ?? "").trim(),
    area_code: r.area_code != null ? String(r.area_code).trim() : null,
    line: r.line != null ? String(r.line).trim() : null,
    is_active: Boolean(r.is_active),
  }));

  const res = NextResponse.json({ stations });
  applySupabaseCookies(res, pendingCookies);
  return res;
}
