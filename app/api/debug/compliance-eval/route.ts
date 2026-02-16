/**
 * GET /api/debug/compliance-eval — compliance rule evaluation for one employee (Daniel pilot v1).
 * Dev-only. Returns required_compliance_codes, missing/expired/expiring buckets, risk_points.
 *
 * Query: employeeId (required), shift (or shift_code), stationId (optional), customerCode (optional).
 * Org/site from session (tenant-safe).
 *
 * Example curl (replace BASE and ensure session or Bearer):
 *   curl -s "${BASE}/api/debug/compliance-eval?employeeId=UUID&shift=Night&stationId=UUID" | jq .
 *   curl -s "${BASE}/api/debug/compliance-eval?employeeId=UUID&shift=Day" | jq .
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseServerClient, applySupabaseCookies } from "@/lib/supabase/server";
import { getActiveOrgFromSession } from "@/lib/server/activeOrg";
import { evaluateComplianceForEmployee } from "@/lib/compliance/evaluate";

export const runtime = "nodejs";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

export async function GET(request: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not available" }, { status: 404 });
  }

  try {
    const { supabase, pendingCookies } = await createSupabaseServerClient();
    const org = await getActiveOrgFromSession(request, supabase);
    if (!org.ok) {
      const res = NextResponse.json({ error: org.error }, { status: org.status });
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const { searchParams } = new URL(request.url);
    const employeeId = searchParams.get("employeeId")?.trim();
    const shift = searchParams.get("shift")?.trim() || searchParams.get("shift_code")?.trim();
    const stationId = searchParams.get("stationId")?.trim() || undefined;
    const customerCode = searchParams.get("customerCode")?.trim() || undefined;

    if (!employeeId) {
      const res = NextResponse.json(
        { error: "employeeId is required" },
        { status: 400 }
      );
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const ctx = {
      org_id: org.activeOrgId,
      site_id: org.activeSiteId,
      employee_id: employeeId,
      shift_code: shift ?? "Day",
      station_id: stationId ?? null,
      role_code: null,
      customer_code: customerCode ?? null,
    };

    const result = await evaluateComplianceForEmployee(
      supabaseAdmin,
      ctx,
      employeeId
    );

    const body = {
      ok: true,
      context: { org_id: ctx.org_id, site_id: ctx.site_id, employee_id: employeeId, shift_code: ctx.shift_code, station_id: ctx.station_id, customer_code: ctx.customer_code },
      required_compliance_codes: result.required_compliance_codes,
      missing: result.missing,
      expired: result.expired,
      expiring_7: result.expiring_7,
      expiring_30: result.expiring_30,
      valid: result.valid,
      risk_points: result.risk_points,
      items: result.items,
    };

    const res = NextResponse.json(body, { status: 200 });
    applySupabaseCookies(res, pendingCookies);
    return res;
  } catch (err) {
    console.error("[debug/compliance-eval] error:", err);
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}
