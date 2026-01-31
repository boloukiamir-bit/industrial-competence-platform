/**
 * POST /api/competencies/import/employee-skills
 * Reads CSV (employee_number, skill_code, level). Resolves employee_id by (org_id, employee_number),
 * skill_id by (org_id, skill_code). Upserts into public.employee_skills by (employee_id, skill_id).
 * Tenant-scoped by session (active_org_id). Never accept org_id from client.
 * Returns summary: inserted, updated, skipped (unknown employee_number, unknown skill_code), errors capped.
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

function parseLevel(v: string): number | null {
  const n = parseInt(v.trim(), 10);
  if (!Number.isFinite(n) || n < 0 || n > 4) return null;
  return n;
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

    const hasNum = fields.some((f) => normalizeHeader(f) === "employee_number");
    const hasCode = fields.some((f) => normalizeHeader(f) === "skill_code");
    const hasLevel = fields.some((f) => normalizeHeader(f) === "level");
    if (!hasNum || !hasCode || !hasLevel) {
      const res = NextResponse.json(
        { error: "CSV must include columns: employee_number, skill_code, level (0–4)." },
        { status: 400 }
      );
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const { data: employees } = await supabase
      .from("employees")
      .select("id, employee_number")
      .eq("org_id", org.activeOrgId)
      .eq("is_active", true);
    const empByNumber = new Map<string, string>();
    for (const e of employees ?? []) {
      const n = String(e.employee_number ?? "").trim();
      if (n) empByNumber.set(n, e.id);
    }

    const { data: skills } = await supabase
      .from("skills")
      .select("id, code")
      .eq("org_id", org.activeOrgId);
    const skillByCode = new Map<string, string>();
    for (const s of skills ?? []) {
      const c = String(s.code ?? "").trim();
      if (c) skillByCode.set(c, s.id);
    }

    const get = (row: Row, key: string): string => {
      const k = fields.find((f) => normalizeHeader(f) === key);
      return (k ? String(row[k] ?? "").trim() : "") ?? "";
    };

    const toUpsert: { employee_id: string; skill_id: string; level: number }[] = [];
    const skippedUnknownEmployee: Array<{ rowIndex: number; employee_number: string }> = [];
    const skippedUnknownSkill: Array<{ rowIndex: number; skill_code: string }> = [];
    const errors: Array<{ rowIndex: number; message: string }> = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i] as Row;
      const rowIndex = i + 2;
      const employee_number = get(row, "employee_number");
      const skill_code = get(row, "skill_code");
      const levelRaw = get(row, "level");
      if (!employee_number || !skill_code) {
        if (errors.length < ERRORS_CAP) {
          errors.push({
            rowIndex,
            message: !employee_number ? "employee_number is required" : "skill_code is required",
          });
        }
        continue;
      }
      const level = parseLevel(levelRaw);
      if (level === null) {
        if (errors.length < ERRORS_CAP) {
          errors.push({ rowIndex, message: "level must be 0–4" });
        }
        continue;
      }
      const employeeId = empByNumber.get(employee_number);
      const skillId = skillByCode.get(skill_code);
      if (!employeeId) {
        skippedUnknownEmployee.push({ rowIndex, employee_number });
        continue;
      }
      if (!skillId) {
        skippedUnknownSkill.push({ rowIndex, skill_code });
        continue;
      }
      toUpsert.push({ employee_id: employeeId, skill_id: skillId, level });
    }

    if (toUpsert.length === 0) {
      const res = NextResponse.json({
        summary: {
          inserted: 0,
          updated: 0,
          skipped: {
            unknownEmployee: skippedUnknownEmployee.length,
            unknownSkill: skippedUnknownSkill.length,
            invalid: errors.length,
          },
        },
        skippedRows: {
          unknownEmployee: skippedUnknownEmployee.slice(0, ERRORS_CAP),
          unknownSkill: skippedUnknownSkill.slice(0, ERRORS_CAP),
        },
        errors: errors.slice(0, ERRORS_CAP),
      });
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    let upserted = 0;
    for (let i = 0; i < toUpsert.length; i += BATCH_SIZE) {
      const batch = toUpsert.slice(i, i + BATCH_SIZE);
      const { error } = await supabase.from("employee_skills").upsert(batch, {
        onConflict: "employee_id,skill_id",
      });
      if (error) {
        console.error("[competencies/import/employee-skills] upsert batch", error);
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
        skipped: {
          unknownEmployee: skippedUnknownEmployee.length,
          unknownSkill: skippedUnknownSkill.length,
          invalid: errors.length,
        },
      },
      skippedRows: {
        unknownEmployee: skippedUnknownEmployee.slice(0, ERRORS_CAP),
        unknownSkill: skippedUnknownSkill.slice(0, ERRORS_CAP),
      },
      errors: errors.length > 0 ? errors.slice(0, ERRORS_CAP) : undefined,
    });
    applySupabaseCookies(res, pendingCookies);
    return res;
  } catch (err) {
    console.error("[competencies/import/employee-skills]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Employee-skills import failed" },
      { status: 500 }
    );
  }
}
