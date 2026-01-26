import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getOrgIdFromSession } from "@/lib/orgSession";
import { createSupabaseServerClient, applySupabaseCookies } from "@/lib/supabase/server";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
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

    // Get distinct lines from stations
    const { data: stations, error } = await supabaseAdmin
      .from("stations")
      .select("line")
      .eq("org_id", activeOrgId)
      .eq("is_active", true)
      .not("line", "is", null);

    if (error) {
      const res = NextResponse.json(
        { error: "Failed to fetch lines" },
        { status: 500 }
      );
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const uniqueLines = [...new Set((stations || []).map((s: { line?: string }) => s.line).filter((v): v is string => Boolean(v)))].sort();

    const res = NextResponse.json({ lines: uniqueLines });
    applySupabaseCookies(res, pendingCookies);
    return res;
  } catch (error) {
    console.error("getLines error:", error);
    return NextResponse.json(
      { error: "Failed to get lines" },
      { status: 500 }
    );
  }
}
