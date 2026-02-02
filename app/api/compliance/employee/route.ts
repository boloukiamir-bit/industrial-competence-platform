/**
 * GET /api/compliance/employee?employeeId=... — all compliance items for one employee with computed status + expiry days.
 * Scope: active_org_id. Fail loud with { ok: false, step, error, details }.
 */
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient, applySupabaseCookies } from "@/lib/supabase/server";
import { getActiveOrgFromSession } from "@/lib/server/activeOrg";

function errorPayload(step: string, error: unknown, details?: string) {
  const msg = error instanceof Error ? error.message : String(error);
  return { ok: false as const, step, error: msg, ...(details != null && { details }) };
}

function computeStatus(validTo: string | null, waived: boolean): "valid" | "expiring" | "expired" | "missing" | "waived" {
  if (waived) return "waived";
  if (!validTo) return "missing";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const to = new Date(validTo);
  to.setHours(0, 0, 0, 0);
  const days30 = new Date(today);
  days30.setDate(days30.getDate() + 30);
  if (to < today) return "expired";
  if (to <= days30) return "expiring";
  return "valid";
}

function daysLeft(validTo: string | null): number | null {
  if (!validTo) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const to = new Date(validTo);
  to.setHours(0, 0, 0, 0);
  const diff = Math.ceil((to.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  return diff;
}

export async function GET(request: NextRequest) {
  const { supabase, pendingCookies } = await createSupabaseServerClient();
  const org = await getActiveOrgFromSession(request, supabase);
  if (!org.ok) {
    const res = NextResponse.json(errorPayload("getActiveOrg", org.error), { status: org.status });
    applySupabaseCookies(res, pendingCookies);
    return res;
  }

  const { searchParams } = new URL(request.url);
  const employeeId = searchParams.get("employeeId")?.trim();
  if (!employeeId) {
    const res = NextResponse.json(errorPayload("validation", "employeeId is required"), { status: 400 });
    applySupabaseCookies(res, pendingCookies);
    return res;
  }

  try {
    const [catalogRes, assignedRes] = await Promise.all([
      supabase
        .from("compliance_catalog")
        .select("id, category, code, name, description, default_validity_days")
        .eq("org_id", org.activeOrgId)
        .eq("is_active", true)
        .order("category")
        .order("code"),
      supabase
        .from("employee_compliance")
        .select("id, compliance_id, valid_from, valid_to, evidence_url, notes, waived, created_at, updated_at")
        .eq("org_id", org.activeOrgId)
        .eq("employee_id", employeeId),
    ]);

    if (catalogRes.error) {
      console.error("compliance/employee GET catalog", catalogRes.error);
      const res = NextResponse.json(errorPayload("catalog", catalogRes.error.message), { status: 500 });
      applySupabaseCookies(res, pendingCookies);
      return res;
    }
    if (assignedRes.error) {
      console.error("compliance/employee GET assigned", assignedRes.error);
      const res = NextResponse.json(errorPayload("assigned", assignedRes.error.message), { status: 500 });
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    type AssignedRow = { id: string; compliance_id: string; valid_from: string | null; valid_to: string | null; evidence_url: string | null; notes: string | null; waived: boolean; created_at: string; updated_at: string };
    type CatalogRow = { id: string; category: string; code: string; name: string; description: string | null; default_validity_days: number | null };
    const catalog: CatalogRow[] = catalogRes.data ?? [];
    const assigned = new Map<string, AssignedRow>((assignedRes.data ?? []).map((a: AssignedRow) => [a.compliance_id, a]));

    const items = catalog.map((c: CatalogRow) => {
      const a = assigned.get(c.id);
      const validTo = a?.valid_to ?? null;
      const waived = a?.waived ?? false;
      const status = a ? computeStatus(validTo, waived) : "missing";
      return {
        compliance_id: c.id,
        category: c.category,
        code: c.code,
        name: c.name,
        description: c.description ?? null,
        default_validity_days: c.default_validity_days ?? null,
        status,
        valid_from: a?.valid_from ?? null,
        valid_to: validTo,
        evidence_url: a?.evidence_url ?? null,
        notes: a?.notes ?? null,
        waived,
        days_left: validTo ? daysLeft(validTo) : null,
        employee_compliance_id: a?.id ?? null,
        created_at: a?.created_at ?? null,
        updated_at: a?.updated_at ?? null,
      };
    });

    const res = NextResponse.json({ ok: true, employeeId, items });
    applySupabaseCookies(res, pendingCookies);
    return res;
  } catch (err) {
    console.error("GET /api/compliance/employee failed:", err);
    const res = NextResponse.json(errorPayload("unexpected", err), { status: 500 });
    applySupabaseCookies(res, pendingCookies);
    return res;
  }
}
