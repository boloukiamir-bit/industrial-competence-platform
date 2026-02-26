/**
 * POST /api/compliance/bulk-assign — assign one compliance type to many employees by scope. Admin/HR only.
 * Body: { compliance_code, scope, scope_value?, valid_from?, valid_to?, notes?, waived? }
 * Returns { ok: true, inserted, updated, skipped } or { ok: false, step, error }.
 * Governed via withMutationGovernance (allowNoShiftContext: true).
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseServerClient, applySupabaseCookies } from "@/lib/supabase/server";
import { getActiveOrgFromSession } from "@/lib/server/activeOrg";
import { isHrAdmin } from "@/lib/auth";
import { withMutationGovernance } from "@/lib/server/governance/withMutationGovernance";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function errorPayload(step: string, error: unknown, details?: string) {
  const msg = error instanceof Error ? error.message : String(error);
  return { ok: false as const, step, error: msg, ...(details != null && { details }) };
}

const SCOPE_VALUES = ["all", "line", "department", "shift", "area"] as const;
type Scope = (typeof SCOPE_VALUES)[number];

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

    const body = ctx.body as Record<string, unknown>;
    const compliance_code = typeof body.compliance_code === "string" ? body.compliance_code.trim() : "";
    const scopeRaw = typeof body.scope === "string" ? body.scope.trim().toLowerCase() : "";
    const scope = SCOPE_VALUES.includes(scopeRaw as Scope) ? (scopeRaw as Scope) : "all";
    const scope_value = typeof body.scope_value === "string" ? body.scope_value.trim() || null : null;
    const valid_from = typeof body.valid_from === "string" ? body.valid_from || null : null;
    const valid_to = typeof body.valid_to === "string" ? body.valid_to || null : null;
    const notes = typeof body.notes === "string" ? body.notes.trim() || null : null;
    const waived = body.waived === true;

    if (!compliance_code) {
      return NextResponse.json(errorPayload("validation", "compliance_code is required"), { status: 400 });
    }

    if (scope === "shift") {
      return NextResponse.json(
        errorPayload("validation", "Shift scope not supported yet"),
        { status: 400 }
      );
    }

    if (scope !== "all" && !scope_value) {
      return NextResponse.json(
        errorPayload("validation", `scope_value is required when scope is ${scope}`),
        { status: 400 }
      );
    }

    try {
      const orgId = ctx.orgId;

      const { data: catalogRow, error: catError } = await ctx.admin
      .from("compliance_catalog")
      .select("id")
      .eq("org_id", orgId)
      .eq("code", compliance_code)
      .eq("is_active", true)
      .maybeSingle();

    if (catError || !catalogRow) {
      return NextResponse.json(
        errorPayload("catalog", "Compliance code not found or inactive", catError?.message),
        { status: 404 }
      );
    }

    const compliance_id = catalogRow.id;

    const employeesQuery = ctx.admin
      .from("employees")
      .select("id, site_id")
      .eq("org_id", orgId)
      .eq("is_active", true);

    if (scope === "line" && scope_value) {
      employeesQuery.eq("line_code", scope_value);
    } else if (scope === "department" && scope_value) {
      employeesQuery.eq("team", scope_value);
    } else if (scope === "area" && scope_value) {
      employeesQuery.eq("line_code", scope_value);
    }
    // "shift" not supported on employees table — no filter (all)

    const { data: employees, error: empErr } = await employeesQuery;

    if (empErr) {
      console.error("compliance/bulk-assign employees", empErr);
      return NextResponse.json(errorPayload("employees", empErr.message), { status: 500 });
    }

    const empList = employees ?? [];
    const withSite = empList.filter((e) => e.site_id != null);
    const withoutSite = empList.filter((e) => e.site_id == null);
    if (withoutSite.length > 0) {
      return NextResponse.json(
        errorPayload(
          "employees",
          `${withoutSite.length} employee(s) have no site_id; bulk assign requires site_id. Backfill employees.site_id first.`
        ),
        { status: 400 }
      );
    }

    const existing = await ctx.admin
      .from("employee_compliance")
      .select("employee_id")
      .eq("org_id", orgId)
      .eq("compliance_id", compliance_id)
      .in("employee_id", withSite.map((e) => e.id));

    if (existing.error) {
      console.error("compliance/bulk-assign existing", existing.error);
      return NextResponse.json(errorPayload("existing", existing.error.message), { status: 500 });
    }

    const existingSet = new Set((existing.data ?? []).map((r) => r.employee_id));
    const now = new Date().toISOString();

    const toInsert: Array<{
      org_id: string;
      site_id: string;
      employee_id: string;
      compliance_id: string;
      valid_from: string | null;
      valid_to: string | null;
      notes: string | null;
      waived: boolean;
      created_at: string;
      updated_at: string;
    }> = [];
    const toUpdate: Array<{ employee_id: string }> = [];

    for (const emp of withSite) {
      const site_id = emp.site_id as string;
      const row = {
        org_id: orgId,
        site_id,
        employee_id: emp.id,
        compliance_id,
        valid_from: valid_from || null,
        valid_to: valid_to || null,
        evidence_url: null as string | null,
        notes,
        waived,
        updated_at: now,
      };
      if (existingSet.has(emp.id)) {
        toUpdate.push({ employee_id: emp.id });
      } else {
        toInsert.push({
          ...row,
          created_at: now,
        });
      }
    }

    let inserted = 0;
    let updated = 0;

    if (toInsert.length > 0) {
      const insertRows = toInsert.map((r) => ({
        org_id: r.org_id,
        site_id: r.site_id,
        employee_id: r.employee_id,
        compliance_id: r.compliance_id,
        valid_from: r.valid_from,
        valid_to: r.valid_to,
        evidence_url: null,
        notes: r.notes,
        waived: r.waived,
      }));
      const { error: insErr } = await ctx.admin
        .from("employee_compliance")
        .upsert(insertRows, { onConflict: "org_id,employee_id,compliance_id", ignoreDuplicates: false });
      if (insErr) {
        console.error("compliance/bulk-assign insert", insErr);
        return NextResponse.json(errorPayload("upsert", insErr.message), { status: 500 });
      }
      inserted = toInsert.length;
    }

    if (toUpdate.length > 0) {
      for (const { employee_id } of toUpdate) {
        const emp = withSite.find((e) => e.id === employee_id);
        const site_id = emp?.site_id as string;
        const { error: upErr } = await ctx.admin
          .from("employee_compliance")
          .update({
            valid_from: valid_from || null,
            valid_to: valid_to || null,
            notes,
            waived,
            updated_at: now,
          })
          .eq("org_id", orgId)
          .eq("employee_id", employee_id)
          .eq("compliance_id", compliance_id);
        if (upErr) {
          console.error("compliance/bulk-assign update", { employee_id, upErr });
          return NextResponse.json(errorPayload("upsert", upErr.message), { status: 500 });
        }
        updated += 1;
      }
    }

    const skipped = 0;
    return NextResponse.json({ ok: true, inserted, updated, skipped });
  } catch (err) {
    console.error("POST /api/compliance/bulk-assign failed:", err);
    return NextResponse.json(errorPayload("unexpected", err), { status: 500 });
  }
  },
  {
    route: "/api/compliance/bulk-assign",
    action: "COMPLIANCE_BULK_ASSIGN",
    target_type: "compliance_scope",
    allowNoShiftContext: true,
    getTargetIdAndMeta: (body) => ({
      target_id: typeof body.compliance_code === "string" ? body.compliance_code : "unknown",
      meta: { scope: (body.scope as string) ?? undefined },
    }),
  }
);
