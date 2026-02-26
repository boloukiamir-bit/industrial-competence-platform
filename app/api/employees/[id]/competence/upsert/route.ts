/**
 * POST /api/employees/[id]/competence/upsert — upsert one skill rating.
 * Auth: admin/hr only. Governed via withMutationGovernance (tolerateInvalidJson).
 */
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { withMutationGovernance } from "@/lib/server/governance/withMutationGovernance";
import { isHrAdmin } from "@/lib/auth";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function getEmployeeIdFromPath(pathname: string): string | null {
  const match = pathname.match(/\/api\/employees\/([^/]+)\/competence\/upsert/);
  return match?.[1] ?? null;
}

export const POST = withMutationGovernance(
  async (ctx) => {
    const id = getEmployeeIdFromPath(new URL(ctx.request.url).pathname);
    if (!id) {
      return NextResponse.json({ error: "Employee id required" }, { status: 400 });
    }

    const { data: membership } = await ctx.supabase
      .from("memberships")
      .select("role")
      .eq("user_id", ctx.userId)
      .eq("org_id", ctx.orgId)
      .eq("status", "active")
      .maybeSingle();

    if (!isHrAdmin(membership?.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = ctx.body as Record<string, unknown>;
    const skillId = typeof body.skill_id === "string" ? body.skill_id.trim() : "";
    let level = typeof body.level === "number" ? body.level : parseInt(String(body.level ?? ""), 10);
    const validTo =
      body.valid_to === null || body.valid_to === undefined
        ? null
        : typeof body.valid_to === "string" && body.valid_to.trim()
          ? body.valid_to.trim()
          : null;

    if (!skillId) {
      return NextResponse.json({ error: "skill_id required" }, { status: 400 });
    }
    if (!Number.isFinite(level) || level < 0 || level > 4) {
      return NextResponse.json({ error: "level must be 0-4" }, { status: 400 });
    }

    const { data: emp, error: empErr } = await ctx.admin
      .from("employees")
      .select("id")
      .eq("id", id)
      .eq("org_id", ctx.orgId)
      .maybeSingle();

    if (empErr || !emp) {
      return NextResponse.json({ error: "Employee not found" }, { status: 404 });
    }

    const { data: skill, error: skillErr } = await ctx.admin
      .from("skills")
      .select("id")
      .eq("id", skillId)
      .eq("org_id", ctx.orgId)
      .maybeSingle();

    if (skillErr || !skill) {
      return NextResponse.json({ error: "Skill not found" }, { status: 404 });
    }

    const row: Record<string, unknown> = {
      employee_id: id,
      skill_id: skillId,
      level,
    };
    if (validTo !== undefined) {
      row.valid_to = validTo;
    }

    const { error: upsertErr } = await ctx.admin
      .from("employee_skills")
      .upsert(row, {
        onConflict: "employee_id,skill_id",
      });

    if (upsertErr) {
      console.error("[api/employees/[id]/competence/upsert]", upsertErr);
      return NextResponse.json(
        { error: upsertErr.message || "Failed to upsert" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  },
  {
    route: "/api/employees/[id]/competence/upsert",
    action: "EMPLOYEE_COMPETENCE_UPSERT",
    target_type: "employee_skill",
    allowNoShiftContext: true,
    tolerateInvalidJson: true,
    getTargetIdAndMeta: (body) => ({
      target_id: typeof body.skill_id === "string" ? body.skill_id : "unknown",
      meta: {},
    }),
  }
);
