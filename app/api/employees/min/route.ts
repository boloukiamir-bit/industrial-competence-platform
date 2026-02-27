/**
 * GET /api/employees/min — tenant-scoped by session (active_org_id).
 * Returns minimal list { id, name } for dropdowns (e.g. Manager in Employee edit drawer).
 * name = first_name + ' ' + last_name.
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
      .select("id, first_name, last_name")
      .eq("org_id", org.activeOrgId)
      .or("employment_status.is.null,employment_status.neq.ARCHIVED")
      .order("name");

    if (error) {
      console.error("[api/employees/min] error", error);
      const res = NextResponse.json({ error: "Failed to load employees" }, { status: 500 });
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const employees = (data ?? []).map((row: { id: string; first_name: string | null; last_name: string | null }) => {
      const first = row.first_name ?? "";
      const last = row.last_name ?? "";
      const name = `${first} ${last}`.trim() || "—";
      return { id: row.id, name };
    });
    const res = NextResponse.json({ ok: true, employees });
    applySupabaseCookies(res, pendingCookies);
    return res;
  } catch (err) {
    console.error("[api/employees/min]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
