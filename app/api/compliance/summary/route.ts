/**
 * GET /api/compliance/summary — executive view: risk + expirations + actions.
 * Admin/HR only. Tenant: getActiveOrgFromSession. Site: strict when activeSiteId set.
 *
 * Query: asOf, expiringDays, category, line, q, limitUpcoming
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseServerClient, applySupabaseCookies } from "@/lib/supabase/server";
import { getActiveOrgFromSession } from "@/lib/server/activeOrg";
import { getActiveSiteName } from "@/lib/server/siteName";
import { normalizeProfileActiveSiteIfStale } from "@/lib/server/validateActiveSite";
import { isHrAdmin } from "@/lib/auth";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const CATEGORIES = ["license", "medical", "contract"] as const;

function errorPayload(step: string, error: unknown, details?: string) {
  const msg = error instanceof Error ? error.message : String(error);
  return { ok: false as const, step, error: msg, ...(details != null && { details }) };
}

type CellStatus = "missing" | "overdue" | "expiring" | "valid" | "waived";

function computeStatus(
  validTo: string | null,
  waived: boolean,
  asOf: Date,
  expiringDays: number
): CellStatus {
  if (waived) return "waived";
  if (!validTo) return "missing";
  const to = new Date(validTo);
  to.setHours(0, 0, 0, 0);
  const asOfNorm = new Date(asOf);
  asOfNorm.setHours(0, 0, 0, 0);
  const expiringEnd = new Date(asOfNorm);
  expiringEnd.setDate(expiringEnd.getDate() + expiringDays);
  if (to < asOfNorm) return "overdue";
  if (to <= expiringEnd) return "expiring";
  return "valid";
}

function daysLeft(validTo: string | null, asOf: Date): number | null {
  if (!validTo) return null;
  const to = new Date(validTo);
  to.setHours(0, 0, 0, 0);
  const a = new Date(asOf);
  a.setHours(0, 0, 0, 0);
  return Math.ceil((to.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
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

  if (!isHrAdmin(membership?.role)) {
    const res = NextResponse.json(errorPayload("forbidden", "Admin/HR only"), { status: 403 });
    applySupabaseCookies(res, pendingCookies);
    return res;
  }

  const { searchParams } = new URL(request.url);
  const asOfParam = searchParams.get("asOf")?.trim() || null;
  const expiringDaysParam = searchParams.get("expiringDays");
  const expiringDays = Number.isFinite(parseInt(expiringDaysParam ?? "", 10))
    ? Math.max(0, parseInt(expiringDaysParam!, 10))
    : 30;
  const categoryParam = (searchParams.get("category")?.trim() || "all") as "all" | "license" | "medical" | "contract";
  const line = searchParams.get("line")?.trim() || null;
  const q = searchParams.get("q")?.trim() || null;
  const limitUpcomingParam = searchParams.get("limitUpcoming");
  const limitUpcoming = Number.isFinite(parseInt(limitUpcomingParam ?? "", 10))
    ? Math.min(100, Math.max(1, parseInt(limitUpcomingParam!, 10)))
    : 50;

  const asOf = asOfParam
    ? (() => {
        const d = new Date(asOfParam);
        return isNaN(d.getTime()) ? new Date() : d;
      })()
    : new Date();
  asOf.setHours(0, 0, 0, 0);
  const asOfStr = asOf.toISOString().slice(0, 10);

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

    // 1) Employees in scope
    let empQ = supabaseAdmin
      .from("employees")
      .select("id, name, first_name, last_name, employee_number, line, site_id")
      .eq("org_id", orgId)
      .eq("is_active", true);
    if (activeSiteId) empQ = empQ.eq("site_id", activeSiteId);
    if (line) empQ = empQ.eq("line", line);
    const { data: empRows, error: empErr } = await empQ.order("name");

    if (empErr) {
      console.error("compliance/summary employees", empErr);
      const res = NextResponse.json(errorPayload("employees", empErr.message), { status: 500 });
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const empList = empRows ?? [];
    const qLower = q ? q.toLowerCase() : "";
    const employeesInScope = qLower
      ? empList.filter((e) => {
          const name = (e.name ?? [e.first_name, e.last_name].filter(Boolean).join(" ") ?? "").toLowerCase();
          const num = (e.employee_number ?? "").toLowerCase();
          return name.includes(qLower) || num.includes(qLower);
        })
      : empList;

    const empIds = new Set(employeesInScope.map((e) => e.id));
    const totalEmployeesInScope = empIds.size;

    // 2) Catalog
    let catQ = supabaseAdmin
      .from("compliance_catalog")
      .select("id, category, code, name")
      .eq("org_id", orgId)
      .eq("is_active", true);
    if (categoryParam !== "all") catQ = catQ.eq("category", categoryParam);
    const { data: catalog, error: catErr } = await catQ.order("category").order("code");

    if (catErr) {
      console.error("compliance/summary catalog", catErr);
      const res = NextResponse.json(errorPayload("catalog", catErr.message), { status: 500 });
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const catalogList = catalog ?? [];

    // 3) Employee compliance (org-wide; filter by empIds)
    const { data: assigned, error: assErr } = await supabaseAdmin
      .from("employee_compliance")
      .select("employee_id, compliance_id, valid_to, waived")
      .eq("org_id", orgId);

    if (assErr) {
      console.error("compliance/summary assigned", assErr);
      const res = NextResponse.json(errorPayload("assigned", assErr.message), { status: 500 });
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const assignedMap = new Map<string, { valid_to: string | null; waived: boolean }>();
    for (const a of assigned ?? []) {
      if (empIds.has(a.employee_id)) {
        assignedMap.set(`${a.employee_id}:${a.compliance_id}`, {
          valid_to: a.valid_to ?? null,
          waived: a.waived ?? false,
        });
      }
    }

    const catalogMap = new Map(catalogList.map((c) => [c.id, c]));
    const empMap = new Map(
      employeesInScope.map((e) => [
        e.id,
        {
          name: e.name ?? [e.first_name, e.last_name].filter(Boolean).join(" ") ?? "—",
          employee_number: e.employee_number ?? null,
          line: e.line ?? null,
          site_id: e.site_id ?? null,
        },
      ])
    );

    // Compute per-employee per-compliance status
    const employeesWithMissing = new Set<string>();
    const employeesWithOverdue = new Set<string>();
    const employeesWithExpiring = new Set<string>();
    const itemCounts = new Map<
      string,
      { code: string; name: string; category: string; missing: number; overdue: number; expiring: number }
    >();
    const upcoming: Array<{
      employee_id: string;
      employee_name: string;
      employee_number: string | null;
      employee_line: string | null;
      employee_site_id: string | null;
      compliance_code: string;
      compliance_name: string;
      category: string;
      valid_to: string;
      days_left: number;
    }> = [];

    for (const emp of employeesInScope) {
      for (const c of catalogList) {
        const key = `${emp.id}:${c.id}`;
        const a = assignedMap.get(key);
        const validTo = a?.valid_to ?? null;
        const waived = a?.waived ?? false;
        const status = a ? computeStatus(validTo, waived, asOf, expiringDays) : "missing";
        const dl = validTo ? daysLeft(validTo, asOf) : null;

        if (status === "missing") employeesWithMissing.add(emp.id);
        else if (status === "overdue") employeesWithOverdue.add(emp.id);
        else if (status === "expiring") {
          employeesWithExpiring.add(emp.id);
          if (validTo && dl != null && dl >= 0) {
            upcoming.push({
              employee_id: emp.id,
              employee_name: empMap.get(emp.id)!.name,
              employee_number: empMap.get(emp.id)!.employee_number,
              employee_line: empMap.get(emp.id)!.line,
              employee_site_id: empMap.get(emp.id)!.site_id,
              compliance_code: c.code,
              compliance_name: c.name,
              category: c.category,
              valid_to: validTo,
              days_left: dl,
            });
          }
        }

        const itemKey = c.id;
        if (!itemCounts.has(itemKey)) {
          itemCounts.set(itemKey, {
            code: c.code,
            name: c.name,
            category: c.category,
            missing: 0,
            overdue: 0,
            expiring: 0,
          });
        }
        const counts = itemCounts.get(itemKey)!;
        if (status === "missing") counts.missing++;
        else if (status === "overdue") counts.overdue++;
        else if (status === "expiring") counts.expiring++;
      }
    }

    const employeesWithAnyIssue = new Set([
      ...employeesWithMissing,
      ...employeesWithOverdue,
      ...employeesWithExpiring,
    ]);

    upcoming.sort((a, b) => a.days_left - b.days_left);
    const upcomingList = upcoming.slice(0, limitUpcoming);

    const topRiskItems = [...itemCounts.values()]
      .filter((r) => r.missing + r.overdue + r.expiring > 0)
      .map((r) => ({
        compliance_code: r.code,
        compliance_name: r.name,
        category: r.category,
        missingCount: r.missing,
        overdueCount: r.overdue,
        expiringCount: r.expiring,
        affectedEmployees: r.missing + r.overdue + r.expiring,
      }))
      .sort((a, b) => {
        if (b.affectedEmployees !== a.affectedEmployees) return b.affectedEmployees - a.affectedEmployees;
        return b.overdueCount - a.overdueCount;
      })
      .slice(0, 10);

    // 4) Actions snapshot
    let actionsQ = supabaseAdmin
      .from("compliance_actions")
      .select("id, status, due_date, done_at, employee_id, compliance_id, action_type, owner_user_id, created_at")
      .eq("org_id", orgId);
    if (activeSiteId) actionsQ = actionsQ.eq("site_id", activeSiteId);
    const { data: actionRows } = await actionsQ;

    const actions = actionRows ?? [];
    const openActions = actions.filter((r: { status: string }) => r.status === "open");
    const openActionsCount = openActions.length;
    const overdueActionsCount = openActions.filter(
      (r: { due_date: string | null }) => r.due_date && r.due_date < asOfStr
    ).length;
    const in7 = new Date(asOf);
    in7.setDate(in7.getDate() + 7);
    const in7Str = in7.toISOString().slice(0, 10);
    const due7dActionsCount = openActions.filter(
      (r: { due_date: string | null }) =>
        r.due_date && r.due_date >= asOfStr && r.due_date <= in7Str
    ).length;
    const weekAgoMs = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const recentDoneActionsCount = actions.filter((r: { status: string; done_at: string | null }) => {
      if (r.status !== "done" || !r.done_at) return false;
      return new Date(r.done_at).getTime() >= weekAgoMs;
    }).length;

    const openActionsList = openActions
      .slice(0, 20)
      .map((a: Record<string, unknown>) => ({
        id: a.id,
        employee_id: a.employee_id,
        compliance_id: a.compliance_id,
        action_type: a.action_type,
        due_date: a.due_date ?? null,
        owner_user_id: a.owner_user_id ?? null,
        created_at: a.created_at,
      }));

    const linesList = [...new Set(employeesInScope.map((e) => e.line).filter((v): v is string => Boolean(v)))].sort();

    const res = NextResponse.json({
      ok: true,
      context: {
        activeSiteId,
        activeSiteName,
        asOf: asOfStr,
        expiringDays,
        category: categoryParam,
      },
      lines: linesList,
      kpis: {
        employeesWithMissing: employeesWithMissing.size,
        employeesWithOverdue: employeesWithOverdue.size,
        employeesWithExpiring: employeesWithExpiring.size,
        employeesWithAnyIssue: employeesWithAnyIssue.size,
        totalEmployeesInScope,
      },
      topRiskItems,
      upcomingExpirations: upcomingList,
      actionsSnapshot: {
        openActionsCount,
        overdueActionsCount,
        due7dActionsCount,
        recentDoneActionsCount,
        openActions: openActionsList,
      },
    });
    applySupabaseCookies(res, pendingCookies);
    return res;
  } catch (err) {
    console.error("GET /api/compliance/summary failed:", err);
    const res = NextResponse.json(errorPayload("unexpected", err), { status: 500 });
    applySupabaseCookies(res, pendingCookies);
    return res;
  }
}
