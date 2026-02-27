/**
 * GET /api/org-units — tenant-scoped by session (active_org_id).
 * Returns flat list of org units for dropdowns (e.g. Employee master in edit drawer).
 * Response: { ok, org_units: [{ id, name, parent_id }] }.
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
      .from("org_units")
      .select("id, name, parent_id")
      .eq("org_id", org.activeOrgId)
      .order("name");

    if (error) {
      console.error("[api/org-units] error", error);
      const res = NextResponse.json({ error: "Failed to load org units" }, { status: 500 });
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const org_units = (data ?? []).map((row: { id: string; name: string; parent_id: string | null }) => ({
      id: row.id,
      name: row.name ?? "",
      parent_id: row.parent_id ?? null,
    }));
    const res = NextResponse.json({ ok: true, org_units });
    applySupabaseCookies(res, pendingCookies);
    return res;
  } catch (err) {
    console.error("[api/org-units]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
