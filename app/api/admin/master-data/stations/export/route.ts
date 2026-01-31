/**
 * GET /api/admin/master-data/stations/export — CSV export (line_code, station_code, station_name, is_active).
 * Admin/hr only. Tenant-scoped by active_org_id.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseServerClient, applySupabaseCookies } from "@/lib/supabase/server";
import { requireAdminOrHr } from "@/lib/server/requireAdminOrHr";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function escapeCsvCell(s: string): string {
  if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export async function GET(request: NextRequest) {
  try {
    const { supabase, pendingCookies } = await createSupabaseServerClient();
    const auth = await requireAdminOrHr(request, supabase);
    if (!auth.ok) {
      const res = NextResponse.json({ error: auth.error }, { status: auth.status });
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const { data: rows, error } = await supabaseAdmin
      .from("stations")
      .select("code, name, line, is_active")
      .eq("org_id", auth.activeOrgId)
      .order("line")
      .order("name");

    if (error) {
      const res = NextResponse.json({ error: "Failed to fetch stations" }, { status: 500 });
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const header = ["line_code", "station_code", "station_name", "is_active"];
    const lines = [header.map(escapeCsvCell).join(",")];
    for (const r of rows || []) {
      lines.push([
        escapeCsvCell(r.line ?? ""),
        escapeCsvCell(r.code ?? ""),
        escapeCsvCell(r.name ?? ""),
        escapeCsvCell(r.is_active ? "true" : "false"),
      ].join(","));
    }

    const csv = lines.join("\r\n");
    const res = new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": "attachment; filename=stations.csv",
      },
    });
    applySupabaseCookies(res, pendingCookies);
    return res;
  } catch (err) {
    console.error("[admin/master-data/stations/export]", err);
    return NextResponse.json({ error: "Export failed" }, { status: 500 });
  }
}
