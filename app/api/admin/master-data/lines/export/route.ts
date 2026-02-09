/**
 * GET /api/admin/master-data/lines/export — CSV export of lines from public.stations (line_code, line_name, is_active).
 * Admin/hr only. Tenant-scoped by active_org_id. Read-only from stations; no pl_lines.
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
      .select("line, name, is_active")
      .eq("org_id", auth.activeOrgId)
      .like("code", "LINE-%")
      .order("line");

    if (error) {
      const res = NextResponse.json({ error: "Failed to fetch lines" }, { status: 500 });
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const header = ["line_code", "line_name", "is_active"];
    const lines = [header.map(escapeCsvCell).join(",")];
    for (const r of rows || []) {
      const line_name = (r.name ?? "").replace(/\s*\(LINE\)\s*$/, "").trim() || (r.line ?? "");
      lines.push([
        escapeCsvCell(r.line ?? ""),
        escapeCsvCell(line_name),
        escapeCsvCell(r.is_active !== false ? "true" : "false"),
      ].join(","));
    }

    const csv = lines.join("\r\n");
    const res = new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": "attachment; filename=lines.csv",
      },
    });
    applySupabaseCookies(res, pendingCookies);
    return res;
  } catch (err) {
    console.error("[admin/master-data/lines/export]", err);
    return NextResponse.json({ error: "Export failed" }, { status: 500 });
  }
}
