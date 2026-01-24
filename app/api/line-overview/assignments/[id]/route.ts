import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

const DEMO_ORG_ID = "f607f244-da91-41d9-a648-d02a1591105c";

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Missing Supabase env");
  }
  return createClient(url, key);
}

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
    const { id } = await params;

    const supabaseAdmin = getSupabaseAdmin();
    const { error } = await supabaseAdmin
      .from("pl_assignment_segments")
      .delete()
      .eq("id", id)
      .eq("org_id", DEMO_ORG_ID);

    if (error) throw error;

    return NextResponse.json({ success: true });
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
    const { id } = await params;
    const body = await request.json();
    const parsed = updateAssignmentSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input", details: parsed.error.issues }, { status: 400 });
    }

    const updates: Record<string, string> = {};
    if (parsed.data.startTime) updates.start_time = parsed.data.startTime;
    if (parsed.data.endTime) updates.end_time = parsed.data.endTime;
    if (parsed.data.employeeCode) updates.employee_code = parsed.data.employeeCode;

    const supabaseAdmin = getSupabaseAdmin();
    const { data, error } = await supabaseAdmin
      .from("pl_assignment_segments")
      .update(updates)
      .eq("id", id)
      .eq("org_id", DEMO_ORG_ID)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, assignment: data });
  } catch (error) {
    console.error("Update assignment error:", error);
    return NextResponse.json({ error: "Failed to update assignment" }, { status: 500 });
  }
}
