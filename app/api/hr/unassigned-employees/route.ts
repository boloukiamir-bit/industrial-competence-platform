/**
 * GET /api/hr/unassigned-employees
 * Returns employees where (site_id IS NULL OR org_unit_id IS NULL) for Organization Overview.
 * Tenant-scoped by active org_id. Excludes ARCHIVED.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getActiveOrgFromSession } from "@/lib/server/activeOrg";
import { createSupabaseServerClient, applySupabaseCookies } from "@/lib/supabase/server";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  try {
    const { supabase, pendingCookies } = await createSupabaseServerClient(request);
    const org = await getActiveOrgFromSession(request, supabase);
    if (!org.ok) {
      const res = NextResponse.json({ error: org.error }, { status: org.status });
      applySupabaseCookies(res, pendingCookies);
      return res;
    }
    if (!org.activeOrgId?.trim()) {
      const res = NextResponse.json({ error: "Missing organization context" }, { status: 403 });
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const { data, error } = await supabaseAdmin
      .from("employees")
      .select("id, name, site_id, org_unit_id")
      .eq("org_id", org.activeOrgId)
      .or("employment_status.is.null,employment_status.neq.ARCHIVED")
      .or("site_id.is.null,org_unit_id.is.null")
      .order("last_name", { ascending: true })
      .order("first_name", { ascending: true });

    if (error) {
      console.error("[api/hr/unassigned-employees] error", error);
      const res = NextResponse.json({ error: "Failed to load unassigned employees" }, { status: 500 });
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const employees = (data ?? []).map((row: { id: string; name: string | null; site_id: string | null; org_unit_id: string | null }) => ({
      id: row.id,
      name: row.name ?? "",
      site_id: row.site_id ?? null,
      org_unit_id: row.org_unit_id ?? null,
    }));
    const res = NextResponse.json({ ok: true, employees });
    applySupabaseCookies(res, pendingCookies);
    return res;
  } catch (err) {
    console.error("[api/hr/unassigned-employees]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
