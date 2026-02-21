/**
 * GET /api/employees/resolve?employee_number=...
 * Resolves employee_number (e.g. anst_id from cockpit roster) to employee id (uuid).
 * Tenant-scoped by session (active_org_id). Cookie-based auth only.
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
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      const res = NextResponse.json(
        { ok: false, error: "Unauthorized", code: "UNAUTHENTICATED" },
        { status: 401 }
      );
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const org = await getActiveOrgFromSession(request, supabase);
    if (!org.ok) {
      const res = NextResponse.json(
        { ok: false, error: "Missing organization context", code: "ORG_CONTEXT_REQUIRED" },
        { status: 403 }
      );
      applySupabaseCookies(res, pendingCookies);
      return res;
    }
    if (!org.activeOrgId?.trim()) {
      const res = NextResponse.json(
        { ok: false, error: "Missing organization context", code: "ORG_CONTEXT_REQUIRED" },
        { status: 403 }
      );
      applySupabaseCookies(res, pendingCookies);
      return res;
    }
    if (org.activeSiteId == null || String(org.activeSiteId).trim() === "") {
      const res = NextResponse.json(
        { ok: false, error: "Missing site context", code: "SITE_CONTEXT_REQUIRED" },
        { status: 403 }
      );
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const employeeNumber = request.nextUrl.searchParams.get("employee_number")?.trim();
    if (!employeeNumber) {
      const res = NextResponse.json(
        { ok: false, error: "employee_number is required" },
        { status: 400 }
      );
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const { data, error } = await supabaseAdmin
      .from("employees")
      .select("id")
      .eq("org_id", org.activeOrgId)
      .eq("site_id", org.activeSiteId)
      .eq("employee_number", employeeNumber)
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error("[api/employees/resolve] GET error", error);
      const res = NextResponse.json(
        { ok: false, error: "Failed to resolve employee" },
        { status: 500 }
      );
      applySupabaseCookies(res, pendingCookies);
      return res;
    }
    if (!data) {
      const res = NextResponse.json(
        { ok: false, error: "Employee not found", code: "NOT_FOUND" },
        { status: 404 }
      );
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const res = NextResponse.json(
      { ok: true, employee_id: (data as { id: string }).id },
      { status: 200 }
    );
    applySupabaseCookies(res, pendingCookies);
    return res;
  } catch (err) {
    console.error("[api/employees/resolve] GET", err);
    return NextResponse.json(
      { ok: false, error: "Internal error" },
      { status: 500 }
    );
  }
}
