/**
 * GET /api/compliance/actions?employee_id=&status= — list actions. Org/site scoped. Optional filters.
 * POST /api/compliance/actions — create compliance gap action. Admin/HR only. Writes governance_events.
 * Governed via withMutationGovernance (allowNoShiftContext: true).
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseServerClient, applySupabaseCookies } from "@/lib/supabase/server";
import { getActiveOrgFromSession } from "@/lib/server/activeOrg";
import { isHrAdmin } from "@/lib/auth";
import { withMutationGovernance } from "@/lib/server/governance/withMutationGovernance";
import { normalizeComplianceActionStatus, type ComplianceActionStatus } from "@/types/domain";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

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
      return NextResponse.json(errorPayload("forbidden", "Admin or HR role required"), { status: 403 });
    }

    const body = ctx.body as Record<string, unknown>;
    const title = typeof body.title === "string" ? body.title.trim() : "";
    if (!title) {
      return NextResponse.json(errorPayload("validation", "title is required"), { status: 400 });
    }
    const description = typeof body.description === "string" ? body.description.trim() : "";
    const employee_id =
      typeof body.employee_id === "string" ? body.employee_id.trim() || null : null;
    let requirement_id =
      typeof body.requirement_id === "string" ? body.requirement_id.trim() || null : null;
    const compliance_code =
      typeof body.compliance_code === "string" ? body.compliance_code.trim() || null : null;
    if (!requirement_id && compliance_code) {
      const { data: catRow, error: catErr } = await ctx.admin
        .from("compliance_catalog")
        .select("id")
        .eq("org_id", ctx.orgId)
        .eq("code", compliance_code)
        .eq("is_active", true)
        .maybeSingle();
      if (!catErr && catRow) requirement_id = (catRow as { id: string }).id;
    }
    const assigned_to_user_id =
      typeof body.assigned_to_user_id === "string" ? body.assigned_to_user_id.trim() || null : null;
    const due_date =
      typeof body.due_date === "string" ? body.due_date.trim() || null : null;

    let site_id: string | null = null;
    if (employee_id) {
      const { data: empRow, error: empErr } = await ctx.admin
        .from("employees")
        .select("id, site_id")
        .eq("id", employee_id)
        .eq("org_id", ctx.orgId)
        .maybeSingle();
      if (empErr || !empRow) {
        return NextResponse.json(
          errorPayload("validation", "employee_id not found or not in org"),
          { status: 400 }
        );
      }
      site_id = (empRow as { site_id: string | null }).site_id ?? null;
      if (ctx.siteId != null && site_id !== null && site_id !== ctx.siteId) {
        return NextResponse.json(
          errorPayload("validation", "Employee does not belong to active site"),
          { status: 400 }
        );
      }
    }

    if (requirement_id) {
      const { data: catRow, error: catErr } = await ctx.admin
        .from("compliance_catalog")
        .select("id")
        .eq("id", requirement_id)
        .eq("org_id", ctx.orgId)
        .maybeSingle();
      if (catErr || !catRow) {
        return NextResponse.json(
          errorPayload("validation", "requirement_id not found or not in org"),
          { status: 400 }
        );
      }
    }

    const insertRow = {
      org_id: ctx.orgId,
      site_id: ctx.siteId ?? site_id,
      employee_id,
      compliance_id: requirement_id,
      action_type: "COMPLIANCE_GAP",
      title,
      description: description || "",
      owner_user_id: assigned_to_user_id,
      due_date: due_date || null,
      status: "OPEN",
      created_by: ctx.userId,
    };

    const { data: inserted, error: insertErr } = await ctx.admin
      .from("compliance_actions")
      .insert(insertRow)
      .select("id, org_id, site_id, employee_id, compliance_id, action_type, title, description, owner_user_id, due_date, status, created_by, created_at, closed_at, closed_by")
      .single();

    if (insertErr) {
      console.error("[compliance/actions] POST insert", insertErr);
      return NextResponse.json(errorPayload("insert", insertErr.message), { status: 500 });
    }

    const actionId = (inserted as { id: string }).id;
    const idempotencyKey = `COMPLIANCE_ACTION_CREATE:${actionId}:${Date.now()}`;
    const { error: govErr } = await ctx.admin.from("governance_events").insert({
      org_id: ctx.orgId,
      site_id: ctx.siteId ?? null,
      actor_user_id: ctx.userId,
      action: "COMPLIANCE_ACTION_CREATE",
      target_type: "COMPLIANCE_ACTION",
      target_id: actionId,
      outcome: "RECORDED",
      legitimacy_status: "OK",
      readiness_status: "NON_BLOCKING",
      reason_codes: ["COMPLIANCE_GAP"],
      meta: {
        employee_id: employee_id ?? undefined,
        requirement_id: requirement_id ?? undefined,
        due_date: due_date ?? undefined,
        assigned_to_user_id: assigned_to_user_id ?? undefined,
        title,
      },
      idempotency_key: idempotencyKey,
    });

    if (govErr) {
      console.error("[compliance/actions] POST governance_events insert", govErr);
    }

    const action = mapRowToAction(inserted as Record<string, unknown>);
    return NextResponse.json({ ok: true, action }, { status: 201 });
  },
  {
    route: "/api/compliance/actions",
    action: "COMPLIANCE_ACTIONS_CREATE",
    target_type: "compliance_action",
    allowNoShiftContext: true,
    getTargetIdAndMeta: (body) => ({
      target_id: typeof body.title === "string" ? `create:${body.title}` : "unknown",
      meta: { title: typeof body.title === "string" ? body.title : undefined },
    }),
  }
);

/** DB status values that match canonical OPEN (for query expansion). */
const OPEN_DB_VALUES = ["OPEN", "open"];
/** DB status values that match canonical CLOSED. */
const CLOSED_DB_VALUES = ["CLOSED", "done"];

