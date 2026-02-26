-- Certificate renewal job template for one-click HR action from Expiring Soon panel.
-- Placeholders: first_name, last_name, name, employee_number, org_unit, compliance_name, valid_to, status.

INSERT INTO public.hr_templates (org_id, code, name, category, content, is_active)
SELECT
  o.id,
  'CERTIFICATE_RENEWAL',
  'Certificate renewal',
  'job',
  '{"title":"Certificate renewal: {{compliance_name}}","body":"Employee: {{first_name}} {{last_name}} ({{employee_number}})\nCompliance: {{compliance_name}}\nValid to: {{valid_to}}\nStatus: {{status}}\n\nPlease renew the certificate before the expiry date."}'::jsonb,
  true
FROM public.organizations o
ON CONFLICT (org_id, code) DO UPDATE SET
  name = EXCLUDED.name,
  category = EXCLUDED.category,
  content = EXCLUDED.content,
  is_active = EXCLUDED.is_active,
  updated_at = now();
