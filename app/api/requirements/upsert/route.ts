/**
 * POST /api/requirements/upsert — upsert or delete a single station_skill_requirement.
 * Body: { station_id, skill_id, required: boolean }
 * Returns impact preview: before, after, deltaEligible, danger, hardBlock.
 * Tenant-scoped via active_org_id. Uses v_tomorrows_gaps_station_health (no Node recompute).
 * Governed via withMutationGovernance (allowNoShiftContext: true).
 */
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { withMutationGovernance } from "@/lib/server/governance/withMutationGovernance";

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

export const POST = withMutationGovernance(
  async (ctx) => {
    try {
      const body = ctx.body as Body;
      const stationId = typeof body.station_id === "string" ? body.station_id.trim() : null;
      const skillId = typeof body.skill_id === "string" ? body.skill_id.trim() : null;
      const required = body.required === true;

      if (!stationId || !skillId) {
        return NextResponse.json(
          { error: "station_id and skill_id are required" },
          { status: 400 }
        );
      }

      const { data: station } = await ctx.supabase
        .from("stations")
        .select("id")
        .eq("id", stationId)
        .eq("org_id", ctx.orgId)
        .single();
      if (!station) {
        return NextResponse.json({ error: "Station not found or not in org" }, { status: 403 });
      }

      const { data: skill } = await ctx.supabase
        .from("skills")
        .select("id")
        .eq("id", skillId)
        .eq("org_id", ctx.orgId)
        .single();
      if (!skill) {
        return NextResponse.json({ error: "Skill not found or not in org" }, { status: 403 });
      }

      const before = await fetchHealth(ctx.admin, ctx.orgId, stationId);

      if (required) {
        const { error: upsertErr } = await ctx.supabase
          .from("station_skill_requirements")
          .upsert(
            {
              org_id: ctx.orgId,
              station_id: stationId,
              skill_id: skillId,
              required_level: 1,
            },
            { onConflict: "org_id,station_id,skill_id" }
          );
        if (upsertErr) {
          console.error("requirements/upsert:", upsertErr);
          return NextResponse.json({ error: "Failed to save requirement" }, { status: 500 });
        }
      } else {
        const { error: delErr } = await ctx.supabase
          .from("station_skill_requirements")
          .delete()
          .eq("org_id", ctx.orgId)
          .eq("station_id", stationId)
          .eq("skill_id", skillId);
        if (delErr) {
          console.error("requirements/upsert delete:", delErr);
          return NextResponse.json({ error: "Failed to remove requirement" }, { status: 500 });
        }
      }

      const after = await fetchHealth(ctx.admin, ctx.orgId, stationId);
      const afterEligible = after?.eligible_final ?? 0;
      const beforeEligible = before?.eligible_final ?? 0;
      const deltaEligible = afterEligible - beforeEligible;
      const danger = afterEligible <= 3;
      const hardBlock = afterEligible === 0;

      return NextResponse.json({
        ok: true,
        before: before ?? null,
        after: after ?? null,
        deltaEligible,
        danger,
        hardBlock,
        server_time: new Date().toISOString(),
      });
    } catch (err) {
      console.error("POST /api/requirements/upsert failed:", err);
      return NextResponse.json(
        { error: err instanceof Error ? err.message : "Internal error" },
        { status: 500 }
      );
    }
  },
  {
    route: "/api/requirements/upsert",
    action: "REQUIREMENTS_UPSERT",
    target_type: "org",
    allowNoShiftContext: true,
    getTargetIdAndMeta: (body) => ({
      target_id: typeof (body as Body).station_id === "string" ? `station:${(body as Body).station_id}` : "unknown",
      meta: {},
    }),
  }
);
