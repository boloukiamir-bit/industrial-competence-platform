-- Intervention templates for cockpit IssueDrawer "Plan" (STAFFING_ACTION, COMPLIANCE_ACTION, TRAINING_ACTION).
-- Placeholders: first_name, last_name, name, employee_number, org_unit, station_name, station_id, date, shift_code, line, issue_type, root_cause_primary.

INSERT INTO public.hr_templates (org_id, code, name, category, content, is_active)
SELECT o.id, 'STAFFING_ACTION', 'Staffing intervention', 'job',
  '{"title":"Staffing: {{station_name}}","body":"Station: {{station_name}} ({{station_id}})\nDate: {{date}} · Shift: {{shift_code}} · Line: {{line}}\nIssue type: {{issue_type}}\nRoot cause: {{root_cause_primary}}\n\nAssignee: {{first_name}} {{last_name}} ({{employee_number}}). Follow up on staffing for this station/shift."}'::jsonb,
  true
FROM public.organizations o
ON CONFLICT (org_id, code) DO UPDATE SET name = EXCLUDED.name, category = EXCLUDED.category, content = EXCLUDED.content, is_active = EXCLUDED.is_active, updated_at = now();

INSERT INTO public.hr_templates (org_id, code, name, category, content, is_active)
SELECT o.id, 'COMPLIANCE_ACTION', 'Compliance intervention', 'job',
  '{"title":"Compliance: {{station_name}}","body":"Station: {{station_name}} ({{station_id}})\nDate: {{date}} · Shift: {{shift_code}} · Line: {{line}}\nIssue type: {{issue_type}}\nRoot cause: {{root_cause_primary}}\n\nAssignee: {{first_name}} {{last_name}} ({{employee_number}}). Address compliance/illegal status for this station."}'::jsonb,
  true
FROM public.organizations o
ON CONFLICT (org_id, code) DO UPDATE SET name = EXCLUDED.name, category = EXCLUDED.category, content = EXCLUDED.content, is_active = EXCLUDED.is_active, updated_at = now();

INSERT INTO public.hr_templates (org_id, code, name, category, content, is_active)
SELECT o.id, 'TRAINING_ACTION', 'Training / competence intervention', 'job',
  '{"title":"Training: {{station_name}}","body":"Station: {{station_name}} ({{station_id}})\nDate: {{date}} · Shift: {{shift_code}} · Line: {{line}}\nIssue type: {{issue_type}}\nRoot cause: {{root_cause_primary}}\n\nAssignee: {{first_name}} {{last_name}} ({{employee_number}}). Plan training or competence action for this station."}'::jsonb,
  true
FROM public.organizations o
ON CONFLICT (org_id, code) DO UPDATE SET name = EXCLUDED.name, category = EXCLUDED.category, content = EXCLUDED.content, is_active = EXCLUDED.is_active, updated_at = now();
