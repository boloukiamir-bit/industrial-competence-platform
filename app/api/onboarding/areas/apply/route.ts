/**
 * POST /api/onboarding/areas/apply — idempotent upsert of areas from CSV. Admin/HR only.
 * Upsert by org_id + site_id + code. Returns summary counts + created/updated lists.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseServerClient, applySupabaseCookies } from "@/lib/supabase/server";
import { requireAdminOrHr } from "@/lib/server/requireAdminOrHr";
import { parseOnboardingCsv } from "@/lib/onboarding/parseCsv";
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
    csvText = typeof (body as { csv?: string }).csv === "string" ? (body as { csv: string }).csv : "";
  } else {
    csvText = await request.text();
  }
  if (!csvText?.trim()) {
    const res = NextResponse.json({ error: "CSV content is required" }, { status: 400 });
    applySupabaseCookies(res, pendingCookies);
    return res;
  }

  const { rows, missingColumns } = parseOnboardingCsv<Row>(csvText, REQUIRED);
  if (missingColumns.length > 0) {
    const res = NextResponse.json(
      { error: `Missing required columns: ${missingColumns.join(", ")}` },
      { status: 400 }
    );
    applySupabaseCookies(res, pendingCookies);
    return res;
  }

  const sites = await getSitesByOrg(supabaseAdmin, auth.activeOrgId);
  const siteNameToId = buildSiteNameToIdMap(sites);

  const toUpsert: { site_id: string; code: string; name: string }[] = [];
  const errors: Array<{ rowIndex: number; message: string }> = [];
  const seen = new Set<string>();

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowIndex = i + 2;
    const siteName = trim(row, "site_name");
    const areaName = trim(row, "area_name");
    const areaCode = trim(row, "area_code");

    if (!siteName || !areaCode) {
      errors.push({ rowIndex, message: "site_name and area_code are required" });
      continue;
    }
    const siteId = resolveSiteId(siteName, siteNameToId);
    if (!siteId) {
      errors.push({ rowIndex, message: `Unknown site: ${siteName}` });
      continue;
    }
    const key = `${siteId}_${areaCode}`;
    if (seen.has(key)) continue;
    seen.add(key);
    toUpsert.push({
      site_id: siteId,
      code: areaCode,
      name: areaName || areaCode,
    });
  }

  if (toUpsert.length === 0) {
    const res = NextResponse.json(
      { error: "No valid rows to apply", errors: errors.length ? errors : undefined },
      { status: 400 }
    );
    applySupabaseCookies(res, pendingCookies);
    return res;
  }

  const { data: existing } = await supabaseAdmin
    .from("areas")
    .select("id, site_id, code, name")
    .eq("org_id", auth.activeOrgId)
    .in("site_id", [...new Set(toUpsert.map((u) => u.site_id))]);

  const existingByKey = new Map<string, { id: string; name: string }>();
  for (const e of existing ?? []) {
    const sid = e.site_id ?? "";
    existingByKey.set(`${sid}_${e.code}`, { id: e.id, name: e.name ?? "" });
  }

  const created: string[] = [];
  const updated: string[] = [];
  const now = new Date().toISOString();

  for (const u of toUpsert) {
    const key = `${u.site_id}_${u.code}`;
    const existingRow = existingByKey.get(key);
    if (existingRow) {
      if (existingRow.name !== u.name) {
        const { error: updateErr } = await supabaseAdmin
          .from("areas")
          .update({ name: u.name, updated_at: now })
          .eq("id", existingRow.id);
        if (updateErr) {
          errors.push({ rowIndex: -1, message: `Update area ${u.code}: ${updateErr.message}` });
        } else {
          updated.push(u.code);
        }
      }
    } else {
      const { data: inserted, error: insertErr } = await supabaseAdmin
        .from("areas")
        .insert({
          org_id: auth.activeOrgId,
          site_id: u.site_id,
          code: u.code,
          name: u.name,
          is_active: true,
          updated_at: now,
        })
        .select("id")
        .single();
      if (insertErr) {
        errors.push({ rowIndex: -1, message: `Insert area ${u.code}: ${insertErr.message}` });
      } else if (inserted) {
        created.push(u.code);
      }
    }
  }

  const res = NextResponse.json({
    ok: true,
    summary: {
      created: created.length,
      updated: updated.length,
      createdCodes: created,
      updatedCodes: updated,
    },
    errors: errors.length > 0 ? errors : undefined,
  });
  applySupabaseCookies(res, pendingCookies);
  return res;
}
