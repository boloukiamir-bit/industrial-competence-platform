/**
 * POST /api/hr/templates/compliance-actions/render — render draft title/body with variables.
 * Body: { actionId, channel } OR { employee_id, compliance_code, action_type, due_date?, channel }
 * Resolves template: site-specific first (siteIdCandidate = activeSiteId ?? employee.site_id), then org-wide.
 * Returns 404 template_missing when no template for action_type/channel.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseServerClient, applySupabaseCookies } from "@/lib/supabase/server";
import { getActiveOrgFromSession } from "@/lib/server/activeOrg";
import { isHrAdmin } from "@/lib/auth";
import {
  COMPLIANCE_ACTION_DRAFT_CATEGORY,
  buildCode,
  parseTemplate,
  type HrTemplateRow,
} from "@/lib/hrTemplatesCompliance";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const CHANNELS = ["email", "sms", "note"] as const;

function errorPayload(step: string, error: unknown, message?: string) {
  const msg = error instanceof Error ? error.message : String(error);
  return { ok: false as const, step, error: msg, ...(message != null && { message }) };
}

function replaceVars(text: string, vars: Record<string, string>): string {
  return text.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? "");
}

export async function POST(request: NextRequest) {
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

  let reqBody: Record<string, unknown> = {};
  try {
    reqBody = await request.json().catch(() => ({}));
  } catch {
    reqBody = {};
  }

  const channel =
    typeof reqBody.channel === "string" && CHANNELS.includes(reqBody.channel as (typeof CHANNELS)[number])
      ? (reqBody.channel as (typeof CHANNELS)[number])
      : "email";

  let action_type: string;
  let employee_id: string;
  let compliance_id: string;
  let compliance_code = "";
  let compliance_name = "";
  let due_date: string | null;
  let siteIdCandidate: string | null = null;
  let employee_name: string;
  let employee_site_id: string | null;
  let line: string | null;
  let site_name: string;

  if (reqBody.actionId && typeof reqBody.actionId === "string") {
    const actionId = (reqBody.actionId as string).trim();
    const { data: action, error: actionErr } = await supabaseAdmin
      .from("compliance_actions")
      .select("id, org_id, site_id, employee_id, compliance_id, action_type, due_date")
      .eq("id", actionId)
      .eq("org_id", org.activeOrgId)
      .single();

    if (actionErr || !action) {
      const res = NextResponse.json(errorPayload("not_found", "Action not found"), { status: 404 });
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    action_type = action.action_type;
    employee_id = action.employee_id;
    compliance_id = action.compliance_id;
    due_date = action.due_date ? String(action.due_date).slice(0, 10) : null;
    siteIdCandidate = org.activeSiteId ?? action.site_id ?? null;
    const { data: catRowAction } = await supabaseAdmin
      .from("compliance_catalog")
      .select("code, name")
      .eq("id", action.compliance_id)
      .single();
    compliance_code = catRowAction?.code ?? "";
    compliance_name = catRowAction?.name ?? "";
  } else {
    const empId = typeof reqBody.employee_id === "string" ? (reqBody.employee_id as string).trim() : "";
    const compCode = typeof reqBody.compliance_code === "string" ? (reqBody.compliance_code as string).trim() : "";
    const at = typeof reqBody.action_type === "string" ? (reqBody.action_type as string).trim() : "";
    if (!empId || !compCode || !at) {
      const res = NextResponse.json(
        errorPayload("validation", "employee_id, compliance_code, action_type required"),
        { status: 400 }
      );
      applySupabaseCookies(res, pendingCookies);
      return res;
    }
    employee_id = empId;
    action_type = at;
    due_date =
      reqBody.due_date != null && reqBody.due_date !== ""
        ? String(reqBody.due_date).slice(0, 10)
        : null;

    const { data: catRow } = await supabaseAdmin
      .from("compliance_catalog")
      .select("id, code, name")
      .eq("org_id", org.activeOrgId)
      .eq("code", compCode)
      .maybeSingle();
    if (!catRow) {
      const res = NextResponse.json(errorPayload("catalog", "Compliance code not found"), { status: 404 });
      applySupabaseCookies(res, pendingCookies);
      return res;
    }
    compliance_id = catRow.id;
    compliance_code = catRow.code;
    compliance_name = catRow.name ?? compCode;
  }

  const { data: empRow } = await supabaseAdmin
    .from("employees")
    .select("id, name, first_name, last_name, site_id, line")
    .eq("id", employee_id)
    .eq("org_id", org.activeOrgId)
    .single();

  if (!empRow) {
    const res = NextResponse.json(errorPayload("employee", "Employee not found"), { status: 404 });
    applySupabaseCookies(res, pendingCookies);
    return res;
  }

  employee_name =
    empRow.name ||
    [empRow.first_name, empRow.last_name].filter(Boolean).join(" ") ||
    "Employee";
  employee_site_id = empRow.site_id ?? null;
  line = empRow.line ?? null;
  if (!siteIdCandidate) siteIdCandidate = employee_site_id;

  if (!compliance_code || !compliance_name) {
    const { data: catRow } = await supabaseAdmin
      .from("compliance_catalog")
      .select("code, name")
      .eq("id", compliance_id)
      .single();
    compliance_code = catRow?.code ?? "";
    compliance_name = catRow?.name ?? "";
  }

  const { data: siteRow } =
    siteIdCandidate != null
      ? await supabaseAdmin.from("sites").select("name").eq("id", siteIdCandidate).eq("org_id", org.activeOrgId).maybeSingle()
      : { data: null };
  site_name = siteRow?.name ?? "—";

  const daysLeft =
    due_date != null
      ? Math.ceil((new Date(due_date).getTime() - Date.now()) / (24 * 60 * 60 * 1000))
      : null;
  const as_of = new Date().toISOString().slice(0, 10);

  const code = buildCode(action_type, channel);
  const { data: templateRows, error: templateErr } = await supabaseAdmin
    .from("hr_templates")
    .select("id, org_id, site_id, code, name, category, content, is_active")
    .eq("org_id", org.activeOrgId)
    .eq("category", COMPLIANCE_ACTION_DRAFT_CATEGORY)
    .eq("is_active", true)
    .in("code", [code, `${code}.site`]);

  if (templateErr) {
    const res = NextResponse.json(errorPayload("template", templateErr.message), { status: 500 });
    applySupabaseCookies(res, pendingCookies);
    return res;
  }

  const rows = (templateRows ?? []) as HrTemplateRow[];
  const siteRowT = siteIdCandidate
    ? rows.find((r) => r.site_id != null && r.site_id === siteIdCandidate)
    : null;
  const orgRow = rows.find((r) => r.site_id == null);
  const templateRow = siteRowT ?? orgRow ?? rows[0] ?? null;

  if (!templateRow) {
    const res = NextResponse.json(
      errorPayload("template_missing", "No template configured for this action type", "No template configured for this action type"),
      { status: 404 }
    );
    applySupabaseCookies(res, pendingCookies);
    return res;
  }

  const parsed = parseTemplate(templateRow);
  const variables: Record<string, string> = {
    employee_name: employee_name,
    compliance_name: compliance_name,
    compliance_code: compliance_code,
    due_date: due_date ?? "—",
    days_left: daysLeft != null ? String(daysLeft) : "—",
    site_name,
    line: line ?? "—",
    owner_email: "HR",
    as_of,
  };

  const renderedTitle = replaceVars(parsed.title, variables);
  const renderedBody = replaceVars(parsed.body, variables);

  const res = NextResponse.json({
    ok: true,
    title: renderedTitle,
    body: renderedBody,
    channel: parsed.channel,
    usedTemplateId: templateRow.id,
    variables,
  });
  applySupabaseCookies(res, pendingCookies);
  return res;
}
