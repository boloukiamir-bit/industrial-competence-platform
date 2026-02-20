/**
 * GET /api/induction/checkpoints — list active checkpoints for active org/site.
 * POST /api/induction/checkpoints — create/update checkpoint (admin/HR). Governed.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseServerClient, applySupabaseCookies } from "@/lib/supabase/server";
import { getActiveOrgFromSession } from "@/lib/server/activeOrg";
import { withMutationGovernance } from "@/lib/server/governance/withMutationGovernance";
import { isHrAdmin } from "@/lib/auth";
import { listCheckpoints } from "@/lib/server/induction/inductionService";

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function errorPayload(step: string, error: unknown, details?: string) {
  const msg = error instanceof Error ? error.message : String(error);
  return { ok: false as const, step, error: msg, ...(details != null && { details }) };
}

export async function GET(request: NextRequest) {
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
  const checkpoints = await listCheckpoints(admin, {
    orgId: org.activeOrgId,
    siteId: org.activeSiteId ?? null,
  });
  const res = NextResponse.json({ ok: true, checkpoints });
  applySupabaseCookies(res, pendingCookies);
  return res;
}

export const POST = withMutationGovernance(
  async (ctx) => {
    const { data: membership } = await ctx.supabase
      .from("memberships")
      .select("role")
      .eq("user_id", ctx.userId)
      .eq("org_id", ctx.orgId)
      .eq("status", "active")
      .maybeSingle();
    if (!isHrAdmin(membership?.role)) {
      return NextResponse.json(
        { ok: false as const, step: "forbidden", error: "Admin or HR role required" },
        { status: 403 }
      );
    }
    const code = typeof ctx.body.code === "string" ? ctx.body.code.trim() : "";
    const name = typeof ctx.body.name === "string" ? ctx.body.name.trim() : "";
    if (!code || !name) {
      return NextResponse.json(
        errorPayload("validation", "code and name are required"),
        { status: 400 }
      );
    }
    const site_id = typeof ctx.body.site_id === "string" ? ctx.body.site_id.trim() || null : null;
    const stage = typeof ctx.body.stage === "string" ? ctx.body.stage.trim() || null : null;
    const sort_order = typeof ctx.body.sort_order === "number" ? ctx.body.sort_order : 0;
    const is_active = ctx.body.is_active !== false;
    const now = new Date().toISOString();

    let query = ctx.admin
      .from("induction_checkpoints")
      .select("id, org_id, site_id, code, name, stage, sort_order, is_active, created_at, updated_at")
      .eq("org_id", ctx.orgId)
      .eq("code", code);
    if (site_id == null) {
      query = query.is("site_id", null);
    } else {
      query = query.eq("site_id", site_id);
    }
    const { data: existing, error: findErr } = await query.maybeSingle();
    if (findErr) {
      console.error("induction/checkpoints POST find", findErr);
      return NextResponse.json(errorPayload("find", findErr.message), { status: 500 });
    }
    const row = {
      org_id: ctx.orgId,
      site_id,
      code,
      name,
      stage,
      sort_order,
      is_active,
      updated_at: now,
    };
    if (existing) {
      const { data: updated, error: updateErr } = await ctx.admin
        .from("induction_checkpoints")
        .update(row)
        .eq("id", (existing as { id: string }).id)
        .select("id, org_id, site_id, code, name, stage, sort_order, is_active, created_at, updated_at")
        .single();
      if (updateErr) {
        console.error("induction/checkpoints POST update", updateErr);
        return NextResponse.json(errorPayload("update", updateErr.message), { status: 500 });
      }
      return NextResponse.json({ ok: true, checkpoint: updated });
    }
    const { data: inserted, error: insertErr } = await ctx.admin
      .from("induction_checkpoints")
      .insert(row)
      .select("id, org_id, site_id, code, name, stage, sort_order, is_active, created_at, updated_at")
      .single();
    if (insertErr) {
      if ((insertErr as { code?: string }).code === "23505") {
        return NextResponse.json(
          errorPayload("conflict", "Checkpoint with this code already exists for org/site"),
          { status: 409 }
        );
      }
      console.error("induction/checkpoints POST insert", insertErr);
      return NextResponse.json(errorPayload("insert", insertErr.message), { status: 500 });
    }
    return NextResponse.json({ ok: true, checkpoint: inserted });
  },
  {
    route: "/api/induction/checkpoints",
    action: "upsert_induction_checkpoint",
    target_type: "org",
    allowNoShiftContext: true,
    getTargetIdAndMeta: (body) => ({
      target_id: typeof body.code === "string" ? `checkpoint:${body.code}` : "unknown",
      meta: {},
    }),
  }
);
