import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseServerClient, applySupabaseCookies } from "@/lib/supabase/server";
import { getActiveOrgFromSession } from "@/lib/server/activeOrg";
import { normalizeShift, normalizeShiftTypeOrDefault } from "@/lib/shift";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const { supabase, pendingCookies } = await createSupabaseServerClient();
    const org = await getActiveOrgFromSession(request, supabase);
    if (!org.ok) {
      const res = NextResponse.json({ error: org.error }, { status: org.status });
      applySupabaseCookies(res, pendingCookies);
      return res;
    }
    const activeOrgId = org.activeOrgId;

    const body = await request.json();
    const { stationId: bodyStationId, machineCode: bodyMachineCode, date, shift, requiredHours, priority, comment } = body;

    if ((!bodyStationId && !bodyMachineCode) || !date || !shift || requiredHours === undefined) {
      const res = NextResponse.json(
        { error: "Missing required fields: stationId (or machineCode), date, shift, requiredHours" },
        { status: 400 }
      );
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const shiftType = normalizeShiftTypeOrDefault(shift);

    let stationId: string;
    let machineCode: string;

    if (bodyStationId) {
      const { data: stationRow, error: stationError } = await supabaseAdmin
        .from("stations")
        .select("id, code")
        .eq("org_id", activeOrgId)
        .eq("is_active", true)
        .eq("id", bodyStationId)
        .maybeSingle();
      if (stationError || !stationRow?.id) {
        const res = NextResponse.json(
          { ok: false, error: "Invalid station", step: "validation" },
          { status: 400 }
        );
        applySupabaseCookies(res, pendingCookies);
        return res;
      }
      stationId = stationRow.id as string;
      machineCode = (stationRow.code ?? stationRow.id) as string;
    } else {
      const byCode = await supabaseAdmin
        .from("stations")
        .select("id, code")
        .eq("org_id", activeOrgId)
        .eq("is_active", true)
        .eq("code", bodyMachineCode)
        .maybeSingle();
      const byId = byCode.data
        ? { data: null }
        : await supabaseAdmin
            .from("stations")
            .select("id, code")
            .eq("org_id", activeOrgId)
            .eq("is_active", true)
            .eq("id", bodyMachineCode)
            .maybeSingle();
      const stationRow = byCode.data ?? byId.data;
      if (!stationRow?.id) {
        const res = NextResponse.json(
          { ok: false, error: "Invalid station or machineCode", step: "validation" },
          { status: 400 }
        );
        applySupabaseCookies(res, pendingCookies);
        return res;
      }
      stationId = stationRow.id as string;
      machineCode = (stationRow.code ?? stationRow.id) as string;
    }

    const existingByStation = await supabaseAdmin
      .from("pl_machine_demand")
      .select("id")
      .eq("org_id", activeOrgId)
      .eq("station_id", stationId)
      .eq("plan_date", date)
      .eq("shift_type", shiftType)
      .maybeSingle();
    const existingByCode = await supabaseAdmin
      .from("pl_machine_demand")
      .select("id")
      .eq("org_id", activeOrgId)
      .eq("machine_code", machineCode)
      .eq("plan_date", date)
      .eq("shift_type", shiftType)
      .maybeSingle();
    const existingCheck = existingByStation.data ?? existingByCode.data;

    if (existingCheck) {
      const { data, error } = await supabaseAdmin
        .from("pl_machine_demand")
        .update({
          station_id: stationId,
          machine_code: machineCode,
          required_hours: requiredHours,
          priority: priority || 1,
          comment: comment || null,
        })
        .eq("id", existingCheck.id)
        .select()
        .single();

      if (error) throw error;

      const res = NextResponse.json({ success: true, demand: data, updated: true });
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const { data, error } = await supabaseAdmin
      .from("pl_machine_demand")
      .insert({
        org_id: activeOrgId,
        station_id: stationId,
        machine_code: machineCode,
        plan_date: date,
        shift_type: shiftType,
        required_hours: requiredHours,
        priority: priority || 1,
        comment: comment || null,
      })
      .select()
      .single();

    if (error) throw error;

    const res = NextResponse.json({ success: true, demand: data, created: true });
    applySupabaseCookies(res, pendingCookies);
    return res;
  } catch (error) {
    console.error("[line-overview/demand] creation error:", error);
    const message = error instanceof Error ? error.message : "Failed to create demand";
    return NextResponse.json(
      { ok: false, error: message, step: "exception" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { supabase, pendingCookies } = await createSupabaseServerClient();
    const org = await getActiveOrgFromSession(request, supabase);
    if (!org.ok) {
      const res = NextResponse.json({ error: org.error }, { status: org.status });
      applySupabaseCookies(res, pendingCookies);
      return res;
    }
    const activeOrgId = org.activeOrgId;

    const { searchParams } = new URL(request.url);
    const stationId = searchParams.get("stationId");
    const machineCode = searchParams.get("machineCode");
    const date = searchParams.get("date");
    const shiftParam = searchParams.get("shift");

    if ((!stationId && !machineCode) || !date || !shiftParam) {
      const res = NextResponse.json(
        { ok: false, error: "Missing required params: stationId (or machineCode), date, shift", step: "validation" },
        { status: 400 }
      );
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const shiftType = normalizeShift(shiftParam);
    if (!shiftType) {
      const res = NextResponse.json(
        { ok: false, error: "Invalid shift parameter", step: "validation", details: { shift: shiftParam } },
        { status: 400 }
      );
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    let deleteQuery = supabaseAdmin
      .from("pl_machine_demand")
      .delete()
      .eq("org_id", activeOrgId)
      .eq("plan_date", date)
      .eq("shift_type", shiftType);
    if (stationId) {
      deleteQuery = deleteQuery.eq("station_id", stationId);
    } else {
      deleteQuery = deleteQuery.eq("machine_code", machineCode!);
    }

    const { error } = await deleteQuery;

    if (error) throw error;

    const res = NextResponse.json({ success: true });
    applySupabaseCookies(res, pendingCookies);
    return res;
  } catch (error) {
    console.error("[line-overview/demand] deletion error:", error);
    const message = error instanceof Error ? error.message : "Failed to delete demand";
    return NextResponse.json(
      { ok: false, error: message, step: "exception" },
      { status: 500 }
    );
  }
}
