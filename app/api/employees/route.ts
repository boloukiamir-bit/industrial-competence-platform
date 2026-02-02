import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db/pool";
import { getActiveOrgFromSession } from "@/lib/server/activeOrg";
import {
  buildEmployeeScope,
  getEmployeeScopeSqlParams,
  EMPLOYEE_SCOPE_SITE_FRAGMENT,
} from "@/lib/server/employeeScope";
import { createSupabaseServerClient, applySupabaseCookies } from "@/lib/supabase/server";

export const runtime = "nodejs";

const SPALJISTEN_ORG_ID = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";

/**
 * GET /api/employees — tenant-scoped by session (active_org_id),
 * optionally filtered by active_site_id when present. Uses shared employee scope so count matches Org Overview.
 */
export async function GET(request: NextRequest) {
  try {
    const { supabase, pendingCookies } = await createSupabaseServerClient();
    const org = await getActiveOrgFromSession(request, supabase);
    if (!org.ok) {
      const res = NextResponse.json({ error: org.error }, { status: org.status });
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const scope = buildEmployeeScope({
      orgId: org.activeOrgId,
      activeSiteId: org.activeSiteId ?? null,
    });
    const [orgId, activeSiteId] = getEmployeeScopeSqlParams(scope);

    const result = await pool.query(
      `SELECT id, name, first_name, last_name, employee_number, email, phone, date_of_birth,
              role, line, team, employment_type, start_date, contract_end_date, manager_id,
              address, city, postal_code, country, is_active
       FROM employees 
       WHERE org_id = $1
         AND is_active = true
         AND ${EMPLOYEE_SCOPE_SITE_FRAGMENT}
       ORDER BY name 
       LIMIT 500`,
      [orgId, activeSiteId]
    );

    if (result.rows.length === 0 && org.activeOrgId === SPALJISTEN_ORG_ID) {
      const spResult = await pool.query(
        `SELECT id, employee_name as name, email 
         FROM sp_employees 
         WHERE org_id = $1 
         ORDER BY employee_name 
         LIMIT 100`,
        [org.activeOrgId]
      );
      const res = NextResponse.json({ employees: spResult.rows });
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const employees = result.rows.map((row) => ({
      id: row.id,
      name: row.name ?? "",
      firstName: row.first_name ?? undefined,
      lastName: row.last_name ?? undefined,
      employeeNumber: row.employee_number ?? "",
      email: row.email ?? undefined,
      phone: row.phone ?? undefined,
      dateOfBirth: row.date_of_birth ?? undefined,
      role: row.role ?? "",
      line: row.line ?? "",
      team: row.team ?? "",
      employmentType: row.employment_type ?? "permanent",
      startDate: row.start_date ?? undefined,
      contractEndDate: row.contract_end_date ?? undefined,
      managerId: row.manager_id ?? undefined,
      address: row.address ?? undefined,
      city: row.city ?? undefined,
      postalCode: row.postal_code ?? undefined,
      country: row.country ?? "Sweden",
      isActive: row.is_active ?? true,
    }));
    const res = NextResponse.json({ employees });
    applySupabaseCookies(res, pendingCookies);
    return res;
  } catch (err) {
    console.error("GET /api/employees failed:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
