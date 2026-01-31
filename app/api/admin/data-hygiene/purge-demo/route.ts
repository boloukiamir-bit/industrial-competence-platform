/**
 * POST /api/admin/data-hygiene/purge-demo
 * Admin-only: deactivate demo/test employees for the active organization.
 * Uses service role for DB writes. Idempotent; returns { deactivatedEmployees }.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getOrgIdFromSession } from "@/lib/orgSession";
import { createSupabaseServerClient, applySupabaseCookies } from "@/lib/supabase/server";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/** Configurable list of employee_numbers to always treat as demo (deactivate). */
const DEMO_EMPLOYEE_NUMBERS: string[] = ["20022", "t001"];

const ALLOWED_ROLES = ["admin", "hr"];

export async function POST(request: NextRequest) {
  try {
    const { supabase, pendingCookies } = await createSupabaseServerClient();
    const session = await getOrgIdFromSession(request, supabase);
    if (!session.success) {
      const res = NextResponse.json({ error: session.error }, { status: session.status });
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    if (!ALLOWED_ROLES.includes(session.role)) {
      const res = NextResponse.json(
        { error: "Admin or HR role required for this organization" },
        { status: 403 }
      );
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const activeOrgId = session.orgId;

    const baseFilter = supabaseAdmin
      .from("employees")
      .select("id")
      .eq("org_id", activeOrgId)
      .eq("is_active", true);

    const [patternRes, inListRes] = await Promise.all([
      baseFilter.or(
        "employee_number.like.E9*,employee_number.like.E100*,employee_number.like.TEST*,name.ilike.*Test*"
      ),
      DEMO_EMPLOYEE_NUMBERS.length > 0
        ? supabaseAdmin
            .from("employees")
            .select("id")
            .eq("org_id", activeOrgId)
            .eq("is_active", true)
            .in("employee_number", DEMO_EMPLOYEE_NUMBERS)
        : Promise.resolve({ data: [] as { id: string }[], error: null }),
    ]);

    if (patternRes.error) {
      console.error("[purge-demo] pattern query", patternRes.error);
      const res = NextResponse.json(
        { error: "Failed to find demo employees" },
        { status: 500 }
      );
      applySupabaseCookies(res, pendingCookies);
      return res;
    }
    if (inListRes.error) {
      console.error("[purge-demo] in-list query", inListRes.error);
      const res = NextResponse.json(
        { error: "Failed to find demo employees" },
        { status: 500 }
      );
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const ids = new Set<string>();
    (patternRes.data ?? []).forEach((r) => ids.add(r.id));
    (inListRes.data ?? []).forEach((r) => ids.add(r.id));

    if (ids.size === 0) {
      const res = NextResponse.json({ deactivatedEmployees: 0 });
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const { error: updateError } = await supabaseAdmin
      .from("employees")
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .in("id", Array.from(ids));

    if (updateError) {
      console.error("[purge-demo] update", updateError);
      const res = NextResponse.json(
        { error: "Failed to deactivate employees" },
        { status: 500 }
      );
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const res = NextResponse.json({ deactivatedEmployees: ids.size });
    applySupabaseCookies(res, pendingCookies);
    return res;
  } catch (err) {
    console.error("[purge-demo]", err);
    return NextResponse.json(
      { error: "Purge failed" },
      { status: 500 }
    );
  }
}
