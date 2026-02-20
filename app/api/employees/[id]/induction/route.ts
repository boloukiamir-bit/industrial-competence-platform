/**
 * GET /api/employees/[id]/induction — employee induction status/progress.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseServerClient, applySupabaseCookies } from "@/lib/supabase/server";
import { getActiveOrgFromSession } from "@/lib/server/activeOrg";
import { getEmployeeInduction } from "@/lib/server/induction/inductionService";

function errorPayload(step: string, error: unknown) {
  const msg = error instanceof Error ? error.message : String(error);
  return { ok: false as const, step, error: msg };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { supabase, pendingCookies } = await createSupabaseServerClient(request);
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
  const { id } = await params;
  if (!id) {
    const res = NextResponse.json(errorPayload("validation", "Employee id required"), { status: 400 });
    applySupabaseCookies(res, pendingCookies);
    return res;
  }
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  const result = await getEmployeeInduction(admin, {
    orgId: org.activeOrgId,
    siteId: org.activeSiteId ?? null,
    employeeId: id,
  });
  const res = NextResponse.json({ ok: true, induction: result });
  applySupabaseCookies(res, pendingCookies);
  return res;
}
