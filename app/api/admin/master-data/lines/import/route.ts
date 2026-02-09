/**
 * POST /api/admin/master-data/lines/import — CSV import for lines (writes to public.stations as placeholder rows).
 * Body: { csv: string } or Content-Type: text/csv. Columns: line_code, line_name (optional), is_active (optional).
 * Admin/hr only. Tenant-scoped by active_org_id. No writes to pl_lines.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseServerClient, applySupabaseCookies } from "@/lib/supabase/server";
import { requireAdminOrHr } from "@/lib/server/requireAdminOrHr";
import { lineToStationPayload } from "@/lib/server/lineToStation";
import Papa from "papaparse";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function normalizeHeader(h: string): string {
  return h.trim().toLowerCase().replace(/\s+/g, "_");
}

export async function POST(request: NextRequest) {
  try {
    const { supabase, pendingCookies } = await createSupabaseServerClient();
    const auth = await requireAdminOrHr(request, supabase);
    if (!auth.ok) {
      const res = NextResponse.json({ error: auth.error }, { status: auth.status });
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    let csvText: string;
    const contentType = request.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      const body = await request.json().catch(() => ({}));
      csvText = typeof body.csv === "string" ? body.csv : "";
    } else {
      csvText = await request.text();
    }
    if (!csvText.trim()) {
      const res = NextResponse.json({ error: "CSV content is required" }, { status: 400 });
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const parsed = Papa.parse<Record<string, string>>(csvText, { header: true, skipEmptyLines: true });
    const rows = parsed.data ?? [];
    const errors: Array<{ row: number; message: string }> = [];
    let created = 0;
    let updated = 0;

    for (let i = 0; i < rows.length; i++) {
      const raw = rows[i];
      const row: Record<string, string> = {};
      for (const k of Object.keys(raw)) {
        row[normalizeHeader(k)] = raw[k]?.trim() ?? "";
      }
      const line_code = (row.line_code ?? "").trim();
      const line_name = (row.line_name ?? "").trim() || line_code;
      const is_active = (row.is_active ?? "true").toLowerCase() !== "false" && (row.is_active ?? "true").toLowerCase() !== "0";

      if (!line_code) {
        errors.push({ row: i + 2, message: "line_code is required" });
        continue;
      }

      const payload = lineToStationPayload(auth.activeOrgId, line_code, line_name, is_active);
      const { error: upsertErr } = await supabaseAdmin
        .from("stations")
        .upsert(payload, { onConflict: "org_id,area_code,code" });

      if (upsertErr) {
        errors.push({ row: i + 2, message: upsertErr.message });
      } else {
        created++;
      }
    }

    const res = NextResponse.json({
      created,
      updated,
      errors: errors.length > 0 ? errors : undefined,
    });
    applySupabaseCookies(res, pendingCookies);
    return res;
  } catch (err) {
    console.error("[admin/master-data/lines/import]", err);
    return NextResponse.json({ error: "Import failed" }, { status: 500 });
  }
}
