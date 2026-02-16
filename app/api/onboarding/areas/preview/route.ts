/**
 * POST /api/onboarding/areas/preview — parse and validate areas CSV. No DB writes.
 * Any org member can preview. Returns structured errors: unknown_site, duplicate_row, empty_field.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseServerClient, applySupabaseCookies } from "@/lib/supabase/server";
import { getOrgIdFromSession } from "@/lib/orgSession";
import {
  parseOnboardingCsv,
  findDuplicateRowIndices,
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

const REQUIRED = ["site_name", "area_name", "area_code"] as const;

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
    const code = trim(r, "area_code");
    return siteId && code ? `${siteId}_${code}` : "";
  };
  const duplicates = findDuplicateRowIndices(rows, duplicateKey);
  duplicates.forEach((indices) => {
    indices.forEach((rowIndex) =>
      errors.push({ rowIndex, message: "Duplicate area_code within same site", code: "duplicate_row" })
    );
  });

  const seen = new Set<string>();
  rows.forEach((row, i) => {
    const rowIndex = i + 2;
    const siteName = trim(row, "site_name");
    const areaName = trim(row, "area_name");
    const areaCode = trim(row, "area_code");

    if (!siteName) {
      errors.push({ rowIndex, message: "site_name is required", code: "empty_field" });
      return;
    }
    if (!areaName && !areaCode) {
      errors.push({ rowIndex, message: "area_name or area_code is required", code: "empty_field" });
      return;
    }
    if (!areaCode) {
      errors.push({ rowIndex, message: "area_code is required", code: "empty_field" });
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

    const key = `${siteId}_${areaCode}`;
    if (seen.has(key)) return;
    seen.add(key);
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
