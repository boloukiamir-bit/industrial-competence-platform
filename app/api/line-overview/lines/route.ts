/**
 * GET /api/line-overview/lines — distinct lines from stations for the active tenant (session-scoped).
 * Returns [{ line_code, line_name, station_count }]. UI displays line_name, stores line_code.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseServerClient, applySupabaseCookies } from "@/lib/supabase/server";
import { getActiveOrgFromSession } from "@/lib/server/activeOrg";
import { getLineName } from "@/lib/lineOverviewLineNames";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  try {
    const { supabase, pendingCookies } = await createSupabaseServerClient();
    const org = await getActiveOrgFromSession(request, supabase);
    if (!org.ok) {
      const res = NextResponse.json({ error: org.error }, { status: org.status });
      applySupabaseCookies(res, pendingCookies);
      return res;
    }
    const activeOrgId = org.activeOrgId;

    const { data: stations, error } = await supabaseAdmin
      .from("stations")
      .select("line")
      .eq("org_id", activeOrgId)
      .eq("is_active", true)
      .not("line", "is", null);

    if (error) {
      const res = NextResponse.json({ error: "Failed to fetch lines" }, { status: 500 });
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const lineCodes = [...new Set((stations || []).map((s: { line?: string }) => s.line).filter((v): v is string => Boolean(v)))].sort();
    const countByLine = new Map<string, number>();
    for (const s of stations || []) {
      const line = (s as { line?: string }).line;
      if (line) countByLine.set(line, (countByLine.get(line) ?? 0) + 1);
    }

    let nameByCode = new Map<string, string>();
    const { data: plLines, error: plErr } = await supabaseAdmin
      .from("pl_lines")
      .select("line_code, line_name")
      .eq("org_id", activeOrgId)
      .eq("is_active", true);
    if (!plErr && plLines) {
      for (const row of plLines) {
        nameByCode.set(row.line_code, row.line_name ?? row.line_code);
      }
    }

    const lines = lineCodes.map((line_code) => ({
      line_code,
      line_name: nameByCode.get(line_code) ?? getLineName(line_code),
      station_count: countByLine.get(line_code) ?? 0,
    }));

    const res = NextResponse.json({ lines });
    applySupabaseCookies(res, pendingCookies);
    return res;
  } catch (err) {
    console.error("Line overview lines error:", err);
    return NextResponse.json({ error: "Failed to fetch lines" }, { status: 500 });
  }
}
