/**
 * POST /api/shifts/seed
 * Deterministic shift seed: create shifts and shift_assignments for a site/date/shift_code.
 * Input: { site_id, date, shift_code }
 * Hard-fails on missing session; 403 if site not in org; 404 if pattern missing; 422 if no areas.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getOrgIdFromSession } from "@/lib/orgSession";
import { runSeedShifts } from "@/lib/server/seedShifts";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function parseDate(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const trimmed = v.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return null;
  return trimmed;
}

export async function POST(request: NextRequest) {
  try {
    const session = await getOrgIdFromSession(request);
    if (!session.success) {
      return NextResponse.json({ error: session.error }, { status: session.status });
    }
    const orgId = session.orgId;
    if (!orgId) {
      return NextResponse.json({ error: "Organization could not be resolved" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const siteId = typeof body.site_id === "string" ? body.site_id.trim() || null : null;
    const date = parseDate(body.date);
    const shiftCode = typeof body.shift_code === "string" ? body.shift_code.trim() || null : null;

    if (!siteId || !date || !shiftCode) {
      return NextResponse.json(
        { error: "site_id, date (YYYY-MM-DD), and shift_code are required" },
        { status: 400 }
      );
    }

    const { data: siteRow, error: siteErr } = await supabaseAdmin
      .from("sites")
      .select("id, org_id")
      .eq("id", siteId)
      .maybeSingle();

    if (siteErr) {
      console.error("[shifts/seed] sites query error:", siteErr);
      return NextResponse.json(
        { error: "Failed to validate site", details: siteErr.message },
        { status: 500 }
      );
    }
    if (!siteRow?.id) {
      return NextResponse.json({ error: "Site not found" }, { status: 404 });
    }
    if (siteRow.org_id !== orgId) {
      return NextResponse.json(
        { error: "Site does not belong to your organization" },
        { status: 403 }
      );
    }

    const result = await runSeedShifts(supabaseAdmin, orgId, siteId, date, shiftCode);

    if (!result.ok) {
      if (result.errorCode === "shift_pattern_missing") {
        return NextResponse.json(
          { error: result.message },
          { status: 404 }
        );
      }
      return NextResponse.json(
        {
          error: result.message,
          areas_found: result.areas_found ?? 0,
          stations_found_total: result.stations_found_total ?? 0,
        },
        { status: 422 }
      );
    }

    const res: Record<string, unknown> = {
      ok: true,
      summary: result.summary,
      site_id: siteId,
      date,
      shift_code: shiftCode,
      areas_found: result.areas_found,
      stations_found_total: result.stations_found_total,
    };

    return NextResponse.json(res);
  } catch (error) {
    console.error("[shifts/seed] error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Seed failed" },
      { status: 500 }
    );
  }
}
