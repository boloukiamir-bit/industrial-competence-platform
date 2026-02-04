-- DEPRECATED: Do not run. This migration assumed a dedicated hr_templates schema with
-- template_type/action_type/channel/title/body columns. Use instead:
-- 20260204001000_compliance_action_templates_use_existing_hr_templates.sql
-- which reuses existing public.hr_templates (code, name, category, content jsonb).
--
-- P1.3 Template Drafts: hr_templates for compliance action draft generation (email/SMS/note).
-- No workflow engine. Draft + copy only.
-- RLS: is_org_member read; is_org_admin_or_hr write.

CREATE TABLE IF NOT EXISTS public.hr_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  site_id uuid,
  template_type text NOT NULL,
  action_type text NOT NULL,
  channel text NOT NULL CHECK (channel IN ('email', 'sms', 'note')),
  title text NOT NULL,
  body text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_hr_templates_org ON public.hr_templates(org_id);
CREATE INDEX IF NOT EXISTS idx_hr_templates_org_type_action_channel
  ON public.hr_templates(org_id, template_type, action_type, channel);

-- Unique: one template per (org, site or org-wide, type, action_type, channel)
CREATE UNIQUE INDEX IF NOT EXISTS idx_hr_templates_unique
  ON public.hr_templates (
    org_id,
    COALESCE(site_id, '00000000-0000-0000-0000-000000000000'::uuid),
    template_type,
    action_type,
    channel
  );

ALTER TABLE public.hr_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "hr_templates_select" ON public.hr_templates;
CREATE POLICY "hr_templates_select" ON public.hr_templates
  FOR SELECT USING (public.is_org_member(org_id));

DROP POLICY IF EXISTS "hr_templates_insert" ON public.hr_templates;
CREATE POLICY "hr_templates_insert" ON public.hr_templates
  FOR INSERT WITH CHECK (public.is_org_admin_or_hr(org_id));

DROP POLICY IF EXISTS "hr_templates_update" ON public.hr_templates;
CREATE POLICY "hr_templates_update" ON public.hr_templates
  FOR UPDATE USING (public.is_org_admin_or_hr(org_id));

GRANT SELECT, INSERT, UPDATE ON public.hr_templates TO authenticated;

-- Seed 4 default templates per org (email channel, one per action_type).
-- Idempotent: only insert when no template exists for (org_id, action_type, channel).
-- Variables: {{employee_name}}, {{employee_number}}, {{line}}, {{site_name}}, {{compliance_code}},
-- {{compliance_name}}, {{due_date}}, {{days_left}}, {{action_type_label}}, {{as_of}}, {{owner_email}}
INSERT INTO public.hr_templates (org_id, site_id, template_type, action_type, channel, title, body, is_active)
SELECT o.id, NULL, 'compliance_action_draft', t.action_type, 'email', t.title, t.body, true
FROM public.organizations o
CROSS JOIN (VALUES
  (
    'request_renewal',
    'Request renewal: {{compliance_name}} ({{compliance_code}})',
    E'Hi {{employee_name}},\n\nWe need you to renew your {{compliance_name}} ({{compliance_code}}).\n\nDue date: {{due_date}}\nDays left: {{days_left}}\nSite: {{site_name}}\n\nPlease submit the required documentation as soon as possible. Contact {{owner_email}} if you have questions.\n\nBest regards,\nHR'
  ),
  (
    'request_evidence',
    'Evidence needed: {{compliance_name}} ({{compliance_code}})',
    E'Hi {{employee_name}},\n\nPlease provide evidence for {{compliance_name}} ({{compliance_code}}) by {{due_date}}.\n\nDays left: {{days_left}}\nSite: {{site_name}}\nLine: {{line}}\n\nSubmit via the link provided or contact {{owner_email}} with questions.\n\nBest regards,\nHR'
  ),
  (
    'notify_employee',
    'Reminder: {{compliance_name}} expiring soon',
    E'Hi {{employee_name}},\n\nThis is a reminder that your {{compliance_name}} ({{compliance_code}}) is expiring soon.\n\nDue date: {{due_date}}\nDays left: {{days_left}}\nSite: {{site_name}}\n\nPlease take action to renew before the due date. Contact {{owner_email}} if you need assistance.\n\nBest regards,\nHR'
  ),
  (
    'mark_waived_review',
    'Waived review: {{compliance_name}} ({{compliance_code}})',
    E'Hi {{employee_name}},\n\nYour {{compliance_name}} ({{compliance_code}}) has been marked for waived review.\n\nSite: {{site_name}}\nLine: {{line}}\nAs of: {{as_of}}\n\nIf you have questions, contact {{owner_email}}.\n\nBest regards,\nHR'
  )
) AS t(action_type, title, body)
WHERE NOT EXISTS (
  SELECT 1 FROM public.hr_templates h
  WHERE h.org_id = o.id
    AND h.site_id IS NULL
    AND h.template_type = 'compliance_action_draft'
    AND h.action_type = t.action_type
    AND h.channel = 'email'
);
