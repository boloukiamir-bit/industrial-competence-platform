/**
 * POST /api/competencies/import/skills
 * Reads CSV (code, name, category?, description?), upserts into public.skills by (org_id, code).
 * Tenant-scoped by session (active_org_id). Never accept org_id from client.
 */
import { NextRequest, NextResponse } from "next/server";
import Papa from "papaparse";
import { getActiveOrgFromSession } from "@/lib/server/activeOrg";
import { createSupabaseServerClient, applySupabaseCookies } from "@/lib/supabase/server";

const BATCH_SIZE = 100;
const ERRORS_CAP = 50;

function normalizeHeader(h: string): string {
  return h.trim().toLowerCase().replace(/\s+/g, "_");
}

type Row = Record<string, string>;

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
    const org = await getActiveOrgFromSession(request, supabase);
    if (!org.ok) {
      const res = NextResponse.json({ error: org.error }, { status: org.status });
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const csv = await getCsvFromRequest(request);
    if (!csv || !csv.trim()) {
      const res = NextResponse.json(
        { error: "Send CSV via multipart form file 'file', JSON { csv: string }, or body as text/csv" },
        { status: 400 }
      );
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const parsed = Papa.parse<Row>(csv, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => normalizeHeader(h),
    });
    const rows = (parsed.data ?? []) as Row[];
    const fields = parsed.meta.fields ?? [];

    const hasCode = fields.some((f) => normalizeHeader(f) === "code");
    const hasName = fields.some((f) => normalizeHeader(f) === "name");
    if (!hasCode || !hasName) {
      const res = NextResponse.json(
        { error: "CSV must include columns: code, name. Optional: category, description." },
        { status: 400 }
      );
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const get = (row: Row, key: string): string => {
      const k = fields.find((f) => normalizeHeader(f) === key);
      return (k ? String(row[k] ?? "").trim() : "") ?? "";
    };

    const toUpsert: { org_id: string; code: string; name: string; category: string | null; description: string | null }[] = [];
    const errors: Array<{ rowIndex: number; message: string }> = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i] as Row;
      const rowIndex = i + 2;
      const code = get(row, "code");
      const name = get(row, "name");
      if (!code || !name) {
        if (errors.length < ERRORS_CAP) {
          errors.push({ rowIndex, message: !code ? "code is required" : "name is required" });
        }
        continue;
      }
      const category = get(row, "category") || null;
      const description = get(row, "description") || null;
      toUpsert.push({
        org_id: org.activeOrgId,
        code,
        name,
        category: category || null,
        description: description || null,
      });
    }

    if (toUpsert.length === 0) {
      const res = NextResponse.json({
        summary: { inserted: 0, updated: 0, skipped: rows.length, errors: errors.length },
        errors: errors.slice(0, ERRORS_CAP),
      });
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    let upserted = 0;
    for (let i = 0; i < toUpsert.length; i += BATCH_SIZE) {
      const batch = toUpsert.slice(i, i + BATCH_SIZE);
      const { error } = await supabase.from("skills").upsert(batch, {
        onConflict: "org_id,code",
      });
      if (error) {
        console.error("[competencies/import/skills] upsert batch", error);
        for (let j = 0; j < batch.length && errors.length < ERRORS_CAP; j++) {
          errors.push({ rowIndex: i + j + 2, message: error.message });
        }
      } else {
        upserted += batch.length;
      }
    }

    const res = NextResponse.json({
      summary: {
        inserted: 0,
        updated: upserted,
        skipped: rows.length - toUpsert.length,
        errors: errors.length,
      },
      errors: errors.length > 0 ? errors.slice(0, ERRORS_CAP) : undefined,
    });
    applySupabaseCookies(res, pendingCookies);
    return res;
  } catch (err) {
    console.error("[competencies/import/skills]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Skills import failed" },
      { status: 500 }
    );
  }
}
