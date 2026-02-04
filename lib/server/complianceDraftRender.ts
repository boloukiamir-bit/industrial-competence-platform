/**
 * Server-side draft render for compliance actions (export + reuse for render route).
 * Same resolution: site-specific template then org-wide. Safe variable replacement.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { getActiveSiteName } from "@/lib/server/siteName";
import {
  COMPLIANCE_ACTION_DRAFT_CATEGORY,
  buildCode,
  parseTemplate,
  type HrTemplateRow,
} from "@/lib/hrTemplatesCompliance";

export type DraftRenderInput = {
  action_type: string;
  due_date: string | null;
  site_id: string | null;
  employee_name: string;
  employee_site_id: string | null;
  compliance_code: string;
  compliance_name: string;
  line: string | null;
};

export type DraftRenderResult = {
  subject: string;
  body: string;
  template_status: "ok" | "missing";
};

function replaceVars(text: string, vars: Record<string, string>): string {
  return text.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? "");
}

/**
 * Render draft subject/body for one action. Uses site-specific then org-wide template.
 * Returns template_status "missing" when no template found (caller still exports row with empty subject/body).
 */
export async function renderDraftForAction(
  supabase: SupabaseClient,
  orgId: string,
  activeSiteId: string | null,
  input: DraftRenderInput,
  channel: "email" | "sms" | "note"
): Promise<DraftRenderResult> {
  const siteIdCandidate = activeSiteId ?? input.site_id ?? input.employee_site_id ?? null;
  const site_name =
    siteIdCandidate != null
      ? (await getActiveSiteName(supabase, siteIdCandidate, orgId)) ?? "—"
      : "—";

  const daysLeft =
    input.due_date != null
      ? Math.ceil(
          (new Date(input.due_date).getTime() - Date.now()) / (24 * 60 * 60 * 1000)
        )
      : null;
  const as_of = new Date().toISOString().slice(0, 10);

  const code = buildCode(input.action_type, channel);
  const { data: templateRows, error: templateErr } = await supabase
    .from("hr_templates")
    .select("id, org_id, site_id, code, name, category, content, is_active")
    .eq("org_id", orgId)
    .eq("category", COMPLIANCE_ACTION_DRAFT_CATEGORY)
    .eq("is_active", true)
    .in("code", [code, `${code}.site`]);

  if (templateErr) {
    return { subject: "", body: "", template_status: "missing" };
  }

  const rows = (templateRows ?? []) as HrTemplateRow[];
  const siteRowT = siteIdCandidate
    ? rows.find((r) => r.site_id != null && r.site_id === siteIdCandidate)
    : null;
  const orgRow = rows.find((r) => r.site_id == null);
  const templateRow = siteRowT ?? orgRow ?? rows[0] ?? null;

  if (!templateRow) {
    return { subject: "", body: "", template_status: "missing" };
  }

  const parsed = parseTemplate(templateRow);
  const variables: Record<string, string> = {
    employee_name: input.employee_name,
    compliance_name: input.compliance_name,
    compliance_code: input.compliance_code,
    due_date: input.due_date ?? "—",
    days_left: daysLeft != null ? String(daysLeft) : "—",
    site_name,
    line: input.line ?? "—",
    owner_email: "HR",
    as_of,
  };

  const subject = replaceVars(parsed.title, variables);
  const body = replaceVars(parsed.body, variables);
  return { subject, body, template_status: "ok" };
}
