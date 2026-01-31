-- Workflow System V1: Templates, Instances, Tasks, Audit Log

-- 1. Workflow Templates (read-only templates list)
CREATE TABLE IF NOT EXISTS wf_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'general',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wf_templates_org ON wf_templates(org_id);

-- 2. Workflow Template Steps
CREATE TABLE IF NOT EXISTS wf_template_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES wf_templates(id) ON DELETE CASCADE,
  step_no INTEGER NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  owner_role TEXT NOT NULL DEFAULT 'hr',
  default_due_days INTEGER NOT NULL DEFAULT 3,
  required BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(template_id, step_no)
);

CREATE INDEX IF NOT EXISTS idx_wf_template_steps_template ON wf_template_steps(template_id);

-- 3. Workflow Instances (started workflows for employees)
CREATE TABLE IF NOT EXISTS wf_instances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  template_id UUID NOT NULL REFERENCES wf_templates(id) ON DELETE RESTRICT,
  employee_id UUID NOT NULL,
  employee_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE,
  completed_at TIMESTAMPTZ,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wf_instances_org ON wf_instances(org_id);
CREATE INDEX IF NOT EXISTS idx_wf_instances_employee ON wf_instances(employee_id);
CREATE INDEX IF NOT EXISTS idx_wf_instances_status ON wf_instances(status);

-- 4. Workflow Instance Tasks (copied from template steps)
CREATE TABLE IF NOT EXISTS wf_instance_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id UUID NOT NULL REFERENCES wf_instances(id) ON DELETE CASCADE,
  step_no INTEGER NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  owner_role TEXT NOT NULL DEFAULT 'hr',
  owner_user_id UUID,
  due_date DATE,
  status TEXT NOT NULL DEFAULT 'todo' CHECK (status IN ('todo', 'in_progress', 'done', 'blocked')),
  completed_at TIMESTAMPTZ,
  completed_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(instance_id, step_no)
);

CREATE INDEX IF NOT EXISTS idx_wf_instance_tasks_instance ON wf_instance_tasks(instance_id);
CREATE INDEX IF NOT EXISTS idx_wf_instance_tasks_status ON wf_instance_tasks(status);

-- 5. Workflow Audit Log
CREATE TABLE IF NOT EXISTS wf_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  action TEXT NOT NULL,
  actor_user_id UUID,
  actor_email TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wf_audit_log_org ON wf_audit_log(org_id);
CREATE INDEX IF NOT EXISTS idx_wf_audit_log_entity ON wf_audit_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_wf_audit_log_created ON wf_audit_log(created_at DESC);

-- RLS Policies
ALTER TABLE wf_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE wf_template_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE wf_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE wf_instance_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE wf_audit_log ENABLE ROW LEVEL SECURITY;

-- Templates: org members can read
CREATE POLICY "wf_templates_select" ON wf_templates
  FOR SELECT USING (is_org_member(org_id));

CREATE POLICY "wf_templates_insert" ON wf_templates
  FOR INSERT WITH CHECK (is_org_admin(org_id));

CREATE POLICY "wf_templates_update" ON wf_templates
  FOR UPDATE USING (is_org_admin(org_id));

-- Template Steps: inherit from template
CREATE POLICY "wf_template_steps_select" ON wf_template_steps
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM wf_templates t WHERE t.id = template_id AND is_org_member(t.org_id))
  );

CREATE POLICY "wf_template_steps_insert" ON wf_template_steps
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM wf_templates t WHERE t.id = template_id AND is_org_admin(t.org_id))
  );

-- Instances: org members can read, HR/admin can write
CREATE POLICY "wf_instances_select" ON wf_instances
  FOR SELECT USING (is_org_member(org_id));

CREATE POLICY "wf_instances_insert" ON wf_instances
  FOR INSERT WITH CHECK (is_org_member(org_id));

CREATE POLICY "wf_instances_update" ON wf_instances
  FOR UPDATE USING (is_org_member(org_id));

-- Instance Tasks: inherit from instance
CREATE POLICY "wf_instance_tasks_select" ON wf_instance_tasks
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM wf_instances i WHERE i.id = instance_id AND is_org_member(i.org_id))
  );

CREATE POLICY "wf_instance_tasks_insert" ON wf_instance_tasks
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM wf_instances i WHERE i.id = instance_id AND is_org_member(i.org_id))
  );

CREATE POLICY "wf_instance_tasks_update" ON wf_instance_tasks
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM wf_instances i WHERE i.id = instance_id AND is_org_member(i.org_id))
  );

-- Audit Log: org members can read
CREATE POLICY "wf_audit_log_select" ON wf_audit_log
  FOR SELECT USING (is_org_member(org_id));

CREATE POLICY "wf_audit_log_insert" ON wf_audit_log
  FOR INSERT WITH CHECK (is_org_member(org_id));

-- Grant service role full access
GRANT ALL ON wf_templates TO service_role;
GRANT ALL ON wf_template_steps TO service_role;
GRANT ALL ON wf_instances TO service_role;
GRANT ALL ON wf_instance_tasks TO service_role;
GRANT ALL ON wf_audit_log TO service_role;
