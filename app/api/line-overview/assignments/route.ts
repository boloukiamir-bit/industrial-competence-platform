import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

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

const createAssignmentSchema = z.object({
  machineCode: z.string(),
  employeeCode: z.string(),
  date: z.string(),
  shift: z.string(),
  startTime: z.string(),
  endTime: z.string(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = createAssignmentSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input", details: parsed.error.issues }, { status: 400 });
    }

    const { machineCode, employeeCode, date, shift, startTime, endTime } = parsed.data;

    const { data, error } = await supabaseAdmin.from("pl_assignment_segments").insert({
      org_id: DEMO_ORG_ID,
      machine_code: machineCode,
      employee_code: employeeCode,
      plan_date: date,
      shift_type: shiftParamToDbValue(shift),
      start_time: startTime,
      end_time: endTime,
    }).select().single();

    if (error) throw error;

    return NextResponse.json({ success: true, assignment: data });
  } catch (error) {
    console.error("Create assignment error:", error);
    return NextResponse.json({ error: "Failed to create assignment" }, { status: 500 });
  }
}
