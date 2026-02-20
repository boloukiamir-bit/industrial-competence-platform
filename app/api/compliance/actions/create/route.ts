/**
 * POST /api/compliance/actions/create — create one compliance action. Admin/HR only.
 * Body: { employee_id, compliance_code, action_type, due_date?, notes? }
 * Governed via withMutationGovernance (org-only).
 */
import { NextResponse } from "next/server";
import { withMutationGovernance } from "@/lib/server/governance/withMutationGovernance";
import { isHrAdmin } from "@/lib/auth";

const ACTION_TYPES = [
  "request_renewal",
  "request_evidence",
  "notify_employee",
  "mark_waived_review",
] as const;

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
      return NextResponse.json(errorPayload("forbidden", "Admin/HR only"), { status: 403 });
    }

    const employee_id = typeof ctx.body.employee_id === "string" ? ctx.body.employee_id.trim() : "";
    const compliance_code =
      typeof ctx.body.compliance_code === "string" ? ctx.body.compliance_code.trim() : "";
    const action_type = typeof ctx.body.action_type === "string" ? ctx.body.action_type.trim() : "";
    if (!employee_id || !compliance_code || !action_type) {
      return NextResponse.json(
        errorPayload("validation", "employee_id, compliance_code, and action_type are required"),
        { status: 400 }
      );
    }
    if (!ACTION_TYPES.includes(action_type as (typeof ACTION_TYPES)[number])) {
      return NextResponse.json(
        errorPayload("validation", `action_type must be one of: ${ACTION_TYPES.join(", ")}`),
        { status: 400 }
      );
    }

    const due_date = typeof ctx.body.due_date === "string" ? ctx.body.due_date.trim() || null : null;
    const notes = typeof ctx.body.notes === "string" ? ctx.body.notes.trim() || null : null;

    const { data: catalogRow, error: catError } = await ctx.admin
      .from("compliance_catalog")
      .select("id")
      .eq("org_id", ctx.orgId)
      .eq("code", compliance_code)
      .eq("is_active", true)
      .maybeSingle();

    if (catError || !catalogRow) {
      return NextResponse.json(
        errorPayload("catalog", "Compliance code not found or inactive", catError?.message),
        { status: 404 }
      );
    }

    const { data: empRow, error: empError } = await ctx.admin
      .from("employees")
      .select("id, site_id")
      .eq("id", employee_id)
      .eq("org_id", ctx.orgId)
      .eq("is_active", true)
      .maybeSingle();

    if (empError || !empRow) {
      return NextResponse.json(
        errorPayload("employee", "Employee not found or not in org", empError?.message),
        { status: 404 }
      );
    }

    const actionSiteId =
      ctx.siteId != null ? ctx.siteId : (empRow as { site_id: string | null }).site_id ?? null;
    if (
      ctx.siteId != null &&
      (empRow as { site_id: string | null }).site_id != null &&
      ctx.siteId !== (empRow as { site_id: string | null }).site_id
    ) {
      return NextResponse.json(
        {
          ok: false,
          step: "site_mismatch",
          message: "Employee does not belong to active site",
        },
        { status: 409 }
      );
    }

    const insertRow = {
      org_id: ctx.orgId,
      site_id: actionSiteId,
      employee_id,
      compliance_id: (catalogRow as { id: string }).id,
      action_type,
      status: "open",
      owner_user_id: ctx.userId,
      due_date: due_date || null,
      notes,
    };

    const { data: inserted, error } = await ctx.admin
      .from("compliance_actions")
      .insert(insertRow)
      .select("id")
      .single();

    if (error) {
      console.error("compliance/actions/create insert", error);
      return NextResponse.json(
        errorPayload("insert", error.message, (error as { details?: string }).details),
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true, action_id: inserted?.id });
  },
  {
    route: "/api/compliance/actions/create",
    action: "COMPLIANCE_ACTION_CREATE",
    target_type: "compliance_action",
    allowNoShiftContext: true,
    getTargetIdAndMeta: (body) => {
      const employee_id = typeof body.employee_id === "string" ? body.employee_id.trim() : "";
      const compliance_code =
        typeof body.compliance_code === "string" ? body.compliance_code.trim() : "";
      const action_type = typeof body.action_type === "string" ? body.action_type.trim() : "";
      return {
        target_id:
          employee_id && compliance_code && action_type
            ? `create:${employee_id}:${compliance_code}:${action_type}`
            : "unknown",
        meta: {
          employee_id,
          compliance_code,
          action_type,
        },
      };
    },
  }
);
