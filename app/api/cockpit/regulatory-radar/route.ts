/**
 * GET /api/cockpit/regulatory-radar — Read-only Regulatory Radar signals for Cockpit.
 * Auth/org: getActiveOrgFromSession. Scope: active org; optional site (site_id = active OR null).
 * No mutations. On unexpected errors: 200 { ok: true, supported: false, signals: [], reasons }.
 */
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient, applySupabaseCookies } from "@/lib/supabase/server";
import { getActiveOrgFromSession } from "@/lib/server/activeOrg";

type SourceType = "AUTO" | "MANUAL";
type ImpactLevel = "LOW" | "MEDIUM" | "HIGH";

export type RegulatoryRadarSignal = {
  id: string;
  source_type: SourceType;
  impact_level: ImpactLevel;
  title: string;
  summary: string | null;
  source_name: string | null;
  source_url: string | null;
  effective_date: string | null;
  time_to_impact_days: number | null;
  relevance_score: number;
  created_at: string;
};

const IMPACT_ORDER: Record<ImpactLevel, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 };

function compareSignals(a: RegulatoryRadarSignal, b: RegulatoryRadarSignal): number {
  const impactA = IMPACT_ORDER[a.impact_level];
  const impactB = IMPACT_ORDER[b.impact_level];
  if (impactA !== impactB) return impactA - impactB;
  if (b.relevance_score !== a.relevance_score) return b.relevance_score - a.relevance_score;
  const dateA = a.effective_date ?? "";
  const dateB = b.effective_date ?? "";
  if (dateA !== dateB) return dateA.localeCompare(dateB);
  return (b.created_at ?? "").localeCompare(a.created_at ?? "");
}

export async function GET(request: NextRequest) {
  const { supabase, pendingCookies } = await createSupabaseServerClient(request);
  const org = await getActiveOrgFromSession(request, supabase);
  if (!org.ok) {
    const res = NextResponse.json(
      { ok: false, error: org.error },
      { status: org.status }
    );
    applySupabaseCookies(res, pendingCookies);
    return res;
  }

  try {
    const orgId = org.activeOrgId;
    const activeSiteId = org.activeSiteId ?? null;

    let query = supabase
      .from("regulatory_signals")
      .select("id, source_type, impact_level, title, summary, source_name, source_url, effective_date, time_to_impact_days, relevance_score, created_at")
      .eq("org_id", orgId)
      .eq("dismissed", false);

    if (activeSiteId) {
      query = query.or(`site_id.is.null,site_id.eq.${activeSiteId}`);
    }

    const { data: rows, error } = await query;

    if (error) {
      console.error("[cockpit/regulatory-radar] query error:", error);
      const res = NextResponse.json({
        ok: true,
        supported: false,
        signals: [],
        reasons: ["unexpected_error"],
      });
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const filtered = (rows ?? []).filter(
      (r: { source_type: string; relevance_score: number }) =>
        r.source_type === "MANUAL" || (r.source_type === "AUTO" && r.relevance_score >= 40)
    );

    const signals: RegulatoryRadarSignal[] = filtered.map(
      (r: {
        id: string;
        source_type: string;
        impact_level: string;
        title: string;
        summary: string | null;
        source_name: string | null;
        source_url: string | null;
        effective_date: string | null;
        time_to_impact_days: number | null;
        relevance_score: number;
        created_at: string;
      }) => ({
        id: r.id,
        source_type: r.source_type as SourceType,
        impact_level: r.impact_level as ImpactLevel,
        title: r.title,
        summary: r.summary ?? null,
        source_name: r.source_name ?? null,
        source_url: r.source_url ?? null,
        effective_date: r.effective_date ?? null,
        time_to_impact_days: r.time_to_impact_days ?? null,
        relevance_score: r.relevance_score,
        created_at: r.created_at,
      })
    );

    signals.sort(compareSignals);
    const limited = signals.slice(0, 3);

    const res = NextResponse.json({
      ok: true,
      supported: true,
      signals: limited,
    });
    applySupabaseCookies(res, pendingCookies);
    return res;
  } catch (err) {
    console.error("GET /api/cockpit/regulatory-radar failed:", err);
    const res = NextResponse.json({
      ok: true,
      supported: false,
      signals: [],
      reasons: ["unexpected_error"],
    });
    applySupabaseCookies(res, pendingCookies);
    return res;
  }
}
