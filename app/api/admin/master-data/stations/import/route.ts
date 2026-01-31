/**
 * POST /api/admin/master-data/stations/import — CSV import for stations.
 * Canonical rule: stations.line MUST store LINE CODE (BEA/OMM/PAC/LOG/UND), not Swedish name.
 * Columns: code, name, area_code (required). Optional: is_active.
 * Upsert by (org_id, area_code, code). Writes line = area_code, area_code = area_code.
 * Accepts: multipart form file 'file', JSON { csv: string }, or body text/csv.
 * Admin/hr only. Tenant-scoped by active_org_id.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseServerClient, applySupabaseCookies } from "@/lib/supabase/server";
import { requireAdminOrHr } from "@/lib/server/requireAdminOrHr";
import Papa from "papaparse";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function normalizeHeader(h: string): string {
  return h.trim().toLowerCase().replace(/\s+/g, "_");
}

async function getCsvFromRequest(request: NextRequest): Promise<string | null> {
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("multipart/form-data")) {
    const form = await request.formData().catch(() => null);
    const file = form?.get("file");
    if (file instanceof File) {
      return file.text();
    }
    return null;
  }
  if (contentType.includes("application/json")) {
    const body = await request.json().catch(() => ({}));
    return typeof (body as { csv?: unknown }).csv === "string" ? (body as { csv: string }).csv : null;
  }
  if (contentType.includes("text/csv") || contentType.includes("text/plain")) {
    return request.text();
  }
  return null;
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

    const csvText = await getCsvFromRequest(request);
    if (!csvText?.trim()) {
      const res = NextResponse.json(
        { error: "Send CSV via multipart form file 'file', JSON { csv: string }, or body as text/csv" },
        { status: 400 }
      );
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const parsed = Papa.parse<Record<string, string>>(csvText, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => normalizeHeader(h),
    });
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
      const code = (row.code ?? "").trim();
      const name = (row.name ?? "").trim() || code;
      const area_code = (row.area_code ?? "").trim();
      const is_active =
        (row.is_active ?? "true").toLowerCase() !== "false" && (row.is_active ?? "true").toLowerCase() !== "0";

      if (!code || !area_code) {
        errors.push({ row: i + 2, message: "code and area_code are required" });
        continue;
      }

      const { data: existing } = await supabaseAdmin
        .from("stations")
        .select("id")
        .eq("org_id", auth.activeOrgId)
        .eq("area_code", area_code)
        .eq("code", code)
        .maybeSingle();

      const payload = {
        org_id: auth.activeOrgId,
        code,
        name,
        area_code,
        line: area_code,
        is_active,
        updated_at: new Date().toISOString(),
      };

      if (existing) {
        const { error: upErr } = await supabaseAdmin
          .from("stations")
          .update(payload)
          .eq("id", existing.id);
        if (upErr) errors.push({ row: i + 2, message: upErr.message });
        else updated++;
      } else {
        const { error: insErr } = await supabaseAdmin.from("stations").insert(payload);
        if (insErr) errors.push({ row: i + 2, message: insErr.message });
        else created++;
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
    console.error("[admin/master-data/stations/import]", err);
    return NextResponse.json({ error: "Import failed" }, { status: 500 });
  }
}
