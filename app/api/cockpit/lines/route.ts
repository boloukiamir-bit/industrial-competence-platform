import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getOrgIdFromSession } from "@/lib/orgSession";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  try {
    const session = await getOrgIdFromSession(request);
    if (!session.success) {
      return NextResponse.json({ error: session.error }, { status: session.status });
    }
    const orgId = session.orgId;

    // Get active_org_id from profiles if available, otherwise use session orgId
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("active_org_id")
      .eq("id", session.userId)
      .single();

    const activeOrgId = profile?.active_org_id || orgId;

    // Get distinct lines from stations
    const { data: stations, error } = await supabaseAdmin
      .from("stations")
      .select("line")
      .eq("org_id", activeOrgId)
      .eq("is_active", true)
      .not("line", "is", null);

    if (error) {
      return NextResponse.json(
        { error: "Failed to fetch lines" },
        { status: 500 }
      );
    }

    // Get unique lines
    const uniqueLines = [...new Set((stations || []).map((s: any) => s.line).filter(Boolean))];
    
    // Filter out "Assembly" as per requirements
    const validLines = uniqueLines.filter((line: string) => line !== "Assembly");

    return NextResponse.json({ lines: validLines.sort() });
  } catch (error) {
    console.error("getLines error:", error);
    return NextResponse.json(
      { error: "Failed to get lines" },
      { status: 500 }
    );
  }
}
