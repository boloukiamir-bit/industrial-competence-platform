/**
 * GET /api/org/units — tenant-scoped by session (active_org_id).
 * Returns org tree + unassignedCount + totalEmployees for Overview page.
 * When active_site_id is set, employee counts are site-filtered to match Employees page.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getActiveOrgFromSession } from "@/lib/server/activeOrg";
import { createSupabaseServerClient, applySupabaseCookies } from "@/lib/supabase/server";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type OrgUnitRow = {
  id: string;
  name: string;
  code: string | null;
  parent_id: string | null;
  type: string | null;
  manager_employee_id: string | null;
  created_at: string | null;
};

type EmployeeRow = { id: string; name: string; role: string | null; org_unit_id: string | null };

export async function GET(request: NextRequest) {
  try {
    const { supabase, pendingCookies } = await createSupabaseServerClient();
    const org = await getActiveOrgFromSession(request, supabase);
    if (!org.ok) {
      const res = NextResponse.json({ error: org.error }, { status: org.status });
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const activeOrgId = org.activeOrgId;
    const activeSiteId = org.activeSiteId ?? null;

    // Org units: org_id only
    const unitsQuery = supabaseAdmin
      .from("org_units")
      .select("*")
      .eq("org_id", activeOrgId)
      .order("name");

    // Employees: org_id + is_active, optionally site_id when active_site_id is set.
    let employeesQuery = supabaseAdmin
      .from("employees")
      .select("id, name, role, org_unit_id")
      .eq("org_id", activeOrgId)
      .eq("is_active", true);
    const countRawQuery = supabaseAdmin
      .from("employees")
      .select("id", { count: "exact", head: true })
      .eq("org_id", activeOrgId)
      .eq("is_active", true);
    let countFilteredQuery = supabaseAdmin
      .from("employees")
      .select("id", { count: "exact", head: true })
      .eq("org_id", activeOrgId)
      .eq("is_active", true);

    if (activeSiteId) {
      employeesQuery = employeesQuery.eq("site_id", activeSiteId);
      countFilteredQuery = countFilteredQuery.eq("site_id", activeSiteId);
    }

    const [unitsRes, employeesRes, countRawRes, countFilteredRes] = await Promise.all([
      unitsQuery,
      employeesQuery,
      countRawQuery,
      countFilteredQuery,
    ]);

    if (unitsRes.error) {
      console.error("[api/org/units] units error", unitsRes.error);
      const res = NextResponse.json({ error: "Failed to load units" }, { status: 500 });
      applySupabaseCookies(res, pendingCookies);
      return res;
    }
    if (employeesRes.error) {
      console.error("[api/org/units] employees error", employeesRes.error);
      const res = NextResponse.json({ error: "Failed to load employees" }, { status: 500 });
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    if (countRawRes.error) {
      console.error("[api/org/units] count raw error", countRawRes.error);
    }
    if (countFilteredRes.error) {
      console.error("[api/org/units] count filtered error", countFilteredRes.error);
    }

    const units = (unitsRes.data || []) as OrgUnitRow[];
    const employees = (employeesRes.data || []) as EmployeeRow[];
    const totalEmployeesRaw = countRawRes.count ?? employees.length;
    const totalEmployeesAfterSiteFilter = countFilteredRes.count ?? employees.length;

    type Node = {
      id: string;
      name: string;
      code?: string;
      parentId?: string;
      type?: string;
      managerEmployeeId?: string;
      createdAt?: string | null;
      children: Node[];
      employees: { id: string; name: string; role: string; orgUnitId?: string; isActive: boolean }[];
      employeeCount: number;
    };

    const unitMap = new Map<string, Node>();
    units.forEach((row) => {
      unitMap.set(row.id, {
        id: row.id,
        name: row.name,
        code: row.code ?? undefined,
        parentId: row.parent_id ?? undefined,
        type: row.type ?? undefined,
        managerEmployeeId: row.manager_employee_id ?? undefined,
        createdAt: row.created_at,
        children: [],
        employees: [],
        employeeCount: 0,
      });
    });

    let unassignedCount = 0;
    employees.forEach((e) => {
      const emp = {
        id: e.id,
        name: e.name || "",
        role: e.role || "",
        orgUnitId: e.org_unit_id ?? undefined,
        isActive: true,
      };
      if (e.org_unit_id) {
        const unit = unitMap.get(e.org_unit_id);
        if (unit) {
          unit.employees.push(emp);
          unit.employeeCount += 1;
        }
      } else {
        unassignedCount++;
      }
    });

    const roots: Node[] = [];
    units.forEach((row) => {
      const node = unitMap.get(row.id)!;
      if (row.parent_id) {
        const parent = unitMap.get(row.parent_id);
        if (parent) {
          parent.children.push(node);
        } else {
          roots.push(node);
        }
      } else {
        roots.push(node);
      }
    });

    function aggregate(node: Node): number {
      let n = node.employeeCount;
      node.children.forEach((c) => (n += aggregate(c)));
      node.employeeCount = n;
      return n;
    }
    roots.forEach(aggregate);

    const res = NextResponse.json({
      tree: roots,
      unassignedCount,
      totalEmployees: totalEmployeesAfterSiteFilter,
      activeOrgId,
      meta: {
        activeOrgId,
        activeSiteId,
        totalUnitsRaw: units.length,
        rootUnitsCount: roots.length,
        totalEmployeesRaw,
        totalEmployeesAfterSiteFilter,
      },
    });
    applySupabaseCookies(res, pendingCookies);
    return res;
  } catch (err) {
    console.error("[api/org/units]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
