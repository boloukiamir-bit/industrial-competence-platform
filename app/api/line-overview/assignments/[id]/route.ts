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

const updateAssignmentSchema = z.object({
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  employeeCode: z.string().optional(),
});

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params;

    const { error } = await supabaseAdmin
      .from("pl_assignment_segments")
      .delete()
      .eq("id", id)
      .eq("org_id", activeOrgId);

    if (error) throw error;

    const res = NextResponse.json({ success: true });
    applySupabaseCookies(res, pendingCookies);
    return res;
  } catch (error) {
    console.error("Delete assignment error:", error);
    return NextResponse.json({ error: "Failed to delete assignment" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params;
    const body = await request.json();
    const parsed = updateAssignmentSchema.safeParse(body);

    if (!parsed.success) {
      const res = NextResponse.json({ error: "Invalid input", details: parsed.error.issues }, { status: 400 });
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const updates: Record<string, string> = {};
    if (parsed.data.startTime) updates.start_time = parsed.data.startTime;
    if (parsed.data.endTime) updates.end_time = parsed.data.endTime;
    if (parsed.data.employeeCode) updates.employee_code = parsed.data.employeeCode;

    if (updates.start_time || updates.end_time) {
      const { data: existing, error: fetchErr } = await supabaseAdmin
        .from("pl_assignment_segments")
        .select("plan_date, shift_type, machine_code, start_time, end_time")
        .eq("id", id)
        .eq("org_id", activeOrgId)
        .single();
      if (fetchErr || !existing) {
        const res = NextResponse.json({ error: "Assignment not found" }, { status: 404 });
        applySupabaseCookies(res, pendingCookies);
        return res;
      }
      const newStart = updates.start_time ?? existing.start_time;
      const newEnd = updates.end_time ?? existing.end_time;
      const { data: others } = await supabaseAdmin
        .from("pl_assignment_segments")
        .select("id, start_time, end_time")
        .eq("org_id", activeOrgId)
        .eq("plan_date", existing.plan_date)
        .eq("shift_type", existing.shift_type)
        .eq("machine_code", existing.machine_code)
        .neq("id", id);
      const overlaps = (others || []).some((seg) =>
        timeRangesOverlap(newStart, newEnd, seg.start_time, seg.end_time)
      );
      if (overlaps) {
        const res = NextResponse.json(
          { error: "Another operator is already assigned to this machine during that time. Choose a different time or machine." },
          { status: 409 }
        );
        applySupabaseCookies(res, pendingCookies);
        return res;
      }
    }

    const { data, error } = await supabaseAdmin
      .from("pl_assignment_segments")
      .update(updates)
      .eq("id", id)
      .eq("org_id", activeOrgId)
      .select()
      .single();

    if (error) throw error;

    const res = NextResponse.json({ success: true, assignment: data });
    applySupabaseCookies(res, pendingCookies);
    return res;
  } catch (error) {
    console.error("Update assignment error:", error);
    return NextResponse.json({ error: "Failed to update assignment" }, { status: 500 });
  }
}
