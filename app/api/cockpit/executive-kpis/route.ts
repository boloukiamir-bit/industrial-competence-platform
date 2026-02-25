/**
 * GET /api/cockpit/executive-kpis — Executive KPI row: Overall % + Grade (A–H) + pillars (Safety, Technical, Compliance).
 * Auth/org: getActiveOrgFromSession (same as cockpit). Deterministic: missing sources => supported=false; unsupported pillars/overall/grade are null.
 * Invariant: always return 200 { ok: true, ... } for the executive-kpis payload (auth failure remains 401/403).
 */
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient, applySupabaseCookies } from "@/lib/supabase/server";
import { getActiveOrgFromSession } from "@/lib/server/activeOrg";
import { forwardAuthHeaders } from "@/lib/server/forwardAuthHeaders";

function gradeFromPercent(pct: number): "A" | "B" | "C" | "D" | "E" | "F" | "G" | "H" {
  if (pct >= 95) return "A";
  if (pct >= 90) return "B";
  if (pct >= 85) return "C";
  if (pct >= 80) return "D";
  if (pct >= 75) return "E";
  if (pct >= 70) return "F";
  if (pct >= 60) return "G";
  return "H";
}

function complianceOverviewReason(status: number): string {
  if (status === 401 || status === 403) return "compliance_overview_unauthorized";
  if (status === 404) return "compliance_overview_not_found";
  return "compliance_overview_failed";
}

function competencyScoreReason(status: number): string {
  if (status === 401 || status === 403) return "competency_score_unauthorized";
  if (status === 404) return "competency_score_not_found";
  return "competency_score_failed";
}

export async function GET(request: NextRequest) {
  const { supabase, pendingCookies } = await createSupabaseServerClient(request);
  const org = await getActiveOrgFromSession(request, supabase);
  if (!org.ok) {
    const res = NextResponse.json(
      { ok: false, error: org.error, supported: false },
      { status: org.status }
    );
    applySupabaseCookies(res, pendingCookies);
    return res;
  }

  const reasons: string[] = [];
  let compliancePct: number | null = null;
  let safetyPct: number | null = null;
  let technicalPct: number | null = null;
  let complianceStatus: number | null = null;
  let competencyStatus: number | null = null;
  let debugHealthy: number | undefined;
  let debugExpiring: number | undefined;
  let debugLegal: number | undefined;
  let debugDenom: number | undefined;

  try {
    const baseUrl = request.nextUrl.origin;
    const authHeaders = forwardAuthHeaders(request);
    const overviewUrl = `${baseUrl}/api/compliance/overview`;
    const competencyUrl = `${baseUrl}/api/dashboard/competency-score`;

    // Compliance pillar: from overview.kpis (locked model)
    const overviewRes = await fetch(overviewUrl, { headers: authHeaders });
    complianceStatus = overviewRes.status;
    if (overviewRes.ok) {
      const overviewJson = (await overviewRes.json()) as {
        ok?: boolean;
        kpis?: {
          healthy?: { total_items?: number };
          expiring_soon?: { total_items?: number };
          legal_stoppers?: { total_items?: number };
        };
      };
      const kpis = overviewJson?.kpis;
      const healthy_total = kpis?.healthy?.total_items;
      const expiring_total = kpis?.expiring_soon?.total_items;
      const legal_total = kpis?.legal_stoppers?.total_items;
      const totalsValid =
        typeof healthy_total === "number" &&
        typeof expiring_total === "number" &&
        typeof legal_total === "number";
      if (!totalsValid) {
        debugHealthy = healthy_total as number | undefined;
        debugExpiring = expiring_total as number | undefined;
        debugLegal = legal_total as number | undefined;
        reasons.push("compliance_overview_unusable_body");
      } else {
        const denom = healthy_total + expiring_total + legal_total;
        debugHealthy = healthy_total;
        debugExpiring = expiring_total;
        debugLegal = legal_total;
        debugDenom = denom;
        if (denom <= 0) {
          reasons.push("compliance_denominator_zero");
        } else {
          compliancePct = Math.round((100 * healthy_total) / denom);
          compliancePct = Math.max(0, Math.min(100, compliancePct));
        }
      }
    } else {
      reasons.push(complianceOverviewReason(overviewRes.status));
    }

    // Safety + Technical: from dashboard competency-score
    const scoreRes = await fetch(competencyUrl, { headers: authHeaders });
    competencyStatus = scoreRes.status;
    if (scoreRes.ok) {
      const scoreJson = (await scoreRes.json()) as {
        ok?: boolean;
        safetyPct?: number;
        technicalPct?: number;
      };
      if (scoreJson.ok) {
        if (typeof scoreJson.safetyPct === "number") safetyPct = Math.max(0, Math.min(100, Math.round(scoreJson.safetyPct)));
        else reasons.push("missing_safety_source");
        if (typeof scoreJson.technicalPct === "number") technicalPct = Math.max(0, Math.min(100, Math.round(scoreJson.technicalPct)));
        else reasons.push("missing_technical_source");
      } else {
        reasons.push(competencyScoreReason(scoreRes.status));
      }
    } else {
      reasons.push(competencyScoreReason(scoreRes.status));
    }

    const allPillarsAvailable =
      compliancePct !== null && safetyPct !== null && technicalPct !== null;
    const supported = allPillarsAvailable;
    const overallPercent: number | null = allPillarsAvailable
      ? Math.round((compliancePct! + safetyPct! + technicalPct!) / 3)
      : null;
    const clampedOverall = overallPercent !== null ? Math.max(0, Math.min(100, overallPercent)) : null;
    const grade: string | null = clampedOverall !== null ? gradeFromPercent(clampedOverall) : null;

    const res = NextResponse.json({
      ok: true,
      overall_percent: clampedOverall,
      grade,
      pillars: {
        safety: safetyPct,
        technical: technicalPct,
        compliance: compliancePct,
      },
      supported,
      ...(reasons.length > 0 && { reasons }),
      ...(process.env.NODE_ENV !== "production" && {
        _debug: {
          compliance: {
            status: complianceStatus,
            healthy_total: debugHealthy,
            expiring_total: debugExpiring,
            legal_total: debugLegal,
            denom: debugDenom,
          },
          competency: { status: competencyStatus },
          reasons: [...reasons],
        },
      }),
    });
    applySupabaseCookies(res, pendingCookies);
    return res;
  } catch (err) {
    console.error("GET /api/cockpit/executive-kpis failed:", err);
    const res = NextResponse.json(
      {
        ok: true,
        overall_percent: null,
        grade: null,
        pillars: { safety: null, technical: null, compliance: null },
        supported: false,
        reasons: ["unexpected_error"],
        ...(process.env.NODE_ENV !== "production" && {
          _debug: {
            compliance: { status: complianceStatus },
            competency: { status: competencyStatus },
            reasons: ["unexpected_error"],
          },
        }),
      },
      { status: 200 }
    );
    applySupabaseCookies(res, pendingCookies);
    return res;
  }
}
