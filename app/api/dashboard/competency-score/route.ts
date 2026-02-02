/**
 * GET /api/dashboard/competency-score — team competency score and breakdown for dashboard card.
 * Session-scoped. Returns { ok: true, overallScore, grade, safetyPct, technicalPct, compliancePct }.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseServerClient, applySupabaseCookies } from "@/lib/supabase/server";
import { getActiveOrgFromSession } from "@/lib/server/activeOrg";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function errorPayload(step: string, error: unknown) {
  const msg = error instanceof Error ? error.message : String(error);
  return { ok: false as const, step, error: msg };
}

function pct(valid: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((valid / total) * 100);
}

function grade(score: number): string {
  if (score >= 90) return "A+";
  if (score >= 80) return "A";
  if (score >= 70) return "B";
  if (score >= 60) return "C";
  if (score >= 50) return "D";
  return "F";
}

export async function GET(request: NextRequest) {
  const { supabase, pendingCookies } = await createSupabaseServerClient();
  const org = await getActiveOrgFromSession(request, supabase);
  if (!org.ok) {
    const res = NextResponse.json(errorPayload("getActiveOrg", org.error), { status: org.status });
    applySupabaseCookies(res, pendingCookies);
    return res;
  }

  try {
    const orgId = org.activeOrgId;

    const { data: employees } = await supabaseAdmin
      .from("employees")
      .select("id")
      .eq("org_id", orgId)
      .eq("is_active", true);
    const empList = employees ?? [];

    const { data: catalog } = await supabaseAdmin
      .from("compliance_catalog")
      .select("id, category")
      .eq("org_id", orgId)
      .eq("is_active", true);
    const catalogList = catalog ?? [];

    const { data: assigned } = await supabaseAdmin
      .from("employee_compliance")
      .select("employee_id, compliance_id, valid_to, waived")
      .eq("org_id", orgId);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const days30 = new Date(today);
    days30.setDate(days30.getDate() + 30);

    const kpis: Record<string, { valid: number; total: number }> = {
      license: { valid: 0, total: 0 },
      medical: { valid: 0, total: 0 },
      contract: { valid: 0, total: 0 },
    };

    for (const c of catalogList) {
      const cat = c.category as "license" | "medical" | "contract";
      if (!kpis[cat]) continue;
      kpis[cat].total += empList.length;
    }

    for (const a of assigned ?? []) {
      const catalogRow = catalogList.find((x) => x.id === a.compliance_id);
      if (!catalogRow) continue;
      const cat = catalogRow.category as "license" | "medical" | "contract";
      if (!kpis[cat]) continue;
      const validTo = a.valid_to ?? null;
      const waived = a.waived ?? false;
      if (waived) {
        kpis[cat].valid++;
        continue;
      }
      if (!validTo) continue;
      const to = new Date(validTo);
      to.setHours(0, 0, 0, 0);
      if (to >= today) kpis[cat].valid++;
    }

    const licenseTotal = kpis.license.total;
    const licenseValid = kpis.license.valid;
    const medicalTotal = kpis.medical.total;
    const medicalValid = kpis.medical.valid;
    const contractTotal = kpis.contract.total;
    const contractValid = kpis.contract.valid;

    const safetyPct = licenseTotal > 0 ? pct(licenseValid, licenseTotal) : 0;
    const complianceTotal = medicalTotal + contractTotal;
    const complianceValid = medicalValid + contractValid;
    const compliancePct = complianceTotal > 0 ? pct(complianceValid, complianceTotal) : 0;
    const technicalPct = Math.round((safetyPct + compliancePct) / 2);

    const overallScore = Math.round((safetyPct + technicalPct + compliancePct) / 3);
    const res = NextResponse.json({
      ok: true,
      overallScore: Math.min(100, overallScore),
      grade: grade(Math.min(100, overallScore)),
      safetyPct,
      technicalPct,
      compliancePct,
    });
    applySupabaseCookies(res, pendingCookies);
    return res;
  } catch (err) {
    console.error("GET /api/dashboard/competency-score failed:", err);
    const res = NextResponse.json(errorPayload("unexpected", err), { status: 500 });
    applySupabaseCookies(res, pendingCookies);
    return res;
  }
}
