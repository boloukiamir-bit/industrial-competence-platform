/**
 * GET /api/admin/master-data/lines/export — CSV export of area leaders (line_code, line_name, leader_employee_number, is_active).
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
      .from("pl_lines")
      .select("line_code, line_name, leader_employee_id, is_active")
      .eq("org_id", auth.activeOrgId)
      .order("line_code");

    if (error) {
      const res = NextResponse.json({ error: "Failed to fetch lines" }, { status: 500 });
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const leaderIds = [...new Set((rows || []).map((r: { leader_employee_id: string | null }) => r.leader_employee_id).filter(Boolean))] as string[];
    let leaderNumMap: Record<string, string> = {};
    if (leaderIds.length > 0) {
      const { data: emps } = await supabaseAdmin
        .from("employees")
        .select("id, employee_number")
        .in("id", leaderIds);
      if (emps) {
        leaderNumMap = Object.fromEntries(emps.map((e: { id: string; employee_number: string }) => [e.id, e.employee_number ?? ""]));
      }
    }

    const header = ["line_code", "line_name", "leader_employee_number", "is_active"];
    const lines = [header.map(escapeCsvCell).join(",")];
    for (const r of rows || []) {
      const leaderNum = r.leader_employee_id ? leaderNumMap[r.leader_employee_id] ?? "" : "";
      lines.push([
        escapeCsvCell(r.line_code ?? ""),
        escapeCsvCell(r.line_name ?? ""),
        escapeCsvCell(leaderNum),
        escapeCsvCell(r.is_active ? "true" : "false"),
      ].join(","));
    }

    const csv = lines.join("\r\n");
    const res = new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": "attachment; filename=area_leaders.csv",
      },
    });
    applySupabaseCookies(res, pendingCookies);
    return res;
  } catch (err) {
    console.error("[admin/master-data/lines/export]", err);
    return NextResponse.json({ error: "Export failed" }, { status: 500 });
  }
}
