-- Workflow System V1 Upgrades: Task Forms, Sign-off, Enhanced Fields
-- Run this migration in Supabase SQL Editor

-- 1. Add notes and evidence_url to wf_instance_tasks
ALTER TABLE wf_instance_tasks 
ADD COLUMN IF NOT EXISTS notes TEXT,
ADD COLUMN IF NOT EXISTS evidence_url TEXT;

-- 2. Add sign-off columns to wf_instances
ALTER TABLE wf_instances
ADD COLUMN IF NOT EXISTS supervisor_signed_by UUID,
ADD COLUMN IF NOT EXISTS supervisor_signed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS supervisor_comment TEXT,
ADD COLUMN IF NOT EXISTS hr_signed_by UUID,
ADD COLUMN IF NOT EXISTS hr_signed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS hr_comment TEXT,
ADD COLUMN IF NOT EXISTS requires_hr_signoff BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

-- 3. Add index for owner_user_id to support My Tasks queries
CREATE INDEX IF NOT EXISTS idx_wf_instance_tasks_owner ON wf_instance_tasks(owner_user_id);

-- 4. Create cross-training template if it doesn't exist (for Spaljisten)
INSERT INTO wf_templates (id, org_id, name, description, category, is_active)
SELECT 
  'cccc0001-0001-0001-0001-000000000001'::uuid,
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890'::uuid,
  'Cross-training Workflow',
  'Start cross-training for an employee to address skill gaps at a critical station',
  'competence',
  true
WHERE NOT EXISTS (
  SELECT 1 FROM wf_templates WHERE id = 'cccc0001-0001-0001-0001-000000000001'
);

-- 5. Add steps for cross-training template
INSERT INTO wf_template_steps (template_id, step_no, title, description, owner_role, default_due_days, required)
SELECT 
  'cccc0001-0001-0001-0001-000000000001'::uuid,
  step_no,
  title,
  description,
  owner_role,
  default_due_days,
  required
FROM (VALUES
  (1, 'Identify training needs', 'Assess current skill level and define target competence', 'manager', 2, true),
  (2, 'Assign trainer/mentor', 'Select experienced employee to provide training', 'manager', 3, true),
  (3, 'Create training schedule', 'Plan training sessions and timeline', 'hr', 5, true),
  (4, 'Conduct training', 'Employee completes hands-on training at station', 'manager', 14, true),
  (5, 'Assess competence', 'Evaluate employee skill level after training', 'manager', 2, true),
  (6, 'Update skill matrix', 'Record new competence level in system', 'hr', 1, true)
) AS t(step_no, title, description, owner_role, default_due_days, required)
WHERE NOT EXISTS (
  SELECT 1 FROM wf_template_steps WHERE template_id = 'cccc0001-0001-0001-0001-000000000001'
);
