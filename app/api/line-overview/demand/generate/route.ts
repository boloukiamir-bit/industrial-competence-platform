/**
 * POST /api/line-overview/demand/generate
 * Admin/HR: generate demand rows. Governed via withMutationGovernance (tolerateInvalidJson).
 */
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { withMutationGovernance } from "@/lib/server/governance/withMutationGovernance";
import { normalizeShift } from "@/lib/shift";
import { getLineName } from "@/lib/lineOverviewLineNames";
import { isHrAdmin } from "@/lib/auth";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const ALLOWED_SHIFTS = ["Day", "Evening", "Night"] as const;

export const POST = withMutationGovernance(
  async (ctx) => {
    const { data: membership } = await ctx.supabase
      .from("memberships")
      .select("role")
      .eq("org_id", ctx.orgId)
      .eq("user_id", ctx.userId)
      .eq("status", "active")
      .maybeSingle();

    if (!isHrAdmin(membership?.role)) {
      return NextResponse.json(
        { ok: false, step: "auth", error: "Admin or HR role required" },
        { status: 403 }
      );
    }

    const body = ctx.body as Record<string, unknown>;
    const date = typeof body.date === "string" ? body.date.trim() : "";
    const shiftType = normalizeShift(typeof body.shiftType === "string" ? body.shiftType : "Day");
    const lineCode = typeof body.lineCode === "string" ? body.lineCode.trim() : "";
    const hoursPerStation =
      typeof body.hoursPerStation === "number" && body.hoursPerStation >= 0 ? body.hoursPerStation : 8;

    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json(
        { ok: false, step: "validation", error: "Missing or invalid date (YYYY-MM-DD)", details: { date } },
        { status: 400 }
      );
    }
    if (!lineCode) {
      return NextResponse.json(
        { ok: false, step: "validation", error: "Missing lineCode", details: {} },
        { status: 400 }
      );
    }
    if (!shiftType || !ALLOWED_SHIFTS.includes(shiftType)) {
      return NextResponse.json(
        {
          ok: false,
          step: "validation",
          error: "Invalid shiftType (Day|Evening|Night)",
          details: { shiftType: body.shiftType },
        },
        { status: 400 }
      );
    }

    const activeOrgId = ctx.orgId;
    const lineName = getLineName(lineCode);
    const { data: stations, error: stationsError } = await ctx.admin
      .from("stations")
      .select("id, code, name")
      .eq("org_id", activeOrgId)
      .eq("line", lineName)
      .eq("is_active", true);

    if (stationsError) {
      console.error("[demand/generate] stations error", stationsError);
      return NextResponse.json(
        { ok: false, step: "stations", error: "Failed to load stations", details: stationsError.message },
        { status: 500 }
      );
    }

    const list = (stations ?? []) as { id: string; code: string | null; name?: string | null }[];

    if (list.length === 0) {
      const { data: allStations } = await ctx.admin
        .from("stations")
        .select("line")
        .eq("org_id", activeOrgId)
        .eq("is_active", true);
      const stationsPerLine: Record<string, number> = {};
      (allStations ?? []).forEach((s: { line?: string | null }) => {
        const line = s.line ?? "(null)";
        stationsPerLine[line] = (stationsPerLine[line] ?? 0) + 1;
      });
      return NextResponse.json(
        {
          ok: false,
          step: "validation",
          error: `No stations for line "${lineCode}" (mapped to "${lineName}"). Check line code and that stations exist for this line.`,
          details: { lineCode, lineName, stationsPerLine },
        },
        { status: 400 }
      );
    }

    const { data: existingDemand, error: existingErr } = await ctx.admin
      .from("pl_machine_demand")
      .select("id")
      .eq("org_id", activeOrgId)
      .eq("plan_date", date)
      .eq("shift_type", shiftType)
      .in("station_id", list.map((s) => s.id));

    if (existingErr) {
      return NextResponse.json(
        { ok: false, step: "existing_check", error: "Failed to check existing demand", details: existingErr.message },
        { status: 500 }
      );
    }

    const existingCount = (existingDemand ?? []).length;
    if (existingCount >= list.length) {
      return NextResponse.json({
        ok: true,
        created: 0,
        updated: 0,
        message: "already_exists",
      });
    }

    let created = 0;
    let updated = 0;

    for (const station of list) {
      const stationId = station.id;
      const machineCode = station.code != null && station.code !== "" ? station.code : station.id;

      const { data: existing } = await ctx.admin
        .from("pl_machine_demand")
        .select("id")
        .eq("org_id", activeOrgId)
        .eq("plan_date", date)
        .eq("shift_type", shiftType)
        .eq("station_id", stationId)
        .maybeSingle();

      if (existing) {
        const { error: updateErr } = await ctx.admin
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
        const { error: insertErr } = await ctx.admin
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

    return NextResponse.json({ ok: true, created, updated });
  },
  {
    route: "/api/line-overview/demand/generate",
    action: "LINE_OVERVIEW_DEMAND_GENERATE",
    target_type: "demand",
    allowNoShiftContext: true,
    tolerateInvalidJson: true,
    getTargetIdAndMeta: (body) => ({
      target_id: [body.date, body.shiftType, body.lineCode].filter(Boolean).join(":") || "unknown",
      meta: {},
    }),
  }
);
