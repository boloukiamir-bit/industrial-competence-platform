/**
 * POST /api/requirements/upsert — upsert or delete a single station_skill_requirement.
 * Body: { station_id, skill_id, required: boolean }
 * Returns impact preview: before, after, deltaEligible, danger, hardBlock.
 * Tenant-scoped via active_org_id. Uses v_tomorrows_gaps_station_health (no Node recompute).
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseServerClient, applySupabaseCookies } from "@/lib/supabase/server";
import { getActiveOrgFromSession } from "@/lib/server/activeOrg";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type Body = { station_id?: string; skill_id?: string; required?: boolean };

type HealthRow = {
  station_id: string;
  station_code: string;
  station_name: string;
  eligible_final: number;
  risk_tier: string | null;
  req_status: string;
  req_skill_count: number;
  data_maturity: string | null;
};

function mapHealthRow(h: Record<string, unknown>): HealthRow {
  return {
    station_id: String(h.station_id ?? ""),
    station_code: String(h.station_code ?? ""),
    station_name: String(h.station_name ?? ""),
    eligible_final: Number(h.eligible_final ?? 0),
    risk_tier: h.risk_tier != null ? String(h.risk_tier) : null,
    req_status: String(h.req_status ?? "PENDING"),
    req_skill_count: Number(h.req_skill_count ?? 0),
    data_maturity: h.data_maturity != null ? String(h.data_maturity) : null,
  };
}

async function fetchHealth(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: any,
  activeOrgId: string,
  stationId: string
): Promise<HealthRow | null> {
  const { data: rows } = await client
    .from("v_tomorrows_gaps_station_health")
    .select("station_id, station_code, station_name, eligible_final, risk_tier, req_status, req_skill_count, data_maturity")
    .eq("org_id", activeOrgId)
    .eq("station_id", stationId);
  if (!rows || rows.length === 0) return null;
  return mapHealthRow(rows[0] as Record<string, unknown>);
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
    const activeOrgId = org.activeOrgId;

    let body: Body = {};
    try {
      body = await request.json();
    } catch {
      // ignore
    }

    const stationId = typeof body.station_id === "string" ? body.station_id.trim() : null;
    const skillId = typeof body.skill_id === "string" ? body.skill_id.trim() : null;
    const required = body.required === true;

    if (!stationId || !skillId) {
      const res = NextResponse.json(
        { error: "station_id and skill_id are required" },
        { status: 400 }
      );
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const { data: station } = await supabase
      .from("stations")
      .select("id")
      .eq("id", stationId)
      .eq("org_id", activeOrgId)
      .single();
    if (!station) {
      const res = NextResponse.json({ error: "Station not found or not in org" }, { status: 403 });
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const { data: skill } = await supabase
      .from("skills")
      .select("id")
      .eq("id", skillId)
      .eq("org_id", activeOrgId)
      .single();
    if (!skill) {
      const res = NextResponse.json({ error: "Skill not found or not in org" }, { status: 403 });
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const before = await fetchHealth(supabaseAdmin, activeOrgId, stationId);

    if (required) {
      const { error: upsertErr } = await supabase
        .from("station_skill_requirements")
        .upsert(
          {
            org_id: activeOrgId,
            station_id: stationId,
            skill_id: skillId,
            required_level: 1,
          },
          { onConflict: "org_id,station_id,skill_id" }
        );
      if (upsertErr) {
        console.error("requirements/upsert:", upsertErr);
        const res = NextResponse.json({ error: "Failed to save requirement" }, { status: 500 });
        applySupabaseCookies(res, pendingCookies);
        return res;
      }
    } else {
      const { error: delErr } = await supabase
        .from("station_skill_requirements")
        .delete()
        .eq("org_id", activeOrgId)
        .eq("station_id", stationId)
        .eq("skill_id", skillId);
      if (delErr) {
        console.error("requirements/upsert delete:", delErr);
        const res = NextResponse.json({ error: "Failed to remove requirement" }, { status: 500 });
        applySupabaseCookies(res, pendingCookies);
        return res;
      }
    }

    const after = await fetchHealth(supabaseAdmin, activeOrgId, stationId);
    const afterEligible = after?.eligible_final ?? 0;
    const beforeEligible = before?.eligible_final ?? 0;
    const deltaEligible = afterEligible - beforeEligible;
    const danger = afterEligible <= 3;
    const hardBlock = afterEligible === 0;

    const res = NextResponse.json({
      ok: true,
      before: before ?? null,
      after: after ?? null,
      deltaEligible,
      danger,
      hardBlock,
      server_time: new Date().toISOString(),
    });
    applySupabaseCookies(res, pendingCookies);
    return res;
  } catch (err) {
    console.error("POST /api/requirements/upsert failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 }
    );
  }
}
