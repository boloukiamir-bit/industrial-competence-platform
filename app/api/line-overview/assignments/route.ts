import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { getOrgIdFromSession } from "@/lib/orgSession";
import { createSupabaseServerClient, applySupabaseCookies } from "@/lib/supabase/server";
import { timeRangesOverlap } from "@/lib/lineOverviewNet";

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
    const { supabase, pendingCookies } = await createSupabaseServerClient();
    const session = await getOrgIdFromSession(request, supabase);
    if (!session.success) {
      const res = NextResponse.json({ error: session.error }, { status: session.status });
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("active_org_id")
      .eq("id", session.userId)
      .single();
    if (!profile?.active_org_id) {
      const res = NextResponse.json({ error: "No active organization" }, { status: 403 });
      applySupabaseCookies(res, pendingCookies);
      return res;
    }
    const activeOrgId = profile.active_org_id as string;

    const body = await request.json();
    const parsed = createAssignmentSchema.safeParse(body);

    if (!parsed.success) {
      const res = NextResponse.json({ error: "Invalid input", details: parsed.error.issues }, { status: 400 });
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const { machineCode, employeeCode, date, shift, startTime, endTime } = parsed.data;
    const shiftType = shiftParamToDbValue(shift);

    const { data: existing } = await supabaseAdmin
      .from("pl_assignment_segments")
      .select("id, start_time, end_time")
      .eq("org_id", activeOrgId)
      .eq("plan_date", date)
      .eq("shift_type", shiftType)
      .eq("machine_code", machineCode);

    const overlaps = (existing || []).some((seg) =>
      timeRangesOverlap(startTime, endTime, seg.start_time, seg.end_time)
    );
    if (overlaps) {
      const res = NextResponse.json(
        { error: "Another operator is already assigned to this machine during that time. Choose a different time or machine." },
        { status: 409 }
      );
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const { data, error } = await supabaseAdmin.from("pl_assignment_segments").insert({
      org_id: activeOrgId,
      machine_code: machineCode,
      employee_code: employeeCode,
      plan_date: date,
      shift_type: shiftType,
      start_time: startTime,
      end_time: endTime,
    }).select().single();

    if (error) throw error;

    const res = NextResponse.json({ success: true, assignment: data });
    applySupabaseCookies(res, pendingCookies);
    return res;
  } catch (error) {
    console.error("Create assignment error:", error);
    return NextResponse.json({ error: "Failed to create assignment" }, { status: 500 });
  }
}
