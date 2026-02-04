/**
 * POST /api/compliance/pilot/seed — P1.8 Pilot Execution Pack.
 * Dev-only (or ALLOW_PILOT_SEED=true). Admin/HR only. Tenant: getActiveOrgFromSession.
 * Seeds employees, catalog, employee_compliance, compliance_actions, events, templates.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseServerClient, applySupabaseCookies } from "@/lib/supabase/server";
import { getActiveOrgFromSession } from "@/lib/server/activeOrg";
import { isHrAdmin } from "@/lib/auth";
import { COMPLIANCE_ACTION_DRAFT_CATEGORY, buildCode } from "@/lib/hrTemplatesCompliance";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const ALLOW_PILOT_SEED = process.env.ALLOW_PILOT_SEED === "true";
const IS_PRODUCTION = process.env.NODE_ENV === "production";

function errorPayload(step: string, error: unknown, details?: string) {
  const msg = error instanceof Error ? error.message : String(error);
  return { ok: false as const, step, error: msg, ...(details != null && { details }) };
}

export async function POST(request: NextRequest) {
  if (IS_PRODUCTION && !ALLOW_PILOT_SEED) {
    return NextResponse.json(
      errorPayload("guard", "Pilot seed is disabled in production. Set ALLOW_PILOT_SEED=true to allow."),
      { status: 403 }
    );
  }

  const { supabase, pendingCookies } = await createSupabaseServerClient();
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

  if (!isHrAdmin(membership?.role)) {
    const res = NextResponse.json(errorPayload("forbidden", "Admin/HR only"), { status: 403 });
    applySupabaseCookies(res, pendingCookies);
    return res;
  }

  const orgId = org.activeOrgId;
  let seedSiteId: string | null = org.activeSiteId ?? null;
  if (seedSiteId == null) {
    const { data: empSite } = await supabaseAdmin
      .from("employees")
      .select("site_id")
      .eq("org_id", orgId)
      .not("site_id", "is", null)
      .limit(1)
      .maybeSingle();
    seedSiteId = (empSite as { site_id: string } | null)?.site_id ?? null;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = today.toISOString().slice(0, 10);
  const in7 = new Date(today);
  in7.setDate(in7.getDate() + 7);
  const in7Str = in7.toISOString().slice(0, 10);
  const pastDate = new Date(today);
  pastDate.setDate(pastDate.getDate() - 30);
  const pastStr = pastDate.toISOString().slice(0, 10);
  const expiringDate = new Date(today);
  expiringDate.setDate(expiringDate.getDate() + 14);
  const expiringStr = expiringDate.toISOString().slice(0, 10);
  const nowIso = new Date().toISOString();

  const counts = { employees: 0, catalog: 0, employee_compliance: 0, actions: 0, events: 0 };
  let oneEmployeeId: string | null = null;
  let oneActionId: string | null = null;

  try {
    const pilotPrefix = "PILOT_";
    const empSpecs = [
      { employee_number: `${pilotPrefix}E001`, name: "Pilot Anna Andersson", line: "Line A" },
      { employee_number: `${pilotPrefix}E002`, name: "Pilot Bertil Berg", line: "Line B" },
      { employee_number: `${pilotPrefix}E003`, name: "Pilot Cecilia Lind", line: "Line A" },
    ];

    for (const spec of empSpecs) {
      const { data: emp, error: empErr } = await supabaseAdmin
        .from("employees")
        .upsert(
          {
            org_id: orgId,
            employee_number: spec.employee_number,
            name: spec.name,
            line: spec.line,
            site_id: seedSiteId,
            is_active: true,
            updated_at: nowIso,
          },
          { onConflict: "org_id,employee_number", ignoreDuplicates: false }
        )
        .select("id")
        .single();
      if (empErr) {
        console.error("pilot/seed employees upsert", empErr);
        const res = NextResponse.json(errorPayload("employees", empErr.message), { status: 500 });
        applySupabaseCookies(res, pendingCookies);
        return res;
      }
      if (emp) {
        counts.employees++;
        if (!oneEmployeeId) oneEmployeeId = (emp as { id: string }).id;
      }
    }

    const catalogSpecs = [
      { code: `${pilotPrefix}LIC1`, name: "Pilot License A", category: "license" as const },
      { code: `${pilotPrefix}LIC2`, name: "Pilot License B", category: "license" as const },
      { code: `${pilotPrefix}MED1`, name: "Pilot Medical Check", category: "medical" as const },
      { code: `${pilotPrefix}MED2`, name: "Pilot Health Certificate", category: "medical" as const },
      { code: `${pilotPrefix}CON1`, name: "Pilot Contract Type", category: "contract" as const },
      { code: `${pilotPrefix}CON2`, name: "Pilot Policy Acknowledgement", category: "contract" as const },
    ];

    const catalogIds: string[] = [];
    for (const spec of catalogSpecs) {
      const { data: cat, error: catErr } = await supabaseAdmin
        .from("compliance_catalog")
        .upsert(
          {
            org_id: orgId,
            site_id: null,
            code: spec.code,
            name: spec.name,
            category: spec.category,
            is_active: true,
            updated_at: nowIso,
          },
          { onConflict: "org_id,code", ignoreDuplicates: false }
        )
        .select("id")
        .single();
      if (catErr) {
        console.error("pilot/seed catalog upsert", catErr);
        const res = NextResponse.json(errorPayload("catalog", catErr.message), { status: 500 });
        applySupabaseCookies(res, pendingCookies);
        return res;
      }
      if (cat) {
        counts.catalog++;
        catalogIds.push((cat as { id: string }).id);
      }
    }

    const employeeIds = (
      await supabaseAdmin.from("employees").select("id").eq("org_id", orgId).in("employee_number", empSpecs.map((e) => e.employee_number))
    ).data as { id: string }[] | null;
    const eids = (employeeIds ?? []).map((r) => r.id);
    if (eids.length < 2) {
      const res = NextResponse.json(errorPayload("employees", "Could not resolve pilot employees"), { status: 500 });
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const [empMissing, empOverdue, empExpiring] = eids;
    const [lic1, lic2, med1, med2, con1, con2] = catalogIds;

    await supabaseAdmin.from("employee_compliance").upsert(
      [
        {
          org_id: orgId,
          site_id: seedSiteId,
          employee_id: empOverdue,
          compliance_id: lic1,
          valid_from: pastStr,
          valid_to: pastStr,
          notes: "Pilot overdue",
          updated_at: nowIso,
        },
        {
          org_id: orgId,
          site_id: seedSiteId,
          employee_id: empExpiring,
          compliance_id: med1,
          valid_from: pastStr,
          valid_to: expiringStr,
          notes: "Pilot expiring",
          updated_at: nowIso,
        },
      ],
      { onConflict: "org_id,employee_id,compliance_id", ignoreDuplicates: false }
    );
    counts.employee_compliance = 2;
    // Intentionally no employee_compliance row for (empMissing, lic1) => "missing" in matrix

    const dueOverdue = pastStr;
    const due7d = in7Str;
    const actionTypeEvidence = "request_evidence";
    const actionTypeMissingTpl = "mark_waived_review";

    const actionsToInsert: Array<{
      org_id: string;
      site_id: string | null;
      employee_id: string;
      compliance_id: string;
      action_type: string;
      status: string;
      due_date: string | null;
      owner_user_id: string | null;
      done_at?: string | null;
      evidence_url?: string | null;
      evidence_notes?: string | null;
      evidence_added_at?: string | null;
      evidence_added_by?: string | null;
    }> = [
      {
        org_id: orgId,
        site_id: seedSiteId,
        employee_id: eids[0],
        compliance_id: lic1,
        action_type: "request_renewal",
        status: "open",
        due_date: dueOverdue,
        owner_user_id: org.userId,
      },
      {
        org_id: orgId,
        site_id: seedSiteId,
        employee_id: eids[0],
        compliance_id: lic2,
        action_type: "notify_employee",
        status: "open",
        due_date: due7d,
        owner_user_id: null,
      },
      {
        org_id: orgId,
        site_id: seedSiteId,
        employee_id: eids[1],
        compliance_id: med1,
        action_type: actionTypeEvidence,
        status: "open",
        due_date: null,
        owner_user_id: org.userId,
        evidence_url: "https://example.com/pilot-cert.pdf",
        evidence_notes: "Pilot evidence",
        evidence_added_at: nowIso,
        evidence_added_by: org.userId,
      },
      {
        org_id: orgId,
        site_id: seedSiteId,
        employee_id: eids[1],
        compliance_id: med2,
        action_type: actionTypeMissingTpl,
        status: "open",
        due_date: in7Str,
        owner_user_id: null,
      },
      {
        org_id: orgId,
        site_id: seedSiteId,
        employee_id: eids[2] ?? eids[0],
        compliance_id: con1,
        action_type: "request_renewal",
        status: "open",
        due_date: todayStr,
        owner_user_id: org.userId,
      },
      {
        org_id: orgId,
        site_id: seedSiteId,
        employee_id: eids[2] ?? eids[0],
        compliance_id: con2,
        action_type: "request_renewal",
        status: "done",
        due_date: pastStr,
        owner_user_id: org.userId,
        done_at: nowIso,
      },
    ];

    const { data: insertedActions, error: actionsErr } = await supabaseAdmin
      .from("compliance_actions")
      .insert(actionsToInsert)
      .select("id, action_type");

    if (actionsErr) {
      console.error("pilot/seed compliance_actions insert", actionsErr);
      const res = NextResponse.json(errorPayload("actions", actionsErr.message), { status: 500 });
      applySupabaseCookies(res, pendingCookies);
      return res;
    }
    const actions = (insertedActions ?? []) as Array<{ id: string; action_type: string }>;
    counts.actions = actions.length;
    const actionWithEvidence = actions.find((a) => a.action_type === actionTypeEvidence);
    oneActionId = actionWithEvidence?.id ?? actions[0]?.id ?? null;

    const actionIds = actions.map((a) => a.id);
    const events: Array<{
      org_id: string;
      site_id: string | null;
      action_id: string;
      event_type: string;
      channel: string | null;
      template_id: string | null;
      copied_title: boolean;
      copied_body: boolean;
      created_by: string | null;
    }> = [];
    let draftCount = 0;
    let evidenceEventCount = 0;
    for (const a of actions) {
      if (a.action_type === actionTypeEvidence && evidenceEventCount < 1) {
        events.push({
          org_id: orgId,
          site_id: seedSiteId,
          action_id: a.id,
          event_type: "evidence_added",
          channel: null,
          template_id: null,
          copied_title: false,
          copied_body: false,
          created_by: org.userId,
        });
        evidenceEventCount++;
      }
      if (draftCount < 2) {
        events.push({
          org_id: orgId,
          site_id: seedSiteId,
          action_id: a.id,
          event_type: "draft_copied",
          channel: "email",
          template_id: null,
          copied_title: true,
          copied_body: true,
          created_by: org.userId,
        });
        draftCount++;
      }
    }
    if (events.length > 0) {
      const { error: evErr } = await supabaseAdmin.from("compliance_action_events").insert(events);
      if (evErr) {
        console.error("pilot/seed compliance_action_events insert", evErr);
      } else {
        counts.events = events.length;
      }
    }

    const codeToDisable = buildCode(actionTypeMissingTpl, "email");
    await supabaseAdmin
      .from("hr_templates")
      .update({ is_active: false, updated_at: nowIso })
      .eq("org_id", orgId)
      .eq("category", COMPLIANCE_ACTION_DRAFT_CATEGORY)
      .eq("code", codeToDisable);

    const res = NextResponse.json({
      ok: true,
      counts: {
        employees: counts.employees,
        catalog: counts.catalog,
        employee_compliance: counts.employee_compliance,
        actions: counts.actions,
        events: counts.events,
      },
      examples: { oneActionId, oneEmployeeId },
    });
    applySupabaseCookies(res, pendingCookies);
    return res;
  } catch (err) {
    console.error("POST /api/compliance/pilot/seed failed:", err);
    const res = NextResponse.json(errorPayload("unexpected", err), { status: 500 });
    applySupabaseCookies(res, pendingCookies);
    return res;
  }
}
