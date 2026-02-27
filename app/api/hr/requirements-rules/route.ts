/**
 * GET /api/hr/requirements-rules — list role→requirement rules for the org.
 * POST /api/hr/requirements-rules — create a rule via create_requirement_rule_v1 (atomic rule + governance).
 * Auth: requireAdminOrHr. Tenant: activeOrgId.
 */
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient, applySupabaseCookies } from "@/lib/supabase/server";
import { requireAdminOrHr } from "@/lib/server/requireAdminOrHr";

export type RequirementRuleRow = {
  id: string;
  role: string;
  requirement_code: string;
  requirement_name: string;
  is_mandatory: boolean;
  created_at: string;
};

export async function GET(request: NextRequest) {
  const { supabase, pendingCookies } = await createSupabaseServerClient(request);
  const auth = await requireAdminOrHr(request, supabase);
  if (!auth.ok) {
    const res = NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
    applySupabaseCookies(res, pendingCookies);
    return res;
  }

  try {
    const { data: rows, error } = await supabase
      .from("requirement_role_rules")
      .select("id, role, requirement_code, requirement_name, is_mandatory, created_at")
      .eq("org_id", auth.activeOrgId)
      .order("role", { ascending: true })
      .order("requirement_code", { ascending: true });

    if (error) {
      console.error("[hr/requirements-rules] list error", error);
      const res = NextResponse.json(
        { ok: false, error: "Failed to load rules" },
        { status: 500 }
      );
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const rules: RequirementRuleRow[] = (rows ?? []).map(
      (r: {
        id: string;
        role: string;
        requirement_code: string;
        requirement_name: string;
        is_mandatory: boolean;
        created_at: string;
      }) => ({
        id: r.id,
        role: r.role,
        requirement_code: r.requirement_code,
        requirement_name: r.requirement_name,
        is_mandatory: r.is_mandatory,
        created_at: r.created_at,
      })
    );

    const res = NextResponse.json({ ok: true, rules });
    applySupabaseCookies(res, pendingCookies);
    return res;
  } catch (err) {
    console.error("[hr/requirements-rules] unexpected error", err);
    const res = NextResponse.json(
      { ok: false, error: "Internal error" },
      { status: 500 }
    );
    applySupabaseCookies(res, pendingCookies);
    return res;
  }
}

export async function POST(request: NextRequest) {
  const { supabase, pendingCookies } = await createSupabaseServerClient(request);
  const auth = await requireAdminOrHr(request, supabase);
  if (!auth.ok) {
    const res = NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
    applySupabaseCookies(res, pendingCookies);
    return res;
  }

  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) ?? {};
  } catch {
    const res = NextResponse.json(
      { ok: false, error: "Invalid JSON body" },
      { status: 400 }
    );
    applySupabaseCookies(res, pendingCookies);
    return res;
  }

  const role = typeof body.role === "string" ? body.role.trim() : "";
  const requirement_code = typeof body.requirement_code === "string" ? body.requirement_code.trim() : "";
  const requirement_name = typeof body.requirement_name === "string" ? body.requirement_name.trim() : "";
  const is_mandatory = body.is_mandatory === false ? false : true;

  if (!role || !requirement_code || !requirement_name) {
    const res = NextResponse.json(
      { ok: false, error: "role, requirement_code, and requirement_name are required and non-empty" },
      { status: 400 }
    );
    applySupabaseCookies(res, pendingCookies);
    return res;
  }

  try {
    const { data: rpcData, error } = await supabase.rpc("create_requirement_rule_v1", {
      p_org_id: auth.activeOrgId,
      p_role: role,
      p_requirement_code: requirement_code,
      p_requirement_name: requirement_name,
      p_is_mandatory: is_mandatory,
      p_idempotency_key: null,
    });

    if (error) {
      if (error.code === "P0001") {
        const res = NextResponse.json(
          { ok: false, error: "Org mismatch" },
          { status: 403 }
        );
        applySupabaseCookies(res, pendingCookies);
        return res;
      }
      if (error.code === "23505") {
        const res = NextResponse.json(
          { ok: false, error: "A rule for this role and requirement already exists" },
          { status: 409 }
        );
        applySupabaseCookies(res, pendingCookies);
        return res;
      }
      console.error("[hr/requirements-rules] create_requirement_rule_v1 error", error);
      const res = NextResponse.json(
        { ok: false, error: error.message || "Failed to create rule" },
        { status: 500 }
      );
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const ruleId = rpcData?.rule_id;
    if (!ruleId) {
      const res = NextResponse.json(
        { ok: false, error: "Create succeeded but no rule_id returned" },
        { status: 500 }
      );
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const { data: row, error: fetchError } = await supabase
      .from("requirement_role_rules")
      .select("id, role, requirement_code, requirement_name, is_mandatory, created_at")
      .eq("id", ruleId)
      .single();

    if (fetchError || !row) {
      console.error("[hr/requirements-rules] fetch after create", fetchError);
      const res = NextResponse.json(
        { ok: false, error: "Rule created but could not load" },
        { status: 500 }
      );
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const rule: RequirementRuleRow = {
      id: row.id,
      role: row.role,
      requirement_code: row.requirement_code,
      requirement_name: row.requirement_name,
      is_mandatory: row.is_mandatory,
      created_at: row.created_at,
    };

    const res = NextResponse.json({ ok: true, rule });
    applySupabaseCookies(res, pendingCookies);
    return res;
  } catch (err) {
    console.error("[hr/requirements-rules] unexpected error", err);
    const res = NextResponse.json(
      { ok: false, error: "Internal error" },
      { status: 500 }
    );
    applySupabaseCookies(res, pendingCookies);
    return res;
  }
}