function expandStatusForQuery(canonical: ComplianceActionStatus): string[] {
  if (canonical === "OPEN") return OPEN_DB_VALUES;
  if (canonical === "CLOSED") return CLOSED_DB_VALUES;
  return ["IN_PROGRESS"];
}

function mapRowToAction(r: Record<string, unknown>) {
  const rawStatus = r.status as string | undefined;
  return {
    id: r.id,
    org_id: r.org_id,
    site_id: r.site_id ?? null,
    employee_id: r.employee_id ?? null,
    requirement_id: r.compliance_id ?? null,
    action_type: r.action_type,
    title: r.title,
    description: r.description ?? "",
    assigned_to_user_id: r.owner_user_id ?? null,
    due_date: r.due_date ?? null,
    status: normalizeComplianceActionStatus(rawStatus),
    created_by: r.created_by,
    created_at: r.created_at,
    closed_at: r.closed_at ?? null,
    closed_by: r.closed_by ?? null,
  };
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
  const employeeId =
    searchParams.get("employee_id")?.trim() ||
    searchParams.get("employeeId")?.trim() ||
    null;
  const statusParam = searchParams.get("status")?.trim() || null;

  try {
    let query = supabaseAdmin
      .from("compliance_actions")
      .select(
        "id, employee_id, compliance_id, action_type, status, due_date, notes, created_at, evidence_url, evidence_notes, evidence_added_at, evidence_added_by, title, description, owner_user_id, created_by, closed_at, closed_by"
      )
      .eq("org_id", org.activeOrgId)
      .order("created_at", { ascending: false });

    if (employeeId) {
      query = query.eq("employee_id", employeeId);
    }
    if (statusParam) {
      const raw = statusParam.split(",").map((s) => s.trim()).filter(Boolean);
      const canonical = raw.map((s) => (s === "open" ? "OPEN" : s === "done" ? "CLOSED" : s as ComplianceActionStatus)).filter((s): s is ComplianceActionStatus => ["OPEN", "IN_PROGRESS", "CLOSED"].includes(s));
      if (canonical.length) {
        const expanded = [...new Set(canonical.flatMap(expandStatusForQuery))];
        query = query.in("status", expanded);
      }
    }
    if (org.activeSiteId) {
      query = query.or(`site_id.eq.${org.activeSiteId},site_id.is.null`);
    }

    const { data: rows, error } = await query;

    if (error) {
      console.error("compliance/actions list", error);
      const res = NextResponse.json(errorPayload("list", error.message), { status: 500 });
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const catalogIds = [
      ...new Set(
        (rows ?? []).map((r: { compliance_id: string | null }) => r.compliance_id).filter(Boolean)
      ),
    ] as string[];
    const { data: catalogRows } =
      catalogIds.length > 0
        ? await supabaseAdmin
            .from("compliance_catalog")
            .select("id, code, name")
            .in("id", catalogIds)
        : { data: [] as { id: string; code: string; name: string }[] };
    const catalogMap = new Map(
      (catalogRows ?? []).map((c) => [c.id, { code: c.code, name: c.name }])
    );

    const rowList = rows ?? [];
    const ids = rowList.map((r: { id: string }) => r.id);
    const latestDraftByAction = new Map<
      string,
      { last_drafted_at: string; last_drafted_channel: string | null }
    >();
    if (ids.length > 0) {
      const { data: eventRows } = await supabaseAdmin
        .from("compliance_action_events")
        .select("action_id, created_at, channel")
        .eq("org_id", org.activeOrgId)
        .eq("event_type", "draft_copied")
        .in("action_id", ids)
        .order("created_at", { ascending: false });
      for (const e of eventRows ?? []) {
        if (!latestDraftByAction.has(e.action_id)) {
          latestDraftByAction.set(e.action_id, {
            last_drafted_at: e.created_at,
            last_drafted_channel: e.channel ?? null,
          });
        }
      }
    }

    const actions = rowList.map((r: Record<string, unknown>) => {
      const cat = r.compliance_id ? catalogMap.get(r.compliance_id as string) : null;
      const draftMeta = latestDraftByAction.get(r.id as string);
      return {
        ...mapRowToAction(r),
        compliance_code: cat?.code ?? null,
        compliance_name: cat?.name ?? null,
        notes: r.notes ?? null,
        last_drafted_at: draftMeta?.last_drafted_at ?? null,
        last_drafted_channel: draftMeta?.last_drafted_channel ?? null,
        evidence_url: r.evidence_url ?? null,
        evidence_notes: r.evidence_notes ?? null,
        evidence_added_at: r.evidence_added_at ?? null,
        evidence_added_by: r.evidence_added_by ?? null,
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
