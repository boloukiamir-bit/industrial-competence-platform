/**
 * HR template notes: placeholder rendering and default body by template code.
 * Centralized for Create Job modal and PDF generation.
 */

export type PlaceholderContext = {
  employee_name: string;
  employee_no: string;
  employee_line: string;
  site_name: string;
  org_name: string;
  today: string;
  due_date: string;
};

const PLACEHOLDERS: (keyof PlaceholderContext)[] = [
  "employee_name",
  "employee_no",
  "employee_line",
  "site_name",
  "org_name",
  "today",
  "due_date",
];

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function renderNotes(template: string, context: Partial<PlaceholderContext>): string {
  let out = template;
  for (const key of PLACEHOLDERS) {
    const value = context[key] ?? "";
    out = out.replace(new RegExp(escapeRe(`{{${key}}}`), "g"), value);
  }
  return out;
}

/** Default notes body by template code (when template has no default_notes/body). */
const DEFAULT_NOTES_BY_CODE: Record<string, string> = {
  CUST_IKEA_001: "Employee {{employee_name}} ({{employee_no}}) acknowledges that they have read and understood IKEA Business Ethics requirements and commit to comply. This acknowledgement is recorded for {{org_name}} / {{site_name}}. Date: {{today}}. Due: {{due_date}}.",
  "CUST-IKEA-001": "Employee {{employee_name}} ({{employee_no}}) acknowledges that they have read and understood IKEA Business Ethics requirements and commit to comply. This acknowledgement is recorded for {{org_name}} / {{site_name}}. Date: {{today}}. Due: {{due_date}}.",
  IKEA_BUSINESS_ETHICS: "Employee {{employee_name}} ({{employee_no}}) acknowledges that they have read and understood IKEA Business Ethics requirements and commit to comply. This acknowledgement is recorded for {{org_name}} / {{site_name}}. Date: {{today}}. Due: {{due_date}}.",
  IKEA_IWAY: "Employee {{employee_name}} ({{employee_no}}) acknowledges IWAY requirements for {{org_name}} / {{site_name}}. Date: {{today}}. Due: {{due_date}}.",
  MED_001: "Medical fitness clearance for {{employee_name}} ({{employee_no}}), line/area: {{employee_line}}. Organisation: {{org_name}}. Date: {{today}}. Due: {{due_date}}.",
  "MED-001": "Medical fitness clearance for {{employee_name}} ({{employee_no}}), line/area: {{employee_line}}. Organisation: {{org_name}}. Date: {{today}}. Due: {{due_date}}.",
  MEDICAL_CHECK: "Medical fitness clearance for {{employee_name}} ({{employee_no}}), line/area: {{employee_line}}. Organisation: {{org_name}}. Date: {{today}}. Due: {{due_date}}.",
  SAF_CORE_001: "Fire Safety & First Aid certification for {{employee_name}} ({{employee_no}}), {{org_name}} / {{site_name}}. Date: {{today}}. Due: {{due_date}}.",
  "SAF-CORE-001": "Fire Safety & First Aid certification for {{employee_name}} ({{employee_no}}), {{org_name}} / {{site_name}}. Date: {{today}}. Due: {{due_date}}.",
};

const EMPTY_PLACEHOLDER_HINT = "Select employee to auto-fill…";

/**
 * Returns the raw template string for notes (with placeholders).
 * Prefer template content.default_notes or content.body, else fallback by template_code.
 */
export function getDefaultNotesForTemplate(
  templateCode: string,
  templateContent?: { default_notes?: string; body?: string } | null
): string {
  const fromContent =
    templateContent?.default_notes ?? (templateContent as { body?: string } | undefined)?.body;
  if (typeof fromContent === "string" && fromContent.trim()) {
    return fromContent.trim();
  }
  const byCode = DEFAULT_NOTES_BY_CODE[templateCode];
  if (byCode) return byCode;
  return DEFAULT_NOTES_BY_CODE["CUST-IKEA-001"] ?? "";
}

/**
 * Renders notes with context. If template is empty, returns hint when no employee.
 */
export function renderNotesForCreate(
  templateCode: string,
  templateContent: { default_notes?: string; body?: string } | null | undefined,
  context: Partial<PlaceholderContext> | null
): string {
  const raw = getDefaultNotesForTemplate(templateCode, templateContent);
  if (!raw) return "";
  if (!context || (!context.employee_name && !context.employee_no)) {
    return EMPTY_PLACEHOLDER_HINT;
  }
  const fullContext: Partial<PlaceholderContext> = {
    employee_name: context.employee_name ?? "",
    employee_no: context.employee_no ?? "",
    employee_line: context.employee_line ?? "",
    site_name: context.site_name ?? "",
    org_name: context.org_name ?? "",
    today: context.today ?? new Date().toISOString().slice(0, 10),
    due_date: context.due_date ?? "",
  };
  return renderNotes(raw, fullContext);
}

export { EMPTY_PLACEHOLDER_HINT };
