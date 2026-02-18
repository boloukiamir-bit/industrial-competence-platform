/**
 * GET /api/cockpit/shift-ids?date=YYYY-MM-DD&shift_code=<code>
 * Returns shift IDs for (org, site, date, shift_code). Single source of truth: shift_code.
 * Also accepts legacy params: shift, shift_type (same normalization as shift_code).
 * Used by Cockpit for Industrial Readiness and any shift-scoped data.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseServerClient, applySupabaseCookies } from "@/lib/supabase/server";
import { getActiveOrgFromSession } from "@/lib/server/activeOrg";
import { normalizeShiftParam } from "@/lib/server/fetchCockpitIssues";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  try {
    const { supabase, pendingCookies } = await createSupabaseServerClient(request);
    const org = await getActiveOrgFromSession(request, supabase);
    if (!org.ok) {
      const res = NextResponse.json({ ok: false, error: org.error }, { status: org.status });
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const searchParams = request.nextUrl.searchParams;
    const date = searchParams.get("date")?.trim();
    const shiftCodeParam =
      searchParams.get("shift_code") ?? searchParams.get("shift") ?? searchParams.get("shift_type");
    const shiftCode = normalizeShiftParam(shiftCodeParam);

    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      const res = NextResponse.json(
        { ok: false, error: "date is required (YYYY-MM-DD)", step: "validation" },
        { status: 400 }
      );
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    if (!shiftCode) {
      const res = NextResponse.json(
        {
          ok: false,
          error: "Invalid shift parameter (use shift_code, e.g. Day, S1)",
          step: "validation",
          details: { shift_code: shiftCodeParam ?? null },
        },
        { status: 400 }
      );
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const orgId = org.activeOrgId;
    const siteId = org.activeSiteId;

    let shiftsQuery = supabaseAdmin
      .from("shifts")
      .select("id")
      .eq("org_id", orgId)
      .eq("shift_date", date)
      .eq("shift_code", shiftCode);

    if (siteId) {
      shiftsQuery = shiftsQuery.or(`site_id.is.null,site_id.eq.${siteId}`);
    }

    const { data: rows, error } = await shiftsQuery;

    if (error) {
      console.error("[cockpit/shift-ids] shifts query error:", error);
      const res = NextResponse.json(
        { ok: false, error: "Failed to fetch shift IDs", step: "query", details: error.message },
        { status: 500 }
      );
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const shift_ids = (rows ?? []).map((r: { id: string }) => r.id).filter(Boolean);
    const res = NextResponse.json({ ok: true, shift_ids });
    applySupabaseCookies(res, pendingCookies);
    return res;
  } catch (err) {
    console.error("[cockpit/shift-ids] error:", err);
    const message = err instanceof Error ? err.message : "Failed to load shift IDs";
    return NextResponse.json(
      { ok: false, error: message, step: "exception" },
      { status: 500 }
    );
  }
}
