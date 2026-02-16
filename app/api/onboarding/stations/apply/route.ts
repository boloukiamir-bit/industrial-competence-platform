/**
 * POST /api/onboarding/stations/apply — idempotent upsert of stations from CSV. Admin/HR only.
 * Stations must resolve to an existing area (by area_name or area_code). No orphan stations.
 * Upsert by (org_id, code): existing rows get name/area_id/area_code/line updated; new rows inserted.
 * Returns summary + created/updated; ok:false only on real row-level errors, with partial counts.
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
import {
  getAreasByOrgAndSites,
  buildAreaLookup,
  resolveAreaId,
} from "@/lib/onboarding/resolveAreas";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

const REQUIRED = ["site_name", "area_name", "station_name", "station_code"] as const;

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
  const siteIds = [...siteNameToId.values()];
  const areas = await getAreasByOrgAndSites(supabaseAdmin, auth.activeOrgId, siteIds);
  const areaLookup = buildAreaLookup(areas);

  const errors: Array<{ rowIndex: number; message: string }> = [];
  const byCode = new Map<string, { area_id: string; area_code: string; code: string; name: string }>();

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowIndex = i + 2;
    const siteName = trim(row, "site_name");
    const areaRef = trim(row, "area_code") || trim(row, "area_name");
    const stationName = trim(row, "station_name");
    const stationCode = trim(row, "station_code");

    if (!siteName || !stationCode || !stationName) {
      errors.push({ rowIndex, message: "site_name, station_name, and station_code are required" });
      continue;
    }
    if (!areaRef) {
      errors.push({ rowIndex, message: "area_name or area_code is required" });
      continue;
    }
    const siteId = resolveSiteId(siteName, siteNameToId);
    if (!siteId) {
      errors.push({ rowIndex, message: `Unknown site: ${siteName}` });
      continue;
    }
    const resolvedArea = resolveAreaId(siteId, areaRef, areaLookup);
    if (!resolvedArea) {
      errors.push({ rowIndex, message: `Unknown area: ${areaRef} in site ${siteName}` });
      continue;
    }
    byCode.set(stationCode, {
      area_id: resolvedArea.id,
      area_code: resolvedArea.code,
      code: stationCode,
      name: stationName,
    });
  }

  const toUpsert = [...byCode.values()];
  if (toUpsert.length === 0) {
    const res = NextResponse.json(
      { error: "No valid rows to apply", errors: errors.length ? errors : undefined },
      { status: 400 }
    );
    applySupabaseCookies(res, pendingCookies);
    return res;
  }

  const created: string[] = [];
  const updated: string[] = [];
  const now = new Date().toISOString();

  for (const u of toUpsert) {
    const { data: existing, error: selectErr } = await supabaseAdmin
      .from("stations")
      .select("id, name, area_id")
      .eq("org_id", auth.activeOrgId)
      .eq("code", u.code)
      .maybeSingle();

    if (selectErr) {
      errors.push({ rowIndex: -1, message: `Station ${u.code}: ${selectErr.message}` });
      continue;
    }

    if (existing) {
      const updatePayload = {
        name: u.name,
        area_id: u.area_id,
        area_code: u.area_code,
        line: u.area_code,
        is_active: true,
        updated_at: now,
      };
      const { error: updateErr } = await supabaseAdmin
        .from("stations")
        .update(updatePayload)
        .eq("id", existing.id);
      if (updateErr) {
        errors.push({ rowIndex: -1, message: `Update station ${u.code}: ${updateErr.message}` });
      } else {
        updated.push(u.code);
      }
    } else {
      const { error: insertErr } = await supabaseAdmin
        .from("stations")
        .insert({
          org_id: auth.activeOrgId,
          area_id: u.area_id,
          area_code: u.area_code,
          code: u.code,
          name: u.name,
          line: u.area_code,
          is_active: true,
          updated_at: now,
        });
      if (insertErr) {
        errors.push({ rowIndex: -1, message: `Insert station ${u.code}: ${insertErr.message}` });
      } else {
        created.push(u.code);
      }
    }
  }

  const res = NextResponse.json(
    {
      ok: errors.length === 0,
      summary: {
        created: created.length,
        updated: updated.length,
        createdCodes: created,
        updatedCodes: updated,
      },
      ...(errors.length > 0 && { errors }),
    },
    { status: errors.length > 0 ? 422 : 200 }
  );
  applySupabaseCookies(res, pendingCookies);
  return res;
}
