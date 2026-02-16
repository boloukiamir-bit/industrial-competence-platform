/**
 * POST /api/onboarding/shift-patterns/preview — parse and validate shift-patterns CSV. No DB writes.
 * Any org member can preview. Errors: unknown_site, duplicate_row, invalid_time, empty_field.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseServerClient, applySupabaseCookies } from "@/lib/supabase/server";
import { getOrgIdFromSession } from "@/lib/orgSession";
import {
  parseOnboardingCsv,
  findDuplicateRowIndices,
  parseTime,
  parseIntegerInRange,
} from "@/lib/onboarding/parseCsv";
import {
  getSitesByOrg,
  buildSiteNameToIdMap,
  resolveSiteId,
} from "@/lib/onboarding/resolveSites";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

const REQUIRED = ["site_name", "shift_code", "start_time", "end_time", "break_minutes"] as const;

type Row = Record<string, string>;

function trim(r: Row, key: string): string {
  return (r[key] ?? "").trim();
}

export async function POST(request: NextRequest) {
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
    csvText = typeof (body as { csv?: string }).csv === "string" ? (body as { csv: string }).csv : "";
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

  if (!csvText?.trim()) {
    const res = NextResponse.json({ error: "CSV content is empty" }, { status: 400 });
    applySupabaseCookies(res, pendingCookies);
    return res;
  }

  const { rows, errors, missingColumns } = parseOnboardingCsv<Row>(csvText, REQUIRED);
  if (missingColumns.length > 0) {
    const res = NextResponse.json({
      ok: false,
      errors,
      summary: { totalRows: rows.length, validRows: 0, errorCount: errors.length },
    });
    applySupabaseCookies(res, pendingCookies);
    return res;
  }

  const sites = await getSitesByOrg(supabaseAdmin, session.orgId);
  const siteNameToId = buildSiteNameToIdMap(sites);

  const duplicateKey = (r: Row) => {
    const siteId = resolveSiteId(trim(r, "site_name"), siteNameToId);
    const code = trim(r, "shift_code");
    return siteId && code ? `${siteId}_${code}` : "";
  };
  const duplicates = findDuplicateRowIndices(rows, duplicateKey);
  duplicates.forEach((indices) => {
    indices.forEach((rowIndex) =>
      errors.push({
        rowIndex,
        message: "Duplicate shift_code within same site",
        code: "duplicate_row",
      })
    );
  });

  rows.forEach((row, i) => {
    const rowIndex = i + 2;
    const siteName = trim(row, "site_name");
    const shiftCode = trim(row, "shift_code");
    const startTime = trim(row, "start_time");
    const endTime = trim(row, "end_time");
    const breakMinutes = trim(row, "break_minutes");

    if (!siteName) {
      errors.push({ rowIndex, message: "site_name is required", code: "empty_field" });
      return;
    }
    if (!shiftCode) {
      errors.push({ rowIndex, message: "shift_code is required", code: "empty_field" });
      return;
    }
    if (!startTime) {
      errors.push({ rowIndex, message: "start_time is required", code: "empty_field" });
      return;
    }
    if (!endTime) {
      errors.push({ rowIndex, message: "end_time is required", code: "empty_field" });
      return;
    }
    if (breakMinutes === "") {
      errors.push({ rowIndex, message: "break_minutes is required", code: "empty_field" });
      return;
    }

    const siteId = resolveSiteId(siteName, siteNameToId);
    if (!siteId) {
      errors.push({
        rowIndex,
        message: `Unknown site: "${siteName}"`,
        code: "unknown_site",
      });
      return;
    }

    if (!parseTime(startTime)) {
      errors.push({
        rowIndex,
        message: `Invalid start_time: "${startTime}" (use HH:MM or HH:MM:SS)`,
        code: "invalid_time",
      });
    }
    if (!parseTime(endTime)) {
      errors.push({
        rowIndex,
        message: `Invalid end_time: "${endTime}" (use HH:MM or HH:MM:SS)`,
        code: "invalid_time",
      });
    }
    const breakVal = parseIntegerInRange(breakMinutes, 0, 480);
    if (breakVal === null) {
      errors.push({
        rowIndex,
        message: `Invalid break_minutes: "${breakMinutes}" (0–480)`,
        code: "invalid_time",
      });
    }
  });

  const errorRowIndices = new Set(errors.filter((e) => e.rowIndex >= 2).map((e) => e.rowIndex));
  const validRows = rows.length - errorRowIndices.size;

  const res = NextResponse.json({
    ok: errors.length === 0,
    errors,
    summary: {
      totalRows: rows.length,
      validRows,
      errorCount: errors.length,
    },
    previewRows: rows.slice(0, 20),
  });
  applySupabaseCookies(res, pendingCookies);
  return res;
}
