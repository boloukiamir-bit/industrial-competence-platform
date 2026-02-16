/**
 * GET /api/cockpit/filters — DB-driven options for Cockpit shift and area dropdowns.
 * Returns areas (public.areas, is_active) and shift_codes from shift_patterns (seeded only).
 * Tenant scope: ctx.orgId / ctx.siteId (cookie or Bearer via getAuthedContext).
 * If siteId missing, returns shift_codes: [] with a warning.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { applySupabaseCookies } from "@/lib/supabase/server";
import { getAuthedContext } from "@/lib/auth/getAuthedContext";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export type CockpitFiltersResponse = {
  ok: true;
  areas: Array<{ code: string; name: string }>;
  shift_codes: Array<{
    code: string;
    name: string;
    start_time: string | null;
    end_time: string | null;
    break_minutes: number;
  }>;
  warning?: string;
};

export async function GET(request: NextRequest) {
  try {
    const ctx = await getAuthedContext(request);
    if (!ctx.ok) {
      const res = NextResponse.json({ error: ctx.error }, { status: ctx.status });
      return res;
    }

    const { orgId, siteId } = ctx;
    const warnings: string[] = [];

    const [areasRes, shiftPatternsRes] = await Promise.all([
      supabaseAdmin
        .from("areas")
        .select("code, name")
        .eq("org_id", orgId)
        .eq("is_active", true)
        .order("code", { ascending: true }),
      siteId
        ? supabaseAdmin
            .from("shift_patterns")
            .select("shift_code, start_time, end_time, break_minutes")
            .eq("org_id", orgId)
            .eq("site_id", siteId)
            .eq("is_active", true)
            .order("shift_code", { ascending: true })
        : Promise.resolve({ data: [] as Array<{ shift_code: string; start_time: string | null; end_time: string | null; break_minutes: number }>, error: null }),
    ]);

    if (!siteId) {
      warnings.push("No active site selected; shift codes are empty. Set a site in the org switcher.");
    }

    const areas: Array<{ code: string; name: string }> = (areasRes.data ?? []).map((r) => ({
      code: String(r.code ?? ""),
      name: String(r.name ?? r.code ?? ""),
    }));

    const byCode = new Map<string, CockpitFiltersResponse["shift_codes"][0]>();
    for (const r of shiftPatternsRes.data ?? []) {
      const code = String((r as { shift_code?: string }).shift_code ?? "").trim();
      if (!code || byCode.has(code)) continue;
      byCode.set(code, {
        code,
        name: code,
        start_time: (r as { start_time?: string | null }).start_time != null ? String((r as { start_time: string }).start_time) : null,
        end_time: (r as { end_time?: string | null }).end_time != null ? String((r as { end_time: string }).end_time) : null,
        break_minutes: typeof (r as { break_minutes?: number }).break_minutes === "number" ? (r as { break_minutes: number }).break_minutes : 0,
      });
    }
    const shift_codes = [...byCode.values()].sort((a, b) => a.code.localeCompare(b.code));

    const body: CockpitFiltersResponse = {
      ok: true,
      areas,
      shift_codes,
      ...(warnings.length > 0 && { warning: warnings.join(" ") }),
    };
    const res = NextResponse.json(body);
    applySupabaseCookies(res, ctx.pendingCookies);
    return res;
  } catch (err) {
    console.error("[cockpit/filters]", err);
    return NextResponse.json({ error: "Failed to load filters" }, { status: 500 });
  }
}
