/**
 * P1.3 — Compliance action draft templates (reuse hr_templates, category compliance_action_draft).
 * code = compliance_action_draft.<actionType>.<channel>
 */

export const COMPLIANCE_ACTION_DRAFT_CATEGORY = "compliance_action_draft";

export type HrTemplateRow = {
  id: string;
  org_id: string;
  site_id: string | null;
  code: string;
  name: string;
  category: string;
  content: Record<string, unknown>;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
};

export type ParsedComplianceTemplate = {
  id: string;
  code: string;
  name: string;
  title: string;
  body: string;
  action_type: string;
  channel: string;
  site_id: string | null;
};

const ACTION_TYPES = ["request_renewal", "request_evidence", "notify_employee", "mark_waived_review"] as const;
const CHANNELS = ["email", "sms", "note"] as const;

export function buildCode(actionType: string, channel: string): string {
  return `${COMPLIANCE_ACTION_DRAFT_CATEGORY}.${actionType}.${channel}`;
}

/**
 * Parse hr_templates row (category compliance_action_draft) into title/body/action_type/channel.
 * Infers action_type and channel from row.code if missing in content.
 */
export function parseTemplate(row: HrTemplateRow): ParsedComplianceTemplate {
  const content = (row.content || {}) as Record<string, unknown>;
  const codeParts = row.code.split(".");
  const action_type =
    (content.action_type as string) ||
    (codeParts.length >= 3 ? codeParts[1]! : "");
  const channel =
    (content.channel as string) ||
    (codeParts.length >= 3 ? codeParts[2]! : "email");
  const title = (content.title as string) || row.name || "";
  const body = (content.body as string) || "";

  return {
    id: row.id,
    code: row.code,
    name: row.name,
    title,
    body,
    action_type,
    channel,
    site_id: row.site_id ?? null,
  };
}

export { ACTION_TYPES as COMPLIANCE_ACTION_TYPES, CHANNELS as COMPLIANCE_CHANNELS };
