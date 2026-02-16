/**
 * POST /api/admin/seed/factory — Idempotent seed for factory structure (active tenant).
 * Body: { areas?, stations?, shift_codes? }. Tenant-scoped by active_org_id + active_site_id.
 * Admin/HR only. Auth: (A) cookie session (browser) or (B) Authorization: Bearer <access_token> (curl/CLI).
 *
 * curl example (Bearer):
 *   TOKEN=$(supabase login --print-token 2>/dev/null || echo "YOUR_ACCESS_TOKEN")
 *   curl -s -X POST "http://localhost:3000/api/admin/seed/factory" \
 *     -H "Content-Type: application/json" \
 *     -H "Authorization: Bearer $TOKEN" \
 *     -d '{"areas":[{"code":"BEARB","name":"Bearbetning"}],"stations":[],"shift_codes":[]}'
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { applySupabaseCookies } from "@/lib/supabase/server";
import { getAuthedContext } from "@/lib/auth/getAuthedContext";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type AreaInput = { code: string; name: string };
type StationInput = { code: string; name: string; area_code: string };
type ShiftCodeInput = {
  code: string;
  name: string;
  start_time?: string;
  end_time?: string;
  break_minutes?: number;
};

type Body = {
  areas?: AreaInput[];
  stations?: StationInput[];
  shift_codes?: ShiftCodeInput[];
};

function parseTime(s: string | undefined): string | null {
  if (s == null || typeof s !== "string") return null;
  const trimmed = s.trim();
  if (!trimmed) return null;
  const match = trimmed.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (!match) return null;
  const [, h, m, sec] = match;
  return `${h.padStart(2, "0")}:${m}:${(sec ?? "00").padStart(2, "0")}`;
}

export async function POST(request: NextRequest) {
  try {
    const ctx = await getAuthedContext(request);
    if (!ctx.ok) {
      const body: { error: string; debug?: unknown } = { error: ctx.error };
      if (process.env.NODE_ENV !== "production" && "debug" in ctx && ctx.debug != null) {
        body.debug = ctx.debug;
      }
      return NextResponse.json(body, { status: ctx.status });
    }

    const body = (await request.json().catch(() => ({}))) as Body;
    const areasIn = Array.isArray(body.areas) ? body.areas : [];
    const stationsIn = Array.isArray(body.stations) ? body.stations : [];
    const shiftCodesIn = Array.isArray(body.shift_codes) ? body.shift_codes : [];

    const summary = {
      areas: { inserted: 0, updated: 0 },
      stations: { inserted: 0, updated: 0, failed_count: 0 },
      shift_codes: { inserted: 0, updated: 0 },
      warnings: [] as string[],
    };
    const stationsErrors: { code: string; area_code: string; error: string }[] = [];

    const orgId = ctx.orgId;
    const siteId = ctx.siteId;

    // --- Areas (org-scoped, upsert by org_id + code) ---
    for (const a of areasIn) {
      const code = typeof a.code === "string" ? a.code.trim() : "";
      const name = typeof a.name === "string" ? a.name.trim() : code;
      if (!code) continue;

      const { data: existing } = await supabaseAdmin
        .from("areas")
        .select("id")
        .eq("org_id", orgId)
        .eq("code", code)
        .maybeSingle();

      const payload = { org_id: orgId, code, name, updated_at: new Date().toISOString() };
      if (existing) {
        const { error } = await supabaseAdmin.from("areas").update(payload).eq("id", existing.id);
        if (!error) summary.areas.updated++;
      } else {
        const { error } = await supabaseAdmin.from("areas").insert(payload);
        if (!error) summary.areas.inserted++;
      }
    }

    // --- Stations (org-scoped; unique (org_id, code) — ux_stations_org_code) ---
    // Lookup by (org_id, code). Update: name, area_code, line, is_active, updated_at. Insert: full payload. Normalize: trim code/area_code, uppercase area_code.
    for (const s of stationsIn) {
      const code = typeof s.code === "string" ? s.code.trim() : "";
      const name = typeof s.name === "string" ? s.name.trim() : code;
      const area_codeRaw = typeof s.area_code === "string" ? s.area_code.trim() : "";
      const area_code = area_codeRaw.toUpperCase();
      if (!code) continue;

      const payload = {
        org_id: orgId,
        code,
        name: name || code,
        area_code: area_code || null,
        line: area_code || null,
        is_active: true,
        updated_at: new Date().toISOString(),
      };

      const { data: existing, error: selectError } = await supabaseAdmin
        .from("stations")
        .select("id")
        .eq("org_id", orgId)
        .eq("code", code)
        .maybeSingle();

      if (selectError) {
        summary.stations.failed_count++;
        stationsErrors.push({ code, area_code, error: selectError.message });
        continue;
      }

      if (existing) {
        const { error } = await supabaseAdmin.from("stations").update(payload).eq("id", existing.id);
        if (error) {
          summary.stations.failed_count++;
          stationsErrors.push({ code, area_code, error: error.message });
        } else {
          summary.stations.updated++;
        }
      } else {
        const { error } = await supabaseAdmin.from("stations").insert(payload);
        if (error) {
          summary.stations.failed_count++;
          stationsErrors.push({ code, area_code, error: error.message });
        } else {
          summary.stations.inserted++;
        }
      }
    }

    // --- Shift codes (site-scoped; only when active_site_id is set) ---
    if (siteId) {
      for (const sc of shiftCodesIn) {
        const code = typeof sc.code === "string" ? sc.code.trim() : "";
        const name = typeof sc.name === "string" ? sc.name.trim() : code;
        if (!code) continue;

        const startTime = parseTime(sc.start_time);
        const endTime = parseTime(sc.end_time);
        const breakMinutes = typeof sc.break_minutes === "number"
          ? Math.max(0, Math.min(480, Math.round(sc.break_minutes)))
          : 0;

        const { data: existing } = await supabaseAdmin
          .from("shift_codes")
          .select("id")
          .eq("site_id", siteId)
          .eq("code", code)
          .maybeSingle();

        const payload = {
          site_id: siteId,
          code,
          name: name || code,
          start_time: startTime,
          end_time: endTime,
          break_minutes: breakMinutes,
          updated_at: new Date().toISOString(),
        };

        if (existing) {
          const { error } = await supabaseAdmin.from("shift_codes").update(payload).eq("id", existing.id);
          if (!error) summary.shift_codes.updated++;
        } else {
          const { error } = await supabaseAdmin.from("shift_codes").insert(payload);
          if (!error) summary.shift_codes.inserted++;
        }
      }
    } else if (shiftCodesIn.length > 0) {
      summary.warnings.push("No active site selected; shift_codes were skipped. Set a site in the org switcher to seed shift codes.");
    }

    const resBody: {
      ok: true;
      summary: {
        areas: typeof summary.areas;
        stations: typeof summary.stations;
        shift_codes: typeof summary.shift_codes;
        warnings?: string[];
        stations_errors?: { code: string; area_code: string; error: string }[];
      };
    } = {
      ok: true,
      summary: {
        areas: summary.areas,
        stations: summary.stations,
        shift_codes: summary.shift_codes,
        warnings: summary.warnings.length > 0 ? summary.warnings : undefined,
      },
    };
    if (
      process.env.NODE_ENV !== "production" &&
      summary.stations.failed_count > 0 &&
      stationsErrors.length > 0
    ) {
      resBody.summary.stations_errors = stationsErrors;
    }
    const res = NextResponse.json(resBody);
    applySupabaseCookies(res, ctx.pendingCookies);
    return res;
  } catch (err) {
    console.error("[admin/seed/factory]", err);
    return NextResponse.json({ error: "Seed failed" }, { status: 500 });
  }
}
