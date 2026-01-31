/**
 * POST /api/line-overview/demand/generate
 * Admin-only: generate demand rows for all stations in a line (date + shift).
 * Tenant-scoped via getActiveOrgFromSession. Idempotent: upsert by (org_id, plan_date, shift_type, station_id).
 * Body: { date: "YYYY-MM-DD", shiftType: "Day"|"Evening"|"Night", lineCode: string, hoursPerStation?: number }
 * Returns: { created, updated }.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseServerClient, applySupabaseCookies } from "@/lib/supabase/server";
import { getActiveOrgFromSession } from "@/lib/server/activeOrg";
import { normalizeShiftTypeOrDefault } from "@/lib/shift";
import { getLineName } from "@/lib/lineOverviewLineNames";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const SHIFT_TYPES = ["Day", "Evening", "Night"] as const;

export async function POST(request: NextRequest) {
  try {
    const { supabase, pendingCookies } = await createSupabaseServerClient();
    const org = await getActiveOrgFromSession(request, supabase);
    if (!org.ok) {
      const res = NextResponse.json({ error: org.error }, { status: org.status });
      applySupabaseCookies(res, pendingCookies);
      return res;
    }
    const { activeOrgId, activeSiteId, userId } = org;

    const { data: membership } = await supabaseAdmin
      .from("memberships")
      .select("role")
      .eq("org_id", activeOrgId)
      .eq("user_id", userId)
      .eq("status", "active")
      .maybeSingle();

    const role = membership?.role ?? "";
    if (role !== "admin" && role !== "hr") {
      const res = NextResponse.json(
        { error: "Admin or HR role required" },
        { status: 403 }
      );
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const body = await request.json().catch(() => ({}));
    const date = typeof body.date === "string" ? body.date.trim() : "";
    const shiftType = normalizeShiftTypeOrDefault(body.shiftType ?? "Day");
    const lineCode = typeof body.lineCode === "string" ? body.lineCode.trim() : "";
    const hoursPerStation = typeof body.hoursPerStation === "number" && body.hoursPerStation >= 0
      ? body.hoursPerStation
      : 8;

    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      const res = NextResponse.json(
        { error: "Missing or invalid date (YYYY-MM-DD)" },
        { status: 400 }
      );
      applySupabaseCookies(res, pendingCookies);
      return res;
    }
    if (!lineCode) {
      const res = NextResponse.json(
        { error: "Missing lineCode" },
        { status: 400 }
      );
      applySupabaseCookies(res, pendingCookies);
      return res;
    }
    if (!SHIFT_TYPES.includes(shiftType)) {
      const res = NextResponse.json(
        { error: "Invalid shiftType (Day|Evening|Night)" },
        { status: 400 }
      );
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    // stations.line is Swedish name (e.g. Bearbetning); lineCode is BEA/OMM etc.
    const lineName = getLineName(lineCode);
    const { data: stations, error: stationsError } = await supabaseAdmin
      .from("stations")
      .select("id, code, name")
      .eq("org_id", activeOrgId)
      .eq("line", lineName)
      .eq("is_active", true);

    if (stationsError) {
      console.error("[demand/generate] stations error", stationsError);
      const res = NextResponse.json(
        { error: "Failed to load stations" },
        { status: 500 }
      );
      applySupabaseCookies(res, pendingCookies);
      return res;
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
      const diagnostic = {
        active_org_id: activeOrgId,
        active_site_id: activeSiteId ?? null,
        lineCode,
        line_name_tried: lineName,
        stations_for_line: 0,
        stations_per_line: stationsPerLine,
      };
      console.warn("[demand/generate] no stations for line", {
        tenant: activeOrgId,
        line: lineCode,
        lineName,
        stationsCount: 0,
        stationsPerLine,
      });
      const res = NextResponse.json(
        {
          error: `No stations for line "${lineCode}" (mapped to "${lineName}"). Cannot generate demand. Check org, line code, and that stations exist for this line.`,
          ...diagnostic,
        },
        { status: 400 }
      );
      applySupabaseCookies(res, pendingCookies);
      return res;
    }
    let created = 0;
    let updated = 0;

    for (const station of list) {
      const stationId = station.id;
      // machine_code from stations.code; fallback to station id only if code is null
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

    if (list.length > 0 && created + updated < list.length) {
      console.warn("[demand/generate] upsert count < stations", {
        tenant: activeOrgId,
        line: lineCode,
        lineName,
        stationsCount: list.length,
        created,
        updated,
      });
    }
    console.log("[demand/generate] ok", {
      tenant: activeOrgId,
      line: lineCode,
      lineName,
      stationsCount: list.length,
      created,
      updated,
    });
    const res = NextResponse.json({ created, updated });
    applySupabaseCookies(res, pendingCookies);
    return res;
  } catch (err) {
    console.error("[demand/generate]", err);
    return NextResponse.json(
      { error: "Failed to generate demand" },
      { status: 500 }
    );
  }
}
