/**
 * GET /api/cockpit/executive-kpis — Executive KPI row: Overall % + Grade (A–H) + pillars (Safety, Technical, Compliance).
 * Auth/org: getActiveOrgFromSession (same as cockpit). Deterministic: missing sources => supported=false, clean empty state.
 */
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient, applySupabaseCookies } from "@/lib/supabase/server";
import { getActiveOrgFromSession } from "@/lib/server/activeOrg";

function errorPayload(step: string, error: unknown) {
  const msg = error instanceof Error ? error.message : String(error);
  return { ok: false as const, step, error: msg };
}

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

  try {
    const baseUrl = request.nextUrl.origin;
    const cookieHeader = request.headers.get("cookie") ?? "";

    // Compliance pillar: from overview (healthy / (healthy + legal_stoppers + expiring_soon))
    const overviewRes = await fetch(`${baseUrl}/api/compliance/overview`, {
      headers: { cookie: cookieHeader },
    });
    const overviewJson = (await overviewRes.json()) as {
      ok?: boolean;
      kpis?: {
        healthy?: { total_items?: number };
        legal_stoppers?: { total_items?: number };
        expiring_soon?: { total_items?: number };
      };
      error?: string;
    };
    if (overviewRes.ok && overviewJson.ok && overviewJson.kpis) {
      const healthy = overviewJson.kpis.healthy?.total_items ?? 0;
      const legal = overviewJson.kpis.legal_stoppers?.total_items ?? 0;
      const expiring = overviewJson.kpis.expiring_soon?.total_items ?? 0;
      const denom = healthy + legal + expiring;
      if (denom > 0) {
        compliancePct = Math.round((100 * healthy) / denom);
        compliancePct = Math.max(0, Math.min(100, compliancePct));
      } else {
        reasons.push("compliance_denominator_zero");
      }
    } else {
      reasons.push("compliance_overview_unavailable");
    }

    // Safety + Technical: from dashboard competency-score
    const scoreRes = await fetch(`${baseUrl}/api/dashboard/competency-score`, {
      headers: { cookie: cookieHeader },
    });
    const scoreJson = (await scoreRes.json()) as {
      ok?: boolean;
      safetyPct?: number;
      technicalPct?: number;
      error?: string;
    };
    if (scoreRes.ok && scoreJson.ok) {
      if (typeof scoreJson.safetyPct === "number") safetyPct = Math.max(0, Math.min(100, Math.round(scoreJson.safetyPct)));
      else reasons.push("missing_safety_source");
      if (typeof scoreJson.technicalPct === "number") technicalPct = Math.max(0, Math.min(100, Math.round(scoreJson.technicalPct)));
      else reasons.push("missing_technical_source");
    } else {
      if (safetyPct === null) reasons.push("missing_safety_source");
      if (technicalPct === null) reasons.push("missing_technical_source");
    }

    const allPillarsAvailable =
      compliancePct !== null && safetyPct !== null && technicalPct !== null;
    const overallPercent = allPillarsAvailable
      ? Math.round((compliancePct! + safetyPct! + technicalPct!) / 3)
      : compliancePct !== null
        ? compliancePct
        : 0;
    const clampedOverall = Math.max(0, Math.min(100, overallPercent));
    const grade = gradeFromPercent(clampedOverall);
    const supported = allPillarsAvailable;

    const res = NextResponse.json({
      ok: true,
      overall_percent: clampedOverall,
      grade,
      pillars: {
        safety: safetyPct ?? 0,
        technical: technicalPct ?? 0,
        compliance: compliancePct ?? 0,
      },
      supported,
      ...(reasons.length > 0 && { reasons }),
      ...(process.env.NODE_ENV !== "production" && {
        _debug: { compliancePct, safetyPct, technicalPct, reasons },
      }),
    });
    applySupabaseCookies(res, pendingCookies);
    return res;
  } catch (err) {
    console.error("GET /api/cockpit/executive-kpis failed:", err);
    const res = NextResponse.json(
      {
        ok: true,
        overall_percent: 0,
        grade: "H" as const,
        pillars: { safety: 0, technical: 0, compliance: 0 },
        supported: false,
        reasons: ["unexpected_error"],
        ...(process.env.NODE_ENV !== "production" && { _debug: String(err) }),
      },
      { status: 200 }
    );
    applySupabaseCookies(res, pendingCookies);
    return res;
  }
}
