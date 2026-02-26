/**
 * POST /api/cockpit/regulatory-radar/create-action — create a regulatory action draft as a governance event.
 * Body: { signal_id: string }. Governed via withMutationGovernance (allowNoShiftContext: true).
 */
import { NextResponse } from "next/server";
import { withMutationGovernance } from "@/lib/server/governance/withMutationGovernance";

function errorPayload(step: string, error: string) {
  return { ok: false as const, step, error };
}

export const POST = withMutationGovernance(
  async (ctx) => {
    const signal_id = typeof ctx.body.signal_id === "string" ? ctx.body.signal_id.trim() : "";
    if (!signal_id) {
      return NextResponse.json(errorPayload("validation", "signal_id is required"), { status: 400 });
    }

    const { data: signal, error: signalErr } = await ctx.admin
      .from("regulatory_signals")
      .select("id, org_id, title, summary, source_url, source_name, impact_level, effective_date, time_to_impact_days, relevance_score")
      .eq("id", signal_id)
      .eq("org_id", ctx.orgId)
      .maybeSingle();

    if (signalErr || !signal) {
      return NextResponse.json(
        errorPayload("not_found", "not_found"),
        { status: 404 }
      );
    }

    const s = signal as {
      id: string;
      title: string;
      summary: string | null;
      source_url: string | null;
      source_name: string | null;
      impact_level: string;
      effective_date: string | null;
      time_to_impact_days: number | null;
      relevance_score: number;
    };

    const payload = {
      signal_id: s.id,
      title: s.title,
      summary: s.summary ?? null,
      source_url: s.source_url ?? null,
      source_name: s.source_name ?? null,
      impact_level: s.impact_level,
      effective_date: s.effective_date ?? null,
      relevance_score: s.relevance_score,
      time_to_impact_days: s.time_to_impact_days ?? null,
    };

    const { data: inserted, error: insertErr } = await ctx.admin
      .from("governance_events")
      .insert({
        org_id: ctx.orgId,
        site_id: ctx.siteId ?? null,
        actor_user_id: ctx.userId,
        action: "REGULATORY_ACTION_DRAFT_CREATED",
        target_type: "regulatory_signal",
        target_id: s.id,
        outcome: "CREATED",
        legitimacy_status: "OK",
        readiness_status: "N/A",
        reason_codes: [],
        meta: payload,
        policy_fingerprint: null,
        idempotency_key: null,
      })
      .select("id")
      .single();

    if (insertErr) {
      console.error("[regulatory-radar/create-action] governance_events insert", insertErr);
      return NextResponse.json(
        errorPayload("insert", insertErr.message),
        { status: 500 }
      );
    }

    const draft_id = (inserted as { id: string }).id;
    return NextResponse.json({
      ok: true,
      draft_id,
      audit_url: `/app/admin/audit?id=${draft_id}`,
    });
  },
  {
    route: "/api/cockpit/regulatory-radar/create-action",
    action: "COCKPIT_REGULATORY_CREATE_ACTION",
    target_type: "regulatory_signal",
    allowNoShiftContext: true,
    getTargetIdAndMeta: (body) => ({
      target_id: typeof body.signal_id === "string" ? body.signal_id.trim() : "unknown",
      meta: {},
    }),
  }
);
