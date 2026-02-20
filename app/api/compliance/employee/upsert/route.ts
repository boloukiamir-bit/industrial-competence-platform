/**
 * POST /api/compliance/employee/upsert — set/update one employee compliance. Admin/HR only.
 * Body: { employee_id, compliance_code, valid_from?, valid_to?, evidence_url?, notes?, waived?, date?, shift_code? }
 * Query fallback: ?date=...&shift_code=...
 * Shift context (date + shift_code) required for COMPLIANCE_MUTATION; partial scope returns 400 SHIFT_CONTEXT_INVALID.
 * Governed via withMutationGovernance; governance_events audit.
 */
import { NextResponse } from "next/server";
import { withMutationGovernance } from "@/lib/server/governance/withMutationGovernance";
import { isHrAdmin } from "@/lib/auth";

const ROUTE = "/api/compliance/employee/upsert";

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

    const employee_id = typeof ctx.body.employee_id === "string" ? ctx.body.employee_id.trim() : "";
    const compliance_code =
      typeof ctx.body.compliance_code === "string" ? ctx.body.compliance_code.trim() : "";
    if (!employee_id || !compliance_code) {
      return NextResponse.json(
        errorPayload("validation", "employee_id and compliance_code are required"),
        { status: 400 }
      );
    }

    const valid_from = typeof ctx.body.valid_from === "string" ? ctx.body.valid_from || null : null;
    const valid_to = typeof ctx.body.valid_to === "string" ? ctx.body.valid_to || null : null;
    const evidence_url =
      typeof ctx.body.evidence_url === "string" ? ctx.body.evidence_url.trim() || null : null;
    const notes = typeof ctx.body.notes === "string" ? ctx.body.notes.trim() || null : null;
    const waived = ctx.body.waived === true;

    const { data: catalogRow, error: catError } = await ctx.admin
      .from("compliance_catalog")
      .select("id")
      .eq("org_id", ctx.orgId)
      .eq("code", compliance_code)
      .eq("is_active", true)
      .maybeSingle();

    if (catError || !catalogRow) {
      return NextResponse.json(
        errorPayload(
          "catalog",
          catError?.message ?? "Compliance code not found or inactive",
          catError?.details as string | undefined
        ),
        { status: 404 }
      );
    }

    const compliance_id = (catalogRow as { id: string }).id;

    const { data: empRow, error: empError } = await ctx.admin
      .from("employees")
      .select("id, site_id")
      .eq("id", employee_id)
      .eq("org_id", ctx.orgId)
      .maybeSingle();

    if (empError) {
      console.error("compliance/employee/upsert employee lookup", empError);
      return NextResponse.json(errorPayload("employee", empError.message), { status: 500 });
    }
    if (!empRow) {
      return NextResponse.json(
        errorPayload("employee", "Employee not found or not in org"),
        { status: 404 }
      );
    }

    const site_id = (empRow as { id: string; site_id: string | null }).site_id ?? null;

    const row = {
      org_id: ctx.orgId,
      site_id,
      employee_id,
      compliance_id,
      valid_from: valid_from || null,
      valid_to: valid_to || null,
      evidence_url,
      notes,
      waived,
      updated_at: new Date().toISOString(),
    };

    const { data: raw, error } = await ctx.admin
      .from("employee_compliance")
      .upsert(row as never, {
        onConflict: "org_id,employee_id,compliance_id",
        ignoreDuplicates: false,
      })
      .select(
        "id, org_id, site_id, employee_id, compliance_id, valid_from, valid_to, evidence_url, notes, waived, created_at, updated_at"
      )
      .single();

    if (error) {
      console.error("compliance/employee/upsert", { step: "upsert", error });
      return NextResponse.json(errorPayload("upsert", error.message), { status: 500 });
    }

    type Selected = {
      id: string;
      org_id: string;
      site_id: string | null;
      employee_id: string;
      compliance_id: string;
      valid_from: string | null;
      valid_to: string | null;
      evidence_url: string | null;
      notes: string | null;
      waived: boolean;
      created_at: string;
      updated_at: string;
    };
    const data = raw as Selected | null;
    const item = data
      ? {
          id: data.id,
          org_id: data.org_id,
          site_id: data.site_id ?? null,
          employee_id: data.employee_id,
          compliance_id: data.compliance_id,
          valid_from: data.valid_from ?? null,
          valid_to: data.valid_to ?? null,
          evidence_url: data.evidence_url ?? null,
          notes: data.notes ?? null,
          waived: data.waived,
          created_at: data.created_at,
          updated_at: data.updated_at,
        }
      : null;

    return NextResponse.json({ ok: true, item });
  },
  {
    route: ROUTE,
    action: "COMPLIANCE_MUTATION",
    target_type: "compliance",
    getTargetIdAndMeta: (body, shift) => {
      const compliance_code =
        typeof body.compliance_code === "string" ? body.compliance_code.trim() : "";
      const employee_id = typeof body.employee_id === "string" ? body.employee_id.trim() : "";
      return {
        target_id: `compliance:${compliance_code}:employee:${employee_id}`,
        meta: {
          item_code: compliance_code,
          employee_id,
          op: "upsert",
          ...(shift.date != null && { date: shift.date }),
          ...(shift.shift_code != null && { shift_code: shift.shift_code }),
        },
      };
    },
  }
);
