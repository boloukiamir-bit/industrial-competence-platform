/**
 * POST /api/line-overview/demand/generate
 * Admin/HR: generate demand rows for all stations in a line (date + shift).
 * Tenant-scoped via getActiveOrgFromSession. Idempotent: UPSERT by (org_id, plan_date, shift_type, station_id).
 * Body: { date: "YYYY-MM-DD", shiftType: "Day"|"Evening"|"Night", lineCode: string, hoursPerStation?: number }
 * Success: { ok: true, created, updated, message?: "already_exists" }.
 * Failure: { ok: false, step, error, details }.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseServerClient, applySupabaseCookies, type CookieToSet } from "@/lib/supabase/server";
import { getActiveOrgFromSession } from "@/lib/server/activeOrg";
import { normalizeShift } from "@/lib/shift";
import { getLineName } from "@/lib/lineOverviewLineNames";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const ALLOWED_SHIFTS = ["Day", "Evening", "Night"] as const;

function errorRes(
  payload: { ok: false; step: string; error: string; details?: unknown },
  status: number,
  pendingCookies: CookieToSet[]
) {
  const res = NextResponse.json(payload, { status });
  applySupabaseCookies(res, pendingCookies);
  return res;
}

export async function POST(request: NextRequest) {
  const { supabase, pendingCookies } = await createSupabaseServerClient();
  const org = await getActiveOrgFromSession(request, supabase);
  if (!org.ok) {
    return errorRes({ ok: false, step: "auth", error: org.error }, org.status, pendingCookies);
  }
  const { activeOrgId, userId } = org;

  const { data: membership } = await supabaseAdmin
    .from("memberships")
    .select("role")
    .eq("org_id", activeOrgId)
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle();

  const role = membership?.role ?? "";
  if (role !== "admin" && role !== "hr") {
    return errorRes(
      { ok: false, step: "auth", error: "Admin or HR role required" },
      403,
      pendingCookies
    );
  }

  const body = await request.json().catch(() => ({}));
  const date = typeof body.date === "string" ? body.date.trim() : "";
  const shiftType = normalizeShift(body.shiftType ?? "Day");
  const lineCode = typeof body.lineCode === "string" ? body.lineCode.trim() : "";
  const hoursPerStation =
    typeof body.hoursPerStation === "number" && body.hoursPerStation >= 0 ? body.hoursPerStation : 8;

  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return errorRes(
      { ok: false, step: "validation", error: "Missing or invalid date (YYYY-MM-DD)", details: { date } },
      400,
      pendingCookies
    );
  }
  if (!lineCode) {
    return errorRes(
      { ok: false, step: "validation", error: "Missing lineCode", details: {} },
      400,
      pendingCookies
    );
  }
  if (!shiftType || !ALLOWED_SHIFTS.includes(shiftType)) {
    return errorRes(
      {
        ok: false,
        step: "validation",
        error: "Invalid shiftType (Day|Evening|Night)",
        details: { shiftType: body.shiftType },
      },
      400,
      pendingCookies
    );
  }

  // Map line code to DB line name (Bearbetning/Packen/Logistik/Ommantling etc.)
  const lineName = getLineName(lineCode);
  const { data: stations, error: stationsError } = await supabaseAdmin
    .from("stations")
    .select("id, code, name")
    .eq("org_id", activeOrgId)
    .eq("line", lineName)
    .eq("is_active", true);

  if (stationsError) {
    console.error("[demand/generate] stations error", stationsError);
    return errorRes(
      { ok: false, step: "stations", error: "Failed to load stations", details: stationsError.message },
      500,
      pendingCookies
    );
  }

  const list = (stations ?? []) as { id: string; code: string | null; name?: string | null }[];

  if (list.length === 0) {
    const { data: allStations } = await supabaseAdmin
      .from("stations")
      .select("line")
      .eq("org_id", activeOrgId)
      .eq("is_active", true);
    const stationsPerLine: Record<string, number> = {};
    (allStations ?? []).forEach((s: { line?: string | null }) => {
      const line = s.line ?? "(null)";
      stationsPerLine[line] = (stationsPerLine[line] ?? 0) + 1;
    });
    return errorRes(
      {
        ok: false,
        step: "validation",
        error: `No stations for line "${lineCode}" (mapped to "${lineName}"). Check line code and that stations exist for this line.`,
        details: { lineCode, lineName, stationsPerLine },
      },
      400,
      pendingCookies
    );
  }

  // Idempotent: if demand already exists for all stations, return already_exists (no overwrite).
  const { data: existingDemand, error: existingErr } = await supabaseAdmin
    .from("pl_machine_demand")
    .select("id")
    .eq("org_id", activeOrgId)
    .eq("plan_date", date)
    .eq("shift_type", shiftType)
    .in("station_id", list.map((s) => s.id));

  if (existingErr) {
    return errorRes(
      { ok: false, step: "existing_check", error: "Failed to check existing demand", details: existingErr.message },
      500,
      pendingCookies
    );
  }

  const existingCount = (existingDemand ?? []).length;
  if (existingCount >= list.length) {
    const res = NextResponse.json({
      ok: true,
      created: 0,
      updated: 0,
      message: "already_exists",
    });
    applySupabaseCookies(res, pendingCookies);
    return res;
  }

  let created = 0;
  let updated = 0;

  for (const station of list) {
    const stationId = station.id;
    const machineCode = station.code != null && station.code !== "" ? station.code : station.id;

    const { data: existing } = await supabaseAdmin
      .from("pl_machine_demand")
      .select("id")
      .eq("org_id", activeOrgId)
      .eq("plan_date", date)
      .eq("shift_type", shiftType)
      .eq("station_id", stationId)
      .maybeSingle();

    if (existing) {
      const { error: updateErr } = await supabaseAdmin
        .from("pl_machine_demand")
        .update({
          machine_code: machineCode,
          required_hours: hoursPerStation,
          priority: 1,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id);

      if (updateErr) {
        console.error("[demand/generate] update error", { stationId, error: updateErr });
        continue;
      }
      updated += 1;
    } else {
      const { error: insertErr } = await supabaseAdmin
        .from("pl_machine_demand")
        .insert({
          org_id: activeOrgId,
          plan_date: date,
          shift_type: shiftType,
          station_id: stationId,
          machine_code: machineCode,
          required_hours: hoursPerStation,
          priority: 1,
          comment: null,
        });

      if (insertErr) {
        console.error("[demand/generate] insert error", { stationId, error: insertErr });
        continue;
      }
      created += 1;
    }
  }

  const res = NextResponse.json({ ok: true, created, updated });
  applySupabaseCookies(res, pendingCookies);
  return res;
}
