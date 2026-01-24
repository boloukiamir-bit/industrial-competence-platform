import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getOrgIdFromSession } from "@/lib/orgSession";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const session = await getOrgIdFromSession(request);
    if (!session.success) {
      return NextResponse.json({ error: session.error }, { status: session.status });
    }
    const orgId = session.orgId;

    const body = await request.json();
    const { shift_date, shift_type, line } = body;

    if (!shift_date || !shift_type || !line) {
      return NextResponse.json(
        { error: "shift_date, shift_type, and line are required" },
        { status: 400 }
      );
    }

    // Validate shift_type
    if (!['Day', 'Evening', 'Night'].includes(shift_type)) {
      return NextResponse.json(
        { error: "Invalid shift_type. Must be Day, Evening, or Night" },
        { status: 400 }
      );
    }

    // Upsert shift on (org_id, shift_date, shift_type, line)
    // First try to find existing shift
    const { data: existingShift, error: findError } = await supabaseAdmin
      .from("shifts")
      .select("id")
      .eq("org_id", orgId)
      .eq("shift_date", shift_date)
      .eq("shift_type", shift_type)
      .eq("line", line)
      .maybeSingle();

    let shiftId: string;
    if (existingShift?.id) {
      shiftId = existingShift.id;
    } else {
      // Insert new shift
      const { data: newShift, error: shiftError } = await supabaseAdmin
        .from("shifts")
        .insert({
          org_id: orgId,
          shift_date: shift_date,
          shift_type: shift_type,
          line: line,
          name: shift_type, // Keep name for backward compatibility
          is_active: true,
        })
        .select("id")
        .single();

      if (shiftError || !newShift?.id) {
        console.error("Failed to create shift:", shiftError);
        return NextResponse.json(
          { error: `Failed to ensure shift: ${shiftError?.message || "Unknown error"}` },
          { status: 500 }
        );
      }
      shiftId = newShift.id;
    }

    // Find stations for this line
    const { data: stationsData, error: stationsError } = await supabaseAdmin
      .from("stations")
      .select("id")
      .eq("org_id", orgId)
      .eq("line", line)
      .eq("is_active", true)
      .not("line", "is", null);

    if (stationsError) {
      return NextResponse.json(
        { error: "Failed to fetch stations" },
        { status: 500 }
      );
    }

    if (!stationsData || stationsData.length === 0) {
      return NextResponse.json(
        { error: "No stations found for this line" },
        { status: 404 }
      );
    }

    // Upsert shift_assignments for all stations on this line
    // Unique index: (org_id, shift_id, station_id)
    const assignments = [];
    for (const station of stationsData) {
      // Check if assignment already exists
      const { data: existingAssignment } = await supabaseAdmin
        .from("shift_assignments")
        .select("id")
        .eq("org_id", orgId)
        .eq("shift_id", shiftId)
        .eq("station_id", station.id)
        .maybeSingle();

      if (existingAssignment?.id) {
        assignments.push(existingAssignment.id);
      } else {
        // Insert new assignment
        const { data: newAssignment, error: assignmentError } = await supabaseAdmin
          .from("shift_assignments")
          .insert({
            org_id: orgId,
            shift_id: shiftId,
            station_id: station.id,
            assignment_date: shift_date,
            employee_id: null, // Default null
            status: "unassigned",
          })
          .select("id")
          .single();

        if (assignmentError) {
          console.error("Failed to create shift_assignment:", assignmentError);
          continue;
        }

        if (newAssignment?.id) {
          assignments.push(newAssignment.id);
        }
      }
    }

    return NextResponse.json({ 
      success: true, 
      shift_id: shiftId,
      assignment_count: assignments.length,
      assignment_ids: assignments 
    });
  } catch (error) {
    console.error("ensureShiftContext error:", error);
    return NextResponse.json(
      { error: `Failed to ensure shift context: ${error instanceof Error ? error.message : "Unknown error"}` },
      { status: 500 }
    );
  }
}
