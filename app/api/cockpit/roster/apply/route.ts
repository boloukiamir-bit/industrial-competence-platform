import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseServerClient, applySupabaseCookies } from "@/lib/supabase/server";
import { getActiveOrgFromSession } from "@/lib/server/activeOrg";
import { getFirstShiftIdForCockpit } from "@/lib/server/getCockpitReadiness";
import { normalizeShiftParam } from "@/lib/server/normalizeShift";
import { applyRosterToShift } from "@/lib/server/roster/applyRosterToShift";

export async function POST(request: NextRequest) {
  try {
    const { supabase, pendingCookies } = await createSupabaseServerClient(request);
    const org = await getActiveOrgFromSession(request, supabase);
    if (!org.ok) {
      const res = NextResponse.json({ ok: false, error: org.error }, { status: org.status });
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const body = await request.json().catch(() => ({}));
    const date = typeof body.date === "string" ? body.date.trim() : "";
    const shiftCodeRaw = typeof body.shift_code === "string" ? body.shift_code.trim() : "";
    const dryRun = body.dry_run === true;

    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json(
        { ok: false, error: "date is required (YYYY-MM-DD)" },
        { status: 400 }
      );
    }
    if (!shiftCodeRaw) {
      return NextResponse.json(
        { ok: false, error: "shift_code is required" },
        { status: 400 }
      );
    }

    const normalizedShiftCode = normalizeShiftParam(shiftCodeRaw);
    if (!normalizedShiftCode) {
      return NextResponse.json(
        { ok: false, error: "Invalid shift_code" },
        { status: 400 }
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json(
        { ok: false, error: "Server configuration error" },
        { status: 500 }
      );
    }

    const admin = createClient(supabaseUrl, serviceRoleKey);
    const shiftId = await getFirstShiftIdForCockpit(admin, {
      orgId: org.activeOrgId,
      siteId: org.activeSiteId,
      date,
      shift_code: normalizedShiftCode,
    });

    if (!shiftId) {
      return NextResponse.json(
        { ok: false, error: "No shift found for this date and shift_code" },
        { status: 404 }
      );
    }

    const result = await applyRosterToShift({
      supabaseAdmin: admin,
      org_id: org.activeOrgId,
      site_id: org.activeSiteId,
      shift_id: shiftId,
      shift_code: normalizedShiftCode,
      dry_run: dryRun,
    });

    const res = NextResponse.json({ ok: true, result });
    applySupabaseCookies(res, pendingCookies);
    return res;
  } catch (err) {
    console.error("[cockpit/roster/apply] error:", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Failed to apply roster" },
      { status: 500 }
    );
  }
}
