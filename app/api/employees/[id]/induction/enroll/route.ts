/**
 * POST /api/employees/[id]/induction/enroll — enroll employee (sets RESTRICTED).
 * Admin/HR only. Governed via withMutationGovernance (allowNoShiftContext: true).
 */
import { NextResponse } from "next/server";
import { withMutationGovernance } from "@/lib/server/governance/withMutationGovernance";
import { isHrAdmin } from "@/lib/auth";
import { enrollEmployee } from "@/lib/server/induction/inductionService";

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
          errorPayload("validation", "Site context or employee site required for enrollment"),
          { status: 400 }
        );
      }
      const result = await enrollEmployee(ctx.admin, {
        orgId: ctx.orgId,
        siteId: empSite,
        employeeId,
        userId: ctx.userId,
      });
      if (!result.ok) {
        return NextResponse.json(errorPayload("enroll", result.error), { status: 500 });
      }
      return NextResponse.json({ ok: true, enrolled: true, status: "RESTRICTED" });
    }
    const result = await enrollEmployee(ctx.admin, {
      orgId: ctx.orgId,
      siteId,
      employeeId,
      userId: ctx.userId,
    });
    if (!result.ok) {
      return NextResponse.json(errorPayload("enroll", result.error), { status: 500 });
    }
    return NextResponse.json({ ok: true, enrolled: true, status: "RESTRICTED" });
  },
  {
    route: "/api/employees/[id]/induction/enroll",
    action: "induction_enroll",
    target_type: "org",
    allowNoShiftContext: true,
    getTargetIdAndMeta: () => ({ target_id: "enroll", meta: {} }),
  }
);
