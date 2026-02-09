/**
 * GET /api/employees/[id] — tenant-scoped by session (active_org_id).
 * PATCH /api/employees/[id] — update employee (e.g. is_active). Tenant-scoped.
 *
 * Curl examples (replace BASE_URL, TOKEN, EMPLOYEE_UUID):
 *   1) GET employee detail (tenant-scoped):
 *      curl -s -H "Authorization: Bearer TOKEN" -H "Cookie: sb-*-auth-token=..." "BASE_URL/api/employees/EMPLOYEE_UUID"
 *      Or with Bearer only (if API accepts it): curl -s -H "Authorization: Bearer TOKEN" "BASE_URL/api/employees/EMPLOYEE_UUID"
 *   2) PATCH deactivate:
 *      curl -s -X PATCH -H "Authorization: Bearer TOKEN" -H "Content-Type: application/json" -d '{"is_active":false}' "BASE_URL/api/employees/EMPLOYEE_UUID"
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getActiveOrgFromSession } from "@/lib/server/activeOrg";
import { requireAdminOrHr } from "@/lib/server/requireAdminOrHr";
import { createSupabaseServerClient, applySupabaseCookies } from "@/lib/supabase/server";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function toEmployeeDto(row: Record<string, unknown> & { manager?: { name: string } | null }) {
  return {
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
    lineCode: (row.line_code ?? row.line) ?? "",
    team: row.team ?? "",
    employmentType: row.employment_type ?? "permanent",
    startDate: row.start_date ?? undefined,
    contractEndDate: row.contract_end_date ?? undefined,
    managerId: row.manager_id ?? undefined,
    managerName: (row.manager as { name?: string } | null)?.name ?? undefined,
    positionId: row.position_id ?? undefined,
    address: row.address ?? undefined,
    city: row.city ?? undefined,
    postalCode: row.postal_code ?? undefined,
    country: row.country ?? "Sweden",
    isActive: row.is_active ?? true,
    orgId: row.org_id,
  };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: "Employee id required" }, { status: 400 });
    }

    const { supabase, pendingCookies } = await createSupabaseServerClient();
    const org = await getActiveOrgFromSession(request, supabase);
    if (!org.ok) {
      const res = NextResponse.json({ error: org.error }, { status: org.status });
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const { data, error } = await supabaseAdmin
      .from("employees")
      .select("*")
      .eq("id", id)
      .eq("org_id", org.activeOrgId)
      .maybeSingle();

    if (error) {
      console.error("[api/employees/[id]] GET error", error);
      const res = NextResponse.json({ error: "Failed to load employee" }, { status: 500 });
      applySupabaseCookies(res, pendingCookies);
      return res;
    }
    if (!data) {
      const res = NextResponse.json({ error: "Employee not found" }, { status: 404 });
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const res = NextResponse.json(toEmployeeDto(data as Record<string, unknown> & { manager?: { name: string } | null }));
    applySupabaseCookies(res, pendingCookies);
    return res;
  } catch (err) {
    console.error("[api/employees/[id]] GET", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: "Employee id required" }, { status: 400 });
    }

    const { supabase, pendingCookies } = await createSupabaseServerClient();
    const org = await getActiveOrgFromSession(request, supabase);
    if (!org.ok) {
      const res = NextResponse.json({ error: org.error }, { status: org.status });
      applySupabaseCookies(res, pendingCookies);
      return res;
    }
    const activeOrgId = org.activeOrgId;

    const body = await request.json().catch(() => ({}));
    const updates: Record<string, unknown> = {};
    if (typeof body.is_active === "boolean") updates.is_active = body.is_active;

    if (body.position_id !== undefined) {
      const auth = await requireAdminOrHr(request, supabase);
      if (!auth.ok) {
        const res = NextResponse.json({ error: auth.error }, { status: auth.status });
        applySupabaseCookies(res, pendingCookies);
        return res;
      }
      const positionId = body.position_id === null || body.position_id === "" ? null : body.position_id;
      if (positionId !== null && typeof positionId !== "string") {
        const res = NextResponse.json({ error: "position_id must be string or null" }, { status: 400 });
        applySupabaseCookies(res, pendingCookies);
        return res;
      }
      if (positionId) {
        const { data: pos } = await supabaseAdmin
          .from("positions")
          .select("id")
          .eq("id", positionId)
          .eq("org_id", activeOrgId)
          .maybeSingle();
        if (!pos) {
          const res = NextResponse.json({ error: "Position not found" }, { status: 404 });
          applySupabaseCookies(res, pendingCookies);
          return res;
        }
      }
      updates.position_id = positionId;
    }

    if (Object.keys(updates).length === 0) {
      const res = NextResponse.json({ error: "No allowed fields to update" }, { status: 400 });
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const { data, error } = await supabaseAdmin
      .from("employees")
      .update(updates)
      .eq("id", id)
      .eq("org_id", activeOrgId)
      .select("*, manager:manager_id(name)")
      .single();

    if (error) {
      console.error("[api/employees/[id]] PATCH error", error);
      const res = NextResponse.json({ error: "Failed to update employee" }, { status: 500 });
      applySupabaseCookies(res, pendingCookies);
      return res;
    }
    if (!data) {
      const res = NextResponse.json({ error: "Employee not found" }, { status: 404 });
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    if (updates.is_active === false) {
      console.log("[api/employees/[id]] deactivated", { employeeId: id, orgId: org.activeOrgId });
    }

    const res = NextResponse.json(toEmployeeDto(data as Record<string, unknown>));
    applySupabaseCookies(res, pendingCookies);
    return res;
  } catch (err) {
    console.error("[api/employees/[id]] PATCH", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
