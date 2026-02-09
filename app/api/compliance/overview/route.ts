/**
 * GET /api/compliance/overview — KPIs (counts valid/expiring/expired/missing per category) + table rows for employees with filters.
 * Query: siteId?, category?, status?, search? (employee name/code). Fail loud with { ok: false, step, error, details }.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseServerClient, applySupabaseCookies } from "@/lib/supabase/server";
import { getActiveOrgFromSession } from "@/lib/server/activeOrg";
import { getActiveSiteName } from "@/lib/server/siteName";
import { normalizeProfileActiveSiteIfStale } from "@/lib/server/validateActiveSite";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

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
  return Math.ceil((to.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

export async function GET(request: NextRequest) {
  const { supabase, pendingCookies } = await createSupabaseServerClient();
  const org = await getActiveOrgFromSession(request, supabase);
  if (!org.ok) {
    const res = NextResponse.json(errorPayload("getActiveOrg", org.error), { status: org.status });
    applySupabaseCookies(res, pendingCookies);
    return res;
  }

  const { data: membership } = await supabase
    .from("memberships")
    .select("role")
    .eq("user_id", org.userId)
    .eq("org_id", org.activeOrgId)
    .eq("status", "active")
    .maybeSingle();
  if (!membership) {
    const res = NextResponse.json(errorPayload("forbidden", "Not an org member"), { status: 403 });
    applySupabaseCookies(res, pendingCookies);
    return res;
  }

  const { searchParams } = new URL(request.url);
  const siteId = searchParams.get("siteId")?.trim() || null;
  const category = searchParams.get("category")?.trim() || null;
  const statusFilter = searchParams.get("status")?.trim() || null;
  const search = searchParams.get("search")?.trim() || null;

  try {
    const orgId = org.activeOrgId;
    const activeSiteIdRaw = org.activeSiteId ?? null;
    const activeSiteNameRaw =
      activeSiteIdRaw != null ? await getActiveSiteName(supabaseAdmin, activeSiteIdRaw, orgId) : null;
    const { activeSiteId, activeSiteName } = await normalizeProfileActiveSiteIfStale(
      supabaseAdmin,
      org.userId,
      activeSiteIdRaw,
      activeSiteNameRaw
    );

    const employeesQuery = supabaseAdmin
      .from("employees")
      .select("id, name, first_name, last_name, employee_number, line, team, site_id")
      .eq("org_id", orgId)
      .eq("is_active", true);
    if (siteId) employeesQuery.eq("site_id", siteId);
    const { data: employees, error: empErr } = await employeesQuery.order("name");

    if (empErr) {
      console.error("compliance/overview employees", empErr);
      const res = NextResponse.json(errorPayload("employees", empErr.message), { status: 500 });
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const catalogQuery = supabaseAdmin
      .from("compliance_catalog")
      .select("id, category, code, name")
      .eq("org_id", orgId)
      .eq("is_active", true);
    if (category) catalogQuery.eq("category", category);
    const { data: catalog, error: catErr } = await catalogQuery.order("category").order("code");

    if (catErr) {
      console.error("compliance/overview catalog", catErr);
      const res = NextResponse.json(errorPayload("catalog", catErr.message), { status: 500 });
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const catalogList = catalog ?? [];
    const empList = employees ?? [];

    const { data: assigned, error: assErr } = await supabaseAdmin
      .from("employee_compliance")
      .select("employee_id, compliance_id, valid_to, waived")
      .eq("org_id", orgId);

    if (assErr) {
      console.error("compliance/overview assigned", assErr);
      const res = NextResponse.json(errorPayload("assigned", assErr.message), { status: 500 });
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const assignedMap = new Map<string, { valid_to: string | null; waived: boolean }>();
    for (const a of assigned ?? []) {
      assignedMap.set(`${a.employee_id}:${a.compliance_id}`, {
        valid_to: a.valid_to ?? null,
        waived: a.waived ?? false,
      });
    }

    const kpis: Record<string, { valid: number; expiring: number; expired: number; missing: number; waived: number }> = {
      license: { valid: 0, expiring: 0, expired: 0, missing: 0, waived: 0 },
      medical: { valid: 0, expiring: 0, expired: 0, missing: 0, waived: 0 },
      contract: { valid: 0, expiring: 0, expired: 0, missing: 0, waived: 0 },
    };

    const siteIds = [...new Set(empList.map((e) => e.site_id).filter((v): v is string => Boolean(v)))];
    const siteNameMap = new Map<string, string>();
    for (const sid of siteIds) {
      const name = await getActiveSiteName(supabaseAdmin, sid, orgId);
      siteNameMap.set(sid, name ?? "Unknown site");
    }

    const rows: Array<{
      employee_id: string;
      employee_name: string;
      employee_number: string;
      line: string | null;
      department: string | null;
      site_id: string | null;
      site_name: string;
      compliance_id: string;
      compliance_code: string;
      compliance_name: string;
      category: string;
      status: string;
      valid_to: string | null;
      days_left: number | null;
    }> = [];

    const searchLower = search ? search.toLowerCase() : "";
    for (const emp of empList) {
      const empName = emp.name ?? [emp.first_name, emp.last_name].filter(Boolean).join(" ") ?? "";
      const empCode = emp.employee_number ?? "";
      if (searchLower && !empName.toLowerCase().includes(searchLower) && !empCode.toLowerCase().includes(searchLower)) continue;

      for (const c of catalogList) {
        const key = `${emp.id}:${c.id}`;
        const a = assignedMap.get(key);
        const validTo = a?.valid_to ?? null;
        const waived = a?.waived ?? false;
        const status = a ? computeStatus(validTo, waived) : "missing";
        const days = validTo ? daysLeft(validTo) : null;

        const cat = c.category as "license" | "medical" | "contract";
        if (kpis[cat]) {
          if (status === "valid") kpis[cat].valid++;
          else if (status === "expiring") kpis[cat].expiring++;
          else if (status === "expired") kpis[cat].expired++;
          else if (status === "waived") kpis[cat].waived++;
          else kpis[cat].missing++;
        }

        if (statusFilter && status !== statusFilter) continue;

        const siteId = emp.site_id ?? null;
        rows.push({
          employee_id: emp.id,
          employee_name: empName || empCode || emp.id,
          employee_number: empCode,
          line: emp.line ?? null,
          department: emp.team ?? null,
          site_id: siteId,
          site_name: siteId ? siteNameMap.get(siteId) ?? "Unknown site" : "",
          compliance_id: c.id,
          compliance_code: c.code,
          compliance_name: c.name,
          category: c.category,
          status,
          valid_to: validTo,
          days_left: days,
        });
      }
    }

    const res = NextResponse.json({
      ok: true,
      kpis,
      rows,
      catalog: catalogList,
      activeSiteId: org.activeSiteId ?? null,
      activeSiteName,
    });
    applySupabaseCookies(res, pendingCookies);
    return res;
  } catch (err) {
    console.error("GET /api/compliance/overview failed:", err);
    const res = NextResponse.json(errorPayload("unexpected", err), { status: 500 });
    applySupabaseCookies(res, pendingCookies);
    return res;
  }
}
