/**
 * GET /api/cockpit/shift-legitimacy/[shiftId] — read-only Shift Legitimacy Drilldown.
 * Resolves org + site from session. Optional ?date=YYYY-MM-DD for reference date.
 * No mutation, no governance wrapper.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseServerClient, applySupabaseCookies } from "@/lib/supabase/server";
import { getActiveOrgFromSession } from "@/lib/server/activeOrg";
import { getShiftLegitimacyDrilldown } from "@/lib/server/legitimacy/getShiftLegitimacyDrilldown";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ shiftId: string }> }
) {
  const { supabase, pendingCookies } = await createSupabaseServerClient(request);
  const org = await getActiveOrgFromSession(request, supabase);
  if (!org.ok) {
    const res = NextResponse.json({ error: org.error }, { status: org.status });
    applySupabaseCookies(res, pendingCookies);
    return res;
  }

  const { shiftId } = await params;
  if (!shiftId?.trim()) {
    const res = NextResponse.json({ error: "shiftId is required" }, { status: 400 });
    applySupabaseCookies(res, pendingCookies);
    return res;
  }

  const url = new URL(request.url);
  const dateParam = url.searchParams.get("date")?.trim() || null;
  const referenceDate = dateParam
    ? (() => {
        const d = new Date(dateParam + "T00:00:00.000Z");
        return isNaN(d.getTime()) ? new Date() : d;
      })()
    : new Date();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    const res = NextResponse.json(
      { error: "Server configuration error" },
      { status: 500 }
    );
    applySupabaseCookies(res, pendingCookies);
    return res;
  }

  try {
    const admin = createClient(supabaseUrl, serviceRoleKey);
    const result = await getShiftLegitimacyDrilldown(admin, {
      orgId: org.activeOrgId,
      siteId: org.activeSiteId,
      shiftId: shiftId.trim(),
      referenceDate,
    });
    const res = NextResponse.json(result);
    applySupabaseCookies(res, pendingCookies);
    return res;
  } catch (err) {
    console.error("[cockpit/shift-legitimacy]", err);
    const res = NextResponse.json(
      { error: "Failed to load shift legitimacy drilldown" },
      { status: 500 }
    );
    applySupabaseCookies(res, pendingCookies);
    return res;
  }
}
