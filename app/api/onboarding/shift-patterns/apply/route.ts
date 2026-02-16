/**
 * POST /api/onboarding/shift-patterns/apply — idempotent upsert of shift_patterns from CSV. Admin/HR only.
 * Upsert by site_id + shift_code. Returns summary + created/updated.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseServerClient, applySupabaseCookies } from "@/lib/supabase/server";
import { requireAdminOrHr } from "@/lib/server/requireAdminOrHr";
import { parseOnboardingCsv, parseTime, parseIntegerInRange } from "@/lib/onboarding/parseCsv";
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

  const toUpsert: {
    site_id: string;
    shift_code: string;
    start_time: string;
    end_time: string;
    break_minutes: number;
  }[] = [];
  const errors: Array<{ rowIndex: number; message: string }> = [];
  const seen = new Set<string>();

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowIndex = i + 2;
    const siteName = trim(row, "site_name");
    const shiftCode = trim(row, "shift_code");
    const startTime = trim(row, "start_time");
    const endTime = trim(row, "end_time");
    const breakMinutes = trim(row, "break_minutes");

    if (!siteName || !shiftCode || !startTime || !endTime) {
      errors.push({ rowIndex, message: "site_name, shift_code, start_time, end_time are required" });
      continue;
    }
    const siteId = resolveSiteId(siteName, siteNameToId);
    if (!siteId) {
      errors.push({ rowIndex, message: `Unknown site: ${siteName}` });
      continue;
    }
    const start = parseTime(startTime);
    const end = parseTime(endTime);
    const breakVal = parseIntegerInRange(breakMinutes, 0, 480);
    if (!start || !end) {
      errors.push({ rowIndex, message: "Invalid start_time or end_time (use HH:MM or HH:MM:SS)" });
      continue;
    }
    if (breakVal === null) {
      errors.push({ rowIndex, message: "break_minutes must be 0–480" });
      continue;
    }
    const key = `${siteId}_${shiftCode}`;
    if (seen.has(key)) continue;
    seen.add(key);
    toUpsert.push({
      site_id: siteId,
      shift_code: shiftCode,
      start_time: start,
      end_time: end,
      break_minutes: breakVal,
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

  const created: string[] = [];
  const updated: string[] = [];

  for (const u of toUpsert) {
    const { data: existing } = await supabaseAdmin
      .from("shift_patterns")
      .select("id, start_time, end_time, break_minutes")
      .eq("site_id", u.site_id)
      .eq("shift_code", u.shift_code)
      .maybeSingle();

    if (existing) {
      const { error: updateErr } = await supabaseAdmin
        .from("shift_patterns")
        .update({
          start_time: u.start_time,
          end_time: u.end_time,
          break_minutes: u.break_minutes,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id);
      if (updateErr) {
        errors.push({ rowIndex: -1, message: `Update ${u.shift_code}: ${updateErr.message}` });
      } else {
        updated.push(u.shift_code);
      }
    } else {
      const { data: siteRow } = await supabaseAdmin
        .from("sites")
        .select("org_id")
        .eq("id", u.site_id)
        .single();
      const orgId = siteRow?.org_id ?? auth.activeOrgId;
      const { error: insertErr } = await supabaseAdmin
        .from("shift_patterns")
        .insert({
          org_id: orgId,
          site_id: u.site_id,
          shift_code: u.shift_code,
          start_time: u.start_time,
          end_time: u.end_time,
          break_minutes: u.break_minutes,
          is_active: true,
        });
      if (insertErr) {
        errors.push({ rowIndex: -1, message: `Insert ${u.shift_code}: ${insertErr.message}` });
      } else {
        created.push(u.shift_code);
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
