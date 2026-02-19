/**
 * GET /api/cockpit/shift-codes?date=YYYY-MM-DD
 * Returns distinct, tenant-scoped shift codes for the given date (from shifts table).
 * Canonical order: S1, S2, S3, Day, Evening, Night, then rest alphabetically.
 * Auth/tenant: getActiveOrgFromSession; requires active_site_id (403 if missing).
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

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const SHIFT_SORT_ORDER = ["S1", "S2", "S3", "Day", "Evening", "Night"];

function sortShiftCodes(codes: string[]): string[] {
  return [...codes].sort((a, b) => {
    const ia = SHIFT_SORT_ORDER.indexOf(a);
    const ib = SHIFT_SORT_ORDER.indexOf(b);
    if (ia !== -1 && ib !== -1) return ia - ib;
    if (ia !== -1) return -1;
    if (ib !== -1) return 1;
    return a.localeCompare(b);
  });
}

export type ShiftCodesResponse = { ok: true; shift_codes: string[] };

export async function GET(request: NextRequest) {
  const { supabase, pendingCookies } = await createSupabaseServerClient(request);
  const org = await getActiveOrgFromSession(request, supabase);
  if (!org.ok) {
    const res = NextResponse.json({ ok: false, error: org.error }, { status: org.status });
    applySupabaseCookies(res, pendingCookies);
    return res;
  }

  const activeSiteId = org.activeSiteId;
  if (!activeSiteId) {
    const res = NextResponse.json(
      { ok: false, error: "Active site is required. Set active_site_id on your profile." },
      { status: 403 }
    );
    applySupabaseCookies(res, pendingCookies);
    return res;
  }

  const date = request.nextUrl.searchParams.get("date")?.trim();
  if (!date || !DATE_RE.test(date)) {
    const res = NextResponse.json(
      { ok: false, error: "date is required (YYYY-MM-DD)" },
      { status: 400 }
    );
    applySupabaseCookies(res, pendingCookies);
    return res;
  }

  let query = supabaseAdmin
    .from("shifts")
    .select("shift_code")
    .eq("org_id", org.activeOrgId)
    .eq("shift_date", date)
    .or(`site_id.is.null,site_id.eq.${activeSiteId}`);

  const { data: rows, error } = await query;

  if (error) {
    console.error("[cockpit/shift-codes] shifts query error:", error);
    const res = NextResponse.json(
      { ok: false, error: "Failed to fetch shift codes" },
      { status: 500 }
    );
    applySupabaseCookies(res, pendingCookies);
    return res;
  }

  const rawCodes = (rows ?? [])
    .map((r: { shift_code?: string | null }) => r.shift_code)
    .filter((c): c is string => c != null && String(c).trim() !== "");

  const normalized = rawCodes
    .map((c) => normalizeShiftParam(c))
    .filter((c): c is string => c != null);
  const unique = Array.from(new Set(normalized));
  const shift_codes = sortShiftCodes(unique);

  const res = NextResponse.json({ ok: true, shift_codes } satisfies ShiftCodesResponse);
  applySupabaseCookies(res, pendingCookies);
  return res;
}
