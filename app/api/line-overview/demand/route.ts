import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const DEMO_ORG_ID = "f607f244-da91-41d9-a648-d02a1591105c";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function shiftParamToDbValue(shift: string): string {
  const map: Record<string, string> = {
    day: "Day",
    evening: "Evening",
    night: "Night",
  };
  return map[shift.toLowerCase()] || "Day";
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { machineCode, date, shift, requiredHours, priority, comment } = body;

    if (!machineCode || !date || !shift || requiredHours === undefined) {
      return NextResponse.json(
        { error: "Missing required fields: machineCode, date, shift, requiredHours" },
        { status: 400 }
      );
    }

    const shiftType = shiftParamToDbValue(shift);

    const existingCheck = await supabaseAdmin
      .from("pl_machine_demand")
      .select("id")
      .eq("org_id", DEMO_ORG_ID)
      .eq("machine_code", machineCode)
      .eq("plan_date", date)
      .eq("shift_type", shiftType)
      .maybeSingle();

    if (existingCheck.data) {
      const { data, error } = await supabaseAdmin
        .from("pl_machine_demand")
        .update({
          required_hours: requiredHours,
          priority: priority || 1,
          comment: comment || null,
        })
        .eq("id", existingCheck.data.id)
        .select()
        .single();

      if (error) throw error;

      return NextResponse.json({ success: true, demand: data, updated: true });
    }

    const { data, error } = await supabaseAdmin
      .from("pl_machine_demand")
      .insert({
        org_id: DEMO_ORG_ID,
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

    return NextResponse.json({ success: true, demand: data, created: true });
  } catch (error) {
    console.error("Demand creation error:", error);
    return NextResponse.json({ error: "Failed to create demand" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const machineCode = searchParams.get("machineCode");
    const date = searchParams.get("date");
    const shift = searchParams.get("shift");

    if (!machineCode || !date || !shift) {
      return NextResponse.json(
        { error: "Missing required params: machineCode, date, shift" },
        { status: 400 }
      );
    }

    const shiftType = shiftParamToDbValue(shift);

    const { error } = await supabaseAdmin
      .from("pl_machine_demand")
      .delete()
      .eq("org_id", DEMO_ORG_ID)
      .eq("machine_code", machineCode)
      .eq("plan_date", date)
      .eq("shift_type", shiftType);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Demand deletion error:", error);
    return NextResponse.json({ error: "Failed to delete demand" }, { status: 500 });
  }
}
