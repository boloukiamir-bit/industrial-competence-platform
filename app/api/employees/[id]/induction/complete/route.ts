/**
 * POST /api/employees/[id]/induction/complete — complete a checkpoint (idempotent).
 * Body: { checkpoint_id }. Admin/HR only. Governed via withMutationGovernance (allowNoShiftContext: true).
 */
import { NextResponse } from "next/server";
import { withMutationGovernance } from "@/lib/server/governance/withMutationGovernance";
import { isHrAdmin } from "@/lib/auth";
import { completeCheckpoint } from "@/lib/server/induction/inductionService";
import { getEmployeeInduction } from "@/lib/server/induction/inductionService";

function getEmployeeIdFromPath(pathname: string): string | null {
  const segments = pathname.split("/");
  const i = segments.indexOf("employees");
  if (i < 0 || i + 1 >= segments.length) return null;
  const id = segments[i + 1];
  return id && id !== "new" ? id : null;
}

function errorPayload(step: string, error: unknown, details?: string) {
  const msg = error instanceof Error ? error.message : String(error);
  return { ok: false as const, step, error: msg, ...(details != null && { details }) };
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
    const pathname = new URL(ctx.request.url).pathname;
    const employeeId = getEmployeeIdFromPath(pathname);
    if (!employeeId) {
      return NextResponse.json(errorPayload("validation", "Employee id required"), { status: 400 });
    }
    const checkpoint_id = typeof ctx.body.checkpoint_id === "string" ? ctx.body.checkpoint_id.trim() : "";
    if (!checkpoint_id) {
      return NextResponse.json(errorPayload("validation", "checkpoint_id is required"), { status: 400 });
    }
    const siteId = ctx.siteId ?? undefined;
    if (!siteId) {
      const { data: emp } = await ctx.admin
        .from("employees")
        .select("site_id")
        .eq("id", employeeId)
        .eq("org_id", ctx.orgId)
        .maybeSingle();
      const empSite = (emp as { site_id: string | null } | null)?.site_id ?? null;
      if (!empSite) {
        return NextResponse.json(
          errorPayload("validation", "Site context or employee site required"),
          { status: 400 }
        );
      }
      const result = await completeCheckpoint(ctx.admin, {
        orgId: ctx.orgId,
        siteId: empSite,
        employeeId,
        checkpointId: checkpoint_id,
        userId: ctx.userId,
      });
      if (!result.ok) {
        return NextResponse.json(errorPayload("complete", result.error), { status: 500 });
      }
      const induction = await getEmployeeInduction(ctx.admin, {
        orgId: ctx.orgId,
        siteId: empSite,
        employeeId,
      });
      return NextResponse.json({ ok: true, status: result.status, induction });
    }
    const result = await completeCheckpoint(ctx.admin, {
      orgId: ctx.orgId,
      siteId,
      employeeId,
      checkpointId: checkpoint_id,
      userId: ctx.userId,
    });
    if (!result.ok) {
      return NextResponse.json(errorPayload("complete", result.error), { status: 500 });
    }
    const induction = await getEmployeeInduction(ctx.admin, {
      orgId: ctx.orgId,
      siteId,
      employeeId,
    });
    return NextResponse.json({ ok: true, status: result.status, induction });
  },
  {
    route: "/api/employees/[id]/induction/complete",
    action: "induction_complete",
    target_type: "org",
    allowNoShiftContext: true,
    getTargetIdAndMeta: (body) => ({
      target_id: typeof body.checkpoint_id === "string" ? `checkpoint:${body.checkpoint_id}` : "complete",
      meta: {},
    }),
  }
);
