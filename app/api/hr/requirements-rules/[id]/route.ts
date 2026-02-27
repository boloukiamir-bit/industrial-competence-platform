/**
 * PATCH /api/hr/requirements-rules/[id] — update is_mandatory via update_requirement_rule_v1 (atomic + governance).
 * DELETE /api/hr/requirements-rules/[id] — delete rule via delete_requirement_rule_v1 (atomic + governance).
 * Auth: requireAdminOrHr. Tenant: activeOrgId (row must belong to org).
 */
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient, applySupabaseCookies } from "@/lib/supabase/server";
import { requireAdminOrHr } from "@/lib/server/requireAdminOrHr";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { supabase, pendingCookies } = await createSupabaseServerClient(request);
  const auth = await requireAdminOrHr(request, supabase);
  if (!auth.ok) {
    const res = NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
    applySupabaseCookies(res, pendingCookies);
    return res;
  }

  const { id } = await params;
  if (!id) {
    const res = NextResponse.json({ ok: false, error: "Missing id" }, { status: 400 });
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

  const is_mandatory = body.is_mandatory === true || body.is_mandatory === false ? body.is_mandatory : undefined;
  const criticality_override =
    body.criticality_override === null || body.criticality_override === ""
      ? null
      : typeof body.criticality_override === "string" && ["CRITICAL", "HIGH", "MEDIUM", "LOW"].includes(body.criticality_override.trim())
        ? body.criticality_override.trim()
        : undefined;
  if (is_mandatory === undefined && criticality_override === undefined) {
    const res = NextResponse.json(
      { ok: false, error: "At least one of is_mandatory (boolean) or criticality_override (CRITICAL|HIGH|MEDIUM|LOW|null) is required" },
      { status: 400 }
    );
    applySupabaseCookies(res, pendingCookies);
    return res;
  }

  try {
    let final_is_mandatory = is_mandatory;
    let final_criticality_override = criticality_override;
    if (final_is_mandatory === undefined || final_criticality_override === undefined) {
      const { data: existing, error: fetchErr } = await supabase
        .from("requirement_role_rules")
        .select("is_mandatory, criticality_override")
        .eq("id", id)
        .eq("org_id", auth.activeOrgId)
        .maybeSingle();
      if (fetchErr || !existing) {
        const res = NextResponse.json({ ok: false, error: "Rule not found" }, { status: 404 });
        applySupabaseCookies(res, pendingCookies);
        return res;
      }
      if (final_is_mandatory === undefined) final_is_mandatory = existing.is_mandatory;
      if (final_criticality_override === undefined) final_criticality_override = existing.criticality_override ?? null;
    }

    const { data: rpcData, error } = await supabase.rpc("update_requirement_rule_v1", {
      p_org_id: auth.activeOrgId,
      p_rule_id: id,
      p_is_mandatory: final_is_mandatory,
      p_idempotency_key: null,
      p_criticality_override: final_criticality_override,
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
      if (error.code === "P0002") {
        const res = NextResponse.json(
          { ok: false, error: "Rule not found" },
          { status: 404 }
        );
        applySupabaseCookies(res, pendingCookies);
        return res;
      }
      console.error("[hr/requirements-rules] update_requirement_rule_v1 error", error);
      const res = NextResponse.json(
        { ok: false, error: "Failed to update rule" },
        { status: 500 }
      );
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    if (!rpcData?.ok) {
      const res = NextResponse.json(
        { ok: false, error: "Update did not return ok" },
        { status: 500 }
      );
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const res = NextResponse.json({ ok: true });
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

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { supabase, pendingCookies } = await createSupabaseServerClient(_request);
  const auth = await requireAdminOrHr(_request, supabase);
  if (!auth.ok) {
    const res = NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
    applySupabaseCookies(res, pendingCookies);
    return res;
  }

  const { id } = await params;
  if (!id) {
    const res = NextResponse.json({ ok: false, error: "Missing id" }, { status: 400 });
    applySupabaseCookies(res, pendingCookies);
    return res;
  }

  try {
    const { data: rpcData, error } = await supabase.rpc("delete_requirement_rule_v1", {
      p_org_id: auth.activeOrgId,
      p_rule_id: id,
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
      if (error.code === "P0002") {
        const res = NextResponse.json(
          { ok: false, error: "Rule not found" },
          { status: 404 }
        );
        applySupabaseCookies(res, pendingCookies);
        return res;
      }
      console.error("[hr/requirements-rules] delete_requirement_rule_v1 error", error);
      const res = NextResponse.json(
        { ok: false, error: "Failed to delete rule" },
        { status: 500 }
      );
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    if (!rpcData?.ok) {
      const res = NextResponse.json(
        { ok: false, error: "Delete did not return ok" },
        { status: 500 }
      );
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const res = NextResponse.json({ ok: true });
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
