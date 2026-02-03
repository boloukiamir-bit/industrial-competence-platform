/**
 * GET /api/compliance/actions?employeeId=... — list open + done actions for that employee. Org/site scoped.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseServerClient, applySupabaseCookies } from "@/lib/supabase/server";
import { getActiveOrgFromSession } from "@/lib/server/activeOrg";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function errorPayload(step: string, error: unknown, details?: string) {
  const msg = error instanceof Error ? error.message : String(error);
  return { ok: false as const, step, error: msg, ...(details != null && { details }) };
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
  const employeeId = searchParams.get("employeeId")?.trim() || null;
  if (!employeeId) {
    const res = NextResponse.json(errorPayload("validation", "employeeId is required"), { status: 400 });
    applySupabaseCookies(res, pendingCookies);
    return res;
  }

  try {
    let query = supabaseAdmin
      .from("compliance_actions")
      .select(
        "id, employee_id, compliance_id, action_type, status, due_date, notes, created_at"
      )
      .eq("org_id", org.activeOrgId)
      .eq("employee_id", employeeId)
      .in("status", ["open", "done"])
      .order("created_at", { ascending: false });

    if (org.activeSiteId) {
      query = query.eq("site_id", org.activeSiteId);
    }

    const { data: rows, error } = await query;

    if (error) {
      console.error("compliance/actions list", error);
      const res = NextResponse.json(errorPayload("list", error.message), { status: 500 });
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const catalogIds = [...new Set((rows ?? []).map((r: { compliance_id: string }) => r.compliance_id))];
    const { data: catalogRows } = catalogIds.length
      ? await supabaseAdmin
          .from("compliance_catalog")
          .select("id, code, name")
          .in("id", catalogIds)
      : { data: [] as { id: string; code: string; name: string }[] };
    const catalogMap = new Map(
      (catalogRows ?? []).map((c) => [c.id, { code: c.code, name: c.name }])
    );

    const actions = (rows ?? []).map((r: Record<string, unknown>) => {
      const cat = catalogMap.get(r.compliance_id as string);
      return {
        id: r.id,
        employee_id: r.employee_id,
        compliance_id: r.compliance_id,
        action_type: r.action_type,
        status: r.status,
        due_date: r.due_date ?? null,
        notes: r.notes ?? null,
        created_at: r.created_at,
        compliance_code: cat?.code ?? null,
        compliance_name: cat?.name ?? null,
      };
    });

    const res = NextResponse.json({ ok: true, actions });
    applySupabaseCookies(res, pendingCookies);
    return res;
  } catch (err) {
    console.error("GET /api/compliance/actions failed:", err);
    const res = NextResponse.json(errorPayload("unexpected", err), { status: 500 });
    applySupabaseCookies(res, pendingCookies);
    return res;
  }
}
