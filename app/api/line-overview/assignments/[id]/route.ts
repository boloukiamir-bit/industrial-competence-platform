import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { createSupabaseServerClient, applySupabaseCookies, type CookieToSet } from "@/lib/supabase/server";
import { getActiveOrgFromSession } from "@/lib/server/activeOrg";
import { employeesBaseQuery } from "@/lib/employeesBaseQuery";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const patchSchema = z.object({
  employeeCode: z.string().optional(),
});

type ErrorPayload = { ok: false; step: string; error: string; details?: unknown };

function errorRes(payload: ErrorPayload, status: number, pendingCookies: CookieToSet[]) {
  const res = NextResponse.json(payload, { status });
  applySupabaseCookies(res, pendingCookies);
  return res;
}

/** DELETE: clear assignment (set employee_id = null, status = 'open'), keep row. Org-scoped. */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { supabase, pendingCookies } = await createSupabaseServerClient();
  const org = await getActiveOrgFromSession(request, supabase);
  if (!org.ok) {
    return errorRes({ ok: false, step: "auth", error: org.error }, org.status, pendingCookies);
  }
  const { activeOrgId, userId } = org;

  const { data: membership } = await supabaseAdmin
    .from("memberships")
    .select("role")
    .eq("org_id", activeOrgId)
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle();
  const role = membership?.role ?? "";
  if (role !== "admin" && role !== "hr") {
    return errorRes(
      { ok: false, step: "auth", error: "Admin or HR role required" },
      403,
      pendingCookies
    );
  }

  const { id } = await params;

  const { data: row, error: fetchErr } = await supabaseAdmin
    .from("shift_assignments")
    .select("id, org_id, employee_id, status")
    .eq("id", id)
    .eq("org_id", activeOrgId)
    .maybeSingle();

  if (fetchErr) {
    return errorRes(
      { ok: false, step: "fetch", error: "Failed to fetch assignment", details: fetchErr.message },
      500,
      pendingCookies
    );
  }
  if (!row) {
    return errorRes(
      { ok: false, step: "not_found", error: "Assignment not found", details: { id } },
      404,
      pendingCookies
    );
  }

  const { data: updated, error: updateErr } = await supabaseAdmin
    .from("shift_assignments")
    .update({
      employee_id: null,
      status: "open",
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("org_id", activeOrgId)
    .select()
    .single();

  if (updateErr) {
    return errorRes(
      { ok: false, step: "update", error: "Failed to unassign", details: updateErr.message },
      500,
      pendingCookies
    );
  }

  const res = NextResponse.json({ ok: true, assignment: updated });
  applySupabaseCookies(res, pendingCookies);
  return res;
}

/** PATCH: reassign to a different employee (resolve employee_id by org-scoped employee_number). Admin/HR. */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { supabase, pendingCookies } = await createSupabaseServerClient();
  const org = await getActiveOrgFromSession(request, supabase);
  if (!org.ok) {
    return errorRes({ ok: false, step: "auth", error: org.error }, org.status, pendingCookies);
  }
  const { activeOrgId, userId } = org;

  const { data: membership } = await supabaseAdmin
    .from("memberships")
    .select("role")
    .eq("org_id", activeOrgId)
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle();
  const role = membership?.role ?? "";
  if (role !== "admin" && role !== "hr") {
    return errorRes(
      { ok: false, step: "auth", error: "Admin or HR role required" },
      403,
      pendingCookies
    );
  }

  const { id } = await params;

  const body = await request.json().catch(() => ({}));
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return errorRes(
      { ok: false, step: "validation", error: "Invalid input", details: parsed.error.issues },
      400,
      pendingCookies
    );
  }

  const { data: row, error: fetchErr } = await supabaseAdmin
    .from("shift_assignments")
    .select("id, org_id, shift_id, station_id, assignment_date")
    .eq("id", id)
    .eq("org_id", activeOrgId)
    .maybeSingle();

  if (fetchErr) {
    return errorRes(
      { ok: false, step: "fetch", error: "Failed to fetch assignment", details: fetchErr.message },
      500,
      pendingCookies
    );
  }
  if (!row) {
    return errorRes(
      { ok: false, step: "not_found", error: "Assignment not found", details: { id } },
      404,
      pendingCookies
    );
  }

  const employeeCode = parsed.data.employeeCode;
  if (!employeeCode) {
    return errorRes(
      { ok: false, step: "validation", error: "employeeCode required for reassignment", details: {} },
      400,
      pendingCookies
    );
  }

  const { data: empRows, error: empErr } = await employeesBaseQuery(
    supabaseAdmin,
    activeOrgId,
    "id, employee_number"
  )
    .eq("employee_number", employeeCode)
    .limit(1);

  if (empErr) {
    return errorRes(
      { ok: false, step: "employee_lookup", error: "Employee lookup failed", details: empErr.message },
      500,
      pendingCookies
    );
  }
  const rows = empRows as unknown as { id: string; employee_number: string }[] | null;
  const emp = rows?.[0];
  if (!emp?.id) {
    return errorRes(
      { ok: false, step: "not_found", error: "Employee not found", details: { employee_number: employeeCode } },
      404,
      pendingCookies
    );
  }

  const { data: updated, error: updateErr } = await supabaseAdmin
    .from("shift_assignments")
    .update({
      employee_id: emp.id,
      status: "active",
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("org_id", activeOrgId)
    .select()
    .single();

  if (updateErr) {
    return errorRes(
      { ok: false, step: "update", error: "Failed to reassign", details: updateErr.message },
      500,
      pendingCookies
    );
  }

  const res = NextResponse.json({ ok: true, assignment: updated });
  applySupabaseCookies(res, pendingCookies);
  return res;
}
