import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { createSupabaseServerClient, applySupabaseCookies } from "@/lib/supabase/server";
import { getActiveOrgFromSession } from "@/lib/server/activeOrg";
import { normalizeShift } from "@/lib/shift";
import { getLineName } from "@/lib/lineOverviewLineNames";
import { employeesBaseQuery } from "@/lib/employeesBaseQuery";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const createAssignmentSchema = z.object({
  stationId: z.string().uuid().optional(),
  machineCode: z.string().optional(),
  employeeCode: z.string(),
  date: z.string(),
  shift: z.string(),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
}).refine((d) => d.stationId ?? d.machineCode, { message: "stationId or machineCode required" });

export async function POST(request: NextRequest) {
  try {
    const { supabase, pendingCookies } = await createSupabaseServerClient();
    const org = await getActiveOrgFromSession(request, supabase);
    if (!org.ok) {
      const res = NextResponse.json({ ok: false, error: org.error, step: "auth" }, { status: org.status });
      applySupabaseCookies(res, pendingCookies);
      return res;
    }
    const activeOrgId = org.activeOrgId;

    const body = await request.json();
    const parsed = createAssignmentSchema.safeParse(body);

    if (!parsed.success) {
      const res = NextResponse.json(
        { ok: false, error: "Invalid input", step: "validation", details: parsed.error.issues },
        { status: 400 }
      );
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const { stationId: bodyStationId, machineCode: bodyMachineCode, employeeCode, date, shift } = parsed.data;

    const shiftType = normalizeShift(shift);
    if (!shiftType) {
      const res = NextResponse.json(
        { ok: false, error: "Invalid shift parameter", step: "validation", details: { shift } },
        { status: 400 }
      );
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    let stationId: string;
    let lineCode: string;
    let machineCode: string;

    if (bodyStationId) {
      const { data: stationRow, error: stationError } = await supabaseAdmin
        .from("stations")
        .select("id, line, code")
        .eq("org_id", activeOrgId)
        .eq("is_active", true)
        .eq("id", bodyStationId)
        .maybeSingle();
      if (stationError) {
        const res = NextResponse.json(
          { ok: false, error: "Station lookup failed", step: "station", details: stationError.message },
          { status: 500 }
        );
        applySupabaseCookies(res, pendingCookies);
        return res;
      }
      if (!stationRow?.line) {
        const res = NextResponse.json(
          { ok: false, error: "Invalid station", step: "validation" },
          { status: 400 }
        );
        applySupabaseCookies(res, pendingCookies);
        return res;
      }
      stationId = stationRow.id as string;
      lineCode = stationRow.line as string;
      machineCode = (stationRow.code ?? stationRow.id) as string;
    } else if (bodyMachineCode) {
      const { data: stationRow, error: stationError } = await supabaseAdmin
        .from("stations")
        .select("id, line, code")
        .eq("org_id", activeOrgId)
        .eq("is_active", true)
        .eq("code", bodyMachineCode)
        .maybeSingle();
      if (stationError) {
        const res = NextResponse.json(
          { ok: false, error: "Station lookup failed", step: "station", details: stationError.message },
          { status: 500 }
        );
        applySupabaseCookies(res, pendingCookies);
        return res;
      }
      if (!stationRow?.line) {
        const res = NextResponse.json(
          { ok: false, error: "Invalid station or machineCode", step: "validation" },
          { status: 400 }
        );
        applySupabaseCookies(res, pendingCookies);
        return res;
      }
      stationId = stationRow.id as string;
      lineCode = stationRow.line as string;
      machineCode = (stationRow.code ?? stationRow.id) as string;
    } else {
      const res = NextResponse.json(
        { ok: false, error: "stationId or machineCode required", step: "validation" },
        { status: 400 }
      );
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const lineForShift = getLineName(lineCode);

    const { data: shiftRow, error: shiftError } = await supabaseAdmin
      .from("shifts")
      .select("id, shift_date, shift_type, line")
      .eq("org_id", activeOrgId)
      .eq("shift_date", date)
      .eq("shift_type", shiftType)
      .eq("line", lineForShift)
      .maybeSingle();

    if (shiftError) {
      const res = NextResponse.json(
        { ok: false, error: "Shift lookup failed", step: "shift", details: shiftError.message },
        { status: 500 }
      );
      applySupabaseCookies(res, pendingCookies);
      return res;
    }
    if (!shiftRow?.id) {
      const res = NextResponse.json(
        { ok: false, error: "No shift found for date/shift/line", step: "shift", details: { date, shiftType, lineForShift } },
        { status: 404 }
      );
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const shiftId = shiftRow.id;
    const shiftDate = shiftRow.shift_date ?? date;
    const shiftLine = shiftRow.line ?? lineForShift;

    const { data: employeeRow, error: employeeError } = await employeesBaseQuery(
      supabaseAdmin,
      activeOrgId,
      "id, employee_number"
    )
      .eq("employee_number", employeeCode)
      .maybeSingle();

    if (employeeError) {
      const res = NextResponse.json(
        { ok: false, error: "Employee lookup failed", step: "employee", details: employeeError.message },
        { status: 500 }
      );
      applySupabaseCookies(res, pendingCookies);
      return res;
    }
    const emp = employeeRow as { id: string; employee_number: string } | null | undefined;
    if (!emp?.id) {
      const res = NextResponse.json(
        { ok: false, error: "Employee not found", step: "employee", details: { employee_number: employeeCode } },
        { status: 404 }
      );
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const employeeId = emp.id;
    const employeeNumber = emp.employee_number ?? employeeCode;

    const { data: existingAssignments, error: existingError } = await supabaseAdmin
      .from("shift_assignments")
      .select(`
        id,
        shift:shift_id(shift_date, shift_type, line),
        station:station_id(code)
      `)
      .eq("org_id", activeOrgId)
      .eq("employee_id", employeeId)
      .eq("assignment_date", date);

    if (existingError) {
      const res = NextResponse.json(
        { ok: false, error: "Conflict check failed", step: "conflict_check", details: existingError.message },
        { status: 500 }
      );
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const conflicts: Array<{ shift_date: string; shift_type: string; line: string; station_code: string }> = [];

    for (const sa of existingAssignments ?? []) {
      const shiftRel = sa.shift as { shift_date?: string; shift_type?: string; line?: string } | null;
      const stationRel = sa.station as { code?: string } | null;
      const sDate = shiftRel?.shift_date ?? date;
      const sType = shiftRel?.shift_type ?? shiftType;
      if (sType === shiftType) {
        conflicts.push({
          shift_date: sDate,
          shift_type: sType,
          line: shiftRel?.line ?? "",
          station_code: stationRel?.code ?? "",
        });
      }
    }

    if (conflicts.length > 0) {
      const res = NextResponse.json(
        {
          ok: false,
          error: "Employee already assigned to same shift (shift_date + shift_type)",
          step: "conflict",
          details: {
            employee_number: employeeNumber,
            employee_id: employeeId,
            shift: { date: shiftDate, type: shiftType, line: shiftLine, shift_id: shiftId },
            requested: { machineCode },
            conflicts,
          },
        },
        { status: 409 }
      );
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const { data: existingOnStation, error: existingStationError } = await supabaseAdmin
      .from("shift_assignments")
      .select("id, employee_id")
      .eq("org_id", activeOrgId)
      .eq("shift_id", shiftId)
      .eq("station_id", stationId)
      .maybeSingle();

    if (existingStationError) {
      const res = NextResponse.json(
        { ok: false, error: "Station assignment check failed", step: "existing_check", details: existingStationError.message },
        { status: 500 }
      );
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    if (existingOnStation?.id) {
      if (existingOnStation.employee_id && existingOnStation.employee_id !== employeeId) {
        const res = NextResponse.json(
          {
            ok: false,
            error: "Station already assigned",
            step: "conflict",
            details: {
              employee_number: employeeNumber,
              employee_id: employeeId,
              shift: { date: shiftDate, type: shiftType, line: shiftLine, shift_id: shiftId },
              requested: { machineCode },
              conflicts: [{ shift_date: date, shift_type: shiftType, line: shiftLine, station_code: machineCode }],
            },
          },
          { status: 409 }
        );
        applySupabaseCookies(res, pendingCookies);
        return res;
      }

      const { data: updated, error: updateError } = await supabaseAdmin
        .from("shift_assignments")
        .update({ employee_id: employeeId, status: "active" })
        .eq("id", existingOnStation.id)
        .select("id")
        .single();

      if (updateError) {
        const res = NextResponse.json(
          { ok: false, error: "Update failed", step: "update", details: updateError.message },
          { status: 500 }
        );
        applySupabaseCookies(res, pendingCookies);
        return res;
      }

      if (process.env.NODE_ENV !== "production") {
        console.log("[assignments] updated shift_assignment", {
          orgId: activeOrgId,
          shiftId,
          stationId,
          employeeId,
          line: shiftLine,
          assignmentId: updated?.id,
        });
      }

      const res = NextResponse.json({ ok: true, assignment_id: updated?.id });
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const { data: inserted, error: insertError } = await supabaseAdmin
      .from("shift_assignments")
      .insert({
        org_id: activeOrgId,
        shift_id: shiftId,
        station_id: stationId,
        employee_id: employeeId,
        assignment_date: shiftDate,
        status: "active",
      })
      .select("id")
      .single();

    if (insertError) {
      const res = NextResponse.json(
        { ok: false, error: "Insert failed", step: "insert", details: insertError.message },
        { status: 500 }
      );
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    if (process.env.NODE_ENV !== "production") {
      console.log("[assignments] inserted shift_assignment", {
        orgId: activeOrgId,
        shiftId,
        stationId,
        employeeId,
        line: shiftLine,
        assignmentId: inserted?.id,
      });
    }

    const res = NextResponse.json({ ok: true, assignment_id: inserted?.id });
    applySupabaseCookies(res, pendingCookies);
    return res;
  } catch (error) {
    console.error("[assignments] error:", error);
    const message = error instanceof Error ? error.message : "Failed to create assignment";
    const details = error && typeof error === "object" && "message" in error
      ? String((error as { message?: string }).message)
      : String(error);
    return NextResponse.json(
      { ok: false, error: message, step: "exception", details },
      { status: 500 }
    );
  }
}
