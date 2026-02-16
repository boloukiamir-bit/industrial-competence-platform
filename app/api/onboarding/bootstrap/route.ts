/**
 * POST /api/onboarding/bootstrap
 * Validates shift_patterns, areas, and stations for (site_id, date, shift_code); then runs
 * deterministic shift seed (same logic as /api/shifts/seed). Admin/HR only.
 * Input: { site_id: string, date: "YYYY-MM-DD", shift_code: string }
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseServerClient, applySupabaseCookies } from "@/lib/supabase/server";
import { requireAdminOrHr } from "@/lib/server/requireAdminOrHr";
import { runSeedShifts } from "@/lib/server/seedShifts";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

function parseDate(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const trimmed = v.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return null;
  return trimmed;
}

export async function POST(request: NextRequest) {
  const { supabase, pendingCookies } = await createSupabaseServerClient();
  const auth = await requireAdminOrHr(request, supabase);
  if (!auth.ok) {
    const res = NextResponse.json({ error: auth.error }, { status: auth.status });
    applySupabaseCookies(res, pendingCookies);
    return res;
  }

  const orgId = auth.activeOrgId;

  let body: Record<string, unknown>;
  try {
    body = await request.json().catch(() => ({}));
  } catch {
    const res = NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    );
    applySupabaseCookies(res, pendingCookies);
    return res;
  }

  const siteId = typeof body.site_id === "string" ? body.site_id.trim() || null : null;
  const date = parseDate(body.date);
  const shiftCode = typeof body.shift_code === "string" ? body.shift_code.trim() || null : null;

  if (!siteId || !date || !shiftCode) {
    const res = NextResponse.json(
      { error: "site_id, date (YYYY-MM-DD), and shift_code are required" },
      { status: 400 }
    );
    applySupabaseCookies(res, pendingCookies);
    return res;
  }

  const { data: siteRow, error: siteErr } = await supabaseAdmin
    .from("sites")
    .select("id, org_id")
    .eq("id", siteId)
    .maybeSingle();

  if (siteErr) {
    console.error("[onboarding/bootstrap] sites query error:", siteErr);
    const res = NextResponse.json(
      { error: "Failed to validate site", details: siteErr.message },
      { status: 500 }
    );
    applySupabaseCookies(res, pendingCookies);
    return res;
  }
  if (!siteRow?.id) {
    const res = NextResponse.json(
      { error: "Site not found", site_id: siteId },
      { status: 404 }
    );
    applySupabaseCookies(res, pendingCookies);
    return res;
  }
  if (siteRow.org_id !== orgId) {
    const res = NextResponse.json(
      { error: "Site does not belong to your organization" },
      { status: 403 }
    );
    applySupabaseCookies(res, pendingCookies);
    return res;
  }

  let result;
  try {
    result = await runSeedShifts(supabaseAdmin, orgId, siteId, date, shiftCode);
  } catch (err) {
    console.error("[onboarding/bootstrap] runSeedShifts error:", err);
    const res = NextResponse.json(
      {
        error: err instanceof Error ? err.message : "Seed failed",
      },
      { status: 500 }
    );
    applySupabaseCookies(res, pendingCookies);
    return res;
  }

  if (!result.ok) {
    const res = NextResponse.json(
      {
        error: result.message,
        areas_found: result.areas_found ?? 0,
        stations_found_total: result.stations_found_total ?? 0,
      },
      { status: 422 }
    );
    applySupabaseCookies(res, pendingCookies);
    return res;
  }

  const res = NextResponse.json({
    ok: true,
    site_id: siteId,
    date,
    shift_code: shiftCode,
    areas_found: result.areas_found,
    stations_found_total: result.stations_found_total,
    summary: {
      shifts_count: result.summary.shifts_count,
      assignments_count: result.summary.assignments_count,
      created: {
        shifts: result.summary.shifts_created,
        assignments: result.summary.assignments_created,
      },
      updated: {
        shifts: result.summary.shifts_existing,
        assignments: result.summary.assignments_existing,
      },
    },
  });
  applySupabaseCookies(res, pendingCookies);
  return res;
}
