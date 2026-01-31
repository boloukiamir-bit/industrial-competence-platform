/**
 * POST /api/import/employees/preview
 * Parses CSV, validates required columns (employee_number, name), returns first 20 rows + errors + summary.
 * Tenant-scoped: no org override; caller must be authenticated.
 */
import { NextRequest, NextResponse } from "next/server";
import Papa from "papaparse";
import { getOrgIdFromSession } from "@/lib/orgSession";
import { createSupabaseServerClient, applySupabaseCookies } from "@/lib/supabase/server";

const REQUIRED_COLUMNS = ["employee_number", "name"] as const;
const PREVIEW_ROW_LIMIT = 20;

type ParsedRow = Record<string, string>;

function normalizeHeader(h: string): string {
  return h.trim().toLowerCase().replace(/\s+/g, "_");
}

function validateRow(row: ParsedRow, rowIndex: number): string[] {
  const errs: string[] = [];
  const num = (row.employee_number ?? "").trim();
  const name = (row.name ?? "").trim();
  if (!num) errs.push("employee_number is required");
  if (!name) errs.push("name is required");
  return errs;
}

export async function POST(request: NextRequest) {
  try {
    const { supabase, pendingCookies } = await createSupabaseServerClient();
    const session = await getOrgIdFromSession(request, supabase);
    if (!session.success) {
      const res = NextResponse.json({ error: session.error }, { status: session.status });
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    let csvText: string;
    const contentType = request.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      const body = await request.json().catch(() => ({}));
      csvText = typeof body.csv === "string" ? body.csv : "";
    } else if (contentType.includes("text/csv") || contentType.includes("text/plain")) {
      csvText = await request.text();
    } else {
      const res = NextResponse.json(
        { error: "Send CSV as JSON { csv: string } or body as text/csv" },
        { status: 400 }
      );
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    if (!csvText || !csvText.trim()) {
      const res = NextResponse.json({ error: "CSV content is empty" }, { status: 400 });
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const parsed = Papa.parse<Record<string, string>>(csvText, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => normalizeHeader(h),
    });

    if (parsed.errors.length > 0 && parsed.errors.some((e) => e.type === "Quotes")) {
      const res = NextResponse.json(
        { error: "Invalid CSV format", details: parsed.errors.slice(0, 5) },
        { status: 400 }
      );
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const rows = (parsed.data ?? []) as ParsedRow[];
    const errors: Array<{ rowIndex: number; message: string }> = [];
    const previewRows: ParsedRow[] = [];
    let validCount = 0;

    const missingCols = REQUIRED_COLUMNS.filter(
      (col) => !parsed.meta.fields?.includes(col)
    );
    if (missingCols.length > 0) {
      const res = NextResponse.json({
        rows: [],
        errors: [{ rowIndex: -1, message: `Missing required columns: ${missingCols.join(", ")}` }],
        summary: { totalRows: rows.length, validRows: 0, errorCount: rows.length + 1 },
      });
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const validRows: ParsedRow[] = [];
    rows.forEach((row, i) => {
      const rowIndex = i + 2;
      const errs = validateRow(row, rowIndex);
      if (errs.length > 0) {
        errs.forEach((msg) => errors.push({ rowIndex, message: msg }));
      } else {
        validCount++;
        validRows.push(row);
        if (previewRows.length < PREVIEW_ROW_LIMIT) previewRows.push(row);
      }
    });

    const res = NextResponse.json({
      rows: previewRows,
      validRows,
      errors,
      summary: {
        totalRows: rows.length,
        validRows: validCount,
        errorCount: errors.length,
      },
    });
    applySupabaseCookies(res, pendingCookies);
    return res;
  } catch (err) {
    console.error("[import/employees/preview]", err);
    return NextResponse.json(
      { error: "Preview failed" },
      { status: 500 }
    );
  }
}
