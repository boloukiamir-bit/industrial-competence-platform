-- P1.3 Template Drafts (patch): reuse existing public.hr_templates schema
-- category = 'compliance_action_draft'
-- code = 'compliance_action_draft.<action_type>.<channel>'
-- content = { title, body, action_type, channel, template_type }

create index if not exists idx_hr_templates_org_category_active
  on public.hr_templates(org_id, category, is_active);

create index if not exists idx_hr_templates_org_site_category
  on public.hr_templates(org_id, site_id, category);

insert into public.hr_templates (org_id, site_id, code, name, category, content, is_active)
select
  o.id as org_id,
  null::uuid as site_id,
  t.code,
  t.name,
  'compliance_action_draft' as category,
  jsonb_build_object(
    'template_type','compliance_action_draft',
    'action_type', t.action_type,
    'channel', t.channel,
    'title', t.title,
    'body', t.body
  ) as content,
  true as is_active
from public.organizations o
cross join (values
  (
    'request_renewal', 'email',
    'compliance_action_draft.request_renewal.email',
    'Request renewal',
    'Request renewal: {{compliance_name}} ({{compliance_code}})',
    E'Hi {{employee_name}},\n\nWe need you to renew your {{compliance_name}} ({{compliance_code}}).\n\nDue date: {{due_date}}\nDays left: {{days_left}}\nSite: {{site_name}}\n\nPlease submit the required documentation as soon as possible. Contact {{owner_email}} if you have questions.\n\nBest regards,\nHR'
  ),
  (
    'request_evidence','email',
    'compliance_action_draft.request_evidence.email',
    'Request evidence',
    'Evidence needed: {{compliance_name}} ({{compliance_code}})',
    E'Hi {{employee_name}},\n\nPlease provide evidence for {{compliance_name}} ({{compliance_code}}) by {{due_date}}.\n\nDays left: {{days_left}}\nSite: {{site_name}}\nLine: {{line}}\n\nSubmit via the link provided or contact {{owner_email}} with questions.\n\nBest regards,\nHR'
  ),
  (
    'notify_employee','email',
    'compliance_action_draft.notify_employee.email',
    'Notify employee',
    'Reminder: {{compliance_name}} expiring soon',
    E'Hi {{employee_name}},\n\nThis is a reminder that your {{compliance_name}} ({{compliance_code}}) is expiring soon.\n\nDue date: {{due_date}}\nDays left: {{days_left}}\nSite: {{site_name}}\n\nPlease take action to renew before the due date. Contact {{owner_email}} if you need assistance.\n\nBest regards,\nHR'
  ),
  (
    'mark_waived_review','email',
    'compliance_action_draft.mark_waived_review.email',
    'Waived review',
    'Waived review: {{compliance_name}} ({{compliance_code}})',
    E'Hi {{employee_name}},\n\nYour {{compliance_name}} ({{compliance_code}}) has been marked for waived review.\n\nSite: {{site_name}}\nLine: {{line}}\nAs of: {{as_of}}\n\nIf you have questions, contact {{owner_email}}.\n\nBest regards,\nHR'
  )
) as t(action_type, channel, code, name, title, body)
where not exists (
  select 1 from public.hr_templates h
  where h.org_id = o.id
    and h.code = t.code
);
