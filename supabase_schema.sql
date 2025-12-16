-- Industrial Competence Platform - Complete Supabase Schema
-- Run this in Supabase SQL Editor to create all tables

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Employees table (extended with HR Core fields)
CREATE TABLE IF NOT EXISTS employees (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_number TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  first_name TEXT,
  last_name TEXT,
  email TEXT,
  phone TEXT,
  date_of_birth DATE,
  role TEXT,
  line TEXT,
  team TEXT,
  employment_type TEXT DEFAULT 'permanent' CHECK (employment_type IN ('permanent', 'temporary', 'consultant')),
  start_date DATE,
  contract_end_date DATE,
  manager_id UUID REFERENCES employees(id),
  address TEXT,
  city TEXT,
  postal_code TEXT,
  country TEXT DEFAULT 'Sweden',
  org_unit_id UUID,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_employees_line ON employees(line);
CREATE INDEX IF NOT EXISTS idx_employees_team ON employees(team);
CREATE INDEX IF NOT EXISTS idx_employees_manager ON employees(manager_id);
CREATE INDEX IF NOT EXISTS idx_employees_email ON employees(email);
CREATE INDEX IF NOT EXISTS idx_employees_org_unit ON employees(org_unit_id);

-- 2. Skills table
CREATE TABLE IF NOT EXISTS skills (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code TEXT,
  name TEXT UNIQUE NOT NULL,
  description TEXT,
  category TEXT
);

CREATE INDEX IF NOT EXISTS idx_skills_category ON skills(category);

-- 3. Employee Skills (competence levels 0-4)
CREATE TABLE IF NOT EXISTS employee_skills (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
  skill_id UUID REFERENCES skills(id) ON DELETE CASCADE,
  level SMALLINT CHECK (level >= 0 AND level <= 4),
  UNIQUE(employee_id, skill_id)
);

CREATE INDEX IF NOT EXISTS idx_employee_skills_employee ON employee_skills(employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_skills_skill ON employee_skills(skill_id);

-- 4. Role Skill Requirements (defines what's needed per role/line)
CREATE TABLE IF NOT EXISTS role_skill_requirements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  role TEXT NOT NULL,
  line TEXT NOT NULL,
  skill_id UUID REFERENCES skills(id) ON DELETE CASCADE,
  required_level SMALLINT CHECK (required_level >= 0 AND required_level <= 4),
  required_headcount INT DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_role_skill_req_role_line ON role_skill_requirements(role, line);

-- 5. Competence Requirements (alternative structure)
CREATE TABLE IF NOT EXISTS competence_requirements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  line TEXT NOT NULL,
  team TEXT,
  skill_id UUID REFERENCES skills(id) ON DELETE CASCADE,
  min_level SMALLINT CHECK (min_level >= 0 AND min_level <= 4),
  min_headcount INT DEFAULT 1,
  effective_date DATE DEFAULT CURRENT_DATE
);

-- 6. Person Events (People Risk / Compliance Engine)
CREATE TABLE IF NOT EXISTS person_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
  category TEXT NOT NULL CHECK (category IN ('contract', 'medical_check', 'training', 'onboarding', 'offboarding', 'work_env_delegation', 'equipment')),
  title TEXT NOT NULL,
  description TEXT,
  due_date DATE NOT NULL,
  completed_date DATE,
  recurrence TEXT,
  owner_manager_id UUID REFERENCES employees(id),
  status TEXT DEFAULT 'upcoming' CHECK (status IN ('upcoming', 'due_soon', 'overdue', 'completed')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_person_events_employee ON person_events(employee_id);
CREATE INDEX IF NOT EXISTS idx_person_events_manager ON person_events(owner_manager_id);
CREATE INDEX IF NOT EXISTS idx_person_events_due_date ON person_events(due_date);
CREATE INDEX IF NOT EXISTS idx_person_events_status ON person_events(status);
CREATE INDEX IF NOT EXISTS idx_person_events_category ON person_events(category);

-- 7. Equipment
CREATE TABLE IF NOT EXISTS equipment (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  serial_number TEXT UNIQUE NOT NULL,
  category TEXT,
  required_for_role TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Employee Equipment assignments
CREATE TABLE IF NOT EXISTS employee_equipment (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
  equipment_id UUID REFERENCES equipment(id) ON DELETE CASCADE,
  assigned_date DATE DEFAULT CURRENT_DATE,
  return_date DATE,
  status TEXT DEFAULT 'assigned' CHECK (status IN ('assigned', 'returned', 'lost'))
);

CREATE INDEX IF NOT EXISTS idx_employee_equipment_employee ON employee_equipment(employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_equipment_equipment ON employee_equipment(equipment_id);

-- 9. Documents (extended types)
CREATE TABLE IF NOT EXISTS documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  type TEXT CHECK (type IN ('contract', 'handbook', 'policy', 'certificate', 'employee_handbook', 'manager_handbook', 'review_protocol', 'other')),
  url TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  valid_to DATE
);

CREATE INDEX IF NOT EXISTS idx_documents_employee ON documents(employee_id);
CREATE INDEX IF NOT EXISTS idx_documents_type ON documents(type);

-- 10. News Posts
CREATE TABLE IF NOT EXISTS news_posts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES employees(id),
  is_pinned BOOLEAN DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_news_posts_created_at ON news_posts(created_at DESC);

-- 11. Whistleblower Reports
CREATE TABLE IF NOT EXISTS whistleblower_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  reporter_id UUID REFERENCES employees(id),
  channel TEXT DEFAULT 'web',
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  status TEXT DEFAULT 'new' CHECK (status IN ('new', 'in_review', 'closed'))
);

-- 12. Review Templates (Performance / Medarbetarsamtal)
CREATE TABLE IF NOT EXISTS review_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  audience TEXT CHECK (audience IN ('employee', 'manager', 'both')),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 13. Employee Reviews (Performance reviews / Medarbetarsamtal)
CREATE TABLE IF NOT EXISTS employee_reviews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
  manager_id UUID REFERENCES employees(id),
  template_id UUID REFERENCES review_templates(id),
  review_date DATE NOT NULL,
  period_start DATE,
  period_end DATE,
  overall_rating SMALLINT CHECK (overall_rating >= 1 AND overall_rating <= 5),
  summary TEXT,
  goals JSONB,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_employee_reviews_employee ON employee_reviews(employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_reviews_manager ON employee_reviews(manager_id);
CREATE INDEX IF NOT EXISTS idx_employee_reviews_date ON employee_reviews(review_date DESC);

-- 14. Salary Records
CREATE TABLE IF NOT EXISTS salary_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
  effective_from DATE NOT NULL,
  salary_amount_sek NUMERIC(12, 2) NOT NULL,
  salary_type TEXT CHECK (salary_type IN ('monthly', 'hourly')),
  position_title TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES employees(id)
);

CREATE INDEX IF NOT EXISTS idx_salary_records_employee ON salary_records(employee_id);
CREATE INDEX IF NOT EXISTS idx_salary_records_effective ON salary_records(effective_from DESC);

-- 15. Salary Revisions
CREATE TABLE IF NOT EXISTS salary_revisions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
  revision_date DATE NOT NULL,
  previous_salary_sek NUMERIC(12, 2) NOT NULL,
  new_salary_sek NUMERIC(12, 2) NOT NULL,
  salary_type TEXT CHECK (salary_type IN ('monthly', 'hourly')),
  reason TEXT,
  decided_by_manager_id UUID REFERENCES employees(id),
  document_id UUID REFERENCES documents(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_salary_revisions_employee ON salary_revisions(employee_id);
CREATE INDEX IF NOT EXISTS idx_salary_revisions_date ON salary_revisions(revision_date DESC);

-- 16. GDPR Access Logs
CREATE TABLE IF NOT EXISTS gdpr_access_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
  accessed_by_user_id UUID,
  accessed_at TIMESTAMPTZ DEFAULT NOW(),
  access_type TEXT CHECK (access_type IN ('view_profile', 'export_data', 'download_document', 'update_profile', 'delete_profile')),
  metadata JSONB
);

CREATE INDEX IF NOT EXISTS idx_gdpr_access_logs_employee ON gdpr_access_logs(employee_id);
CREATE INDEX IF NOT EXISTS idx_gdpr_access_logs_accessed_at ON gdpr_access_logs(accessed_at DESC);

-- 17. One-to-One Meetings (1:1 / Medarbetarsamtal)
CREATE TABLE IF NOT EXISTS one_to_one_meetings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
  manager_id UUID REFERENCES employees(id),
  scheduled_at TIMESTAMPTZ NOT NULL,
  duration_minutes SMALLINT,
  location TEXT,
  status TEXT DEFAULT 'planned' CHECK (status IN ('planned', 'in_progress', 'completed', 'cancelled')),
  template_name TEXT,
  shared_agenda TEXT,
  employee_notes_private TEXT,
  manager_notes_private TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_one_to_one_employee ON one_to_one_meetings(employee_id);
CREATE INDEX IF NOT EXISTS idx_one_to_one_manager ON one_to_one_meetings(manager_id);
CREATE INDEX IF NOT EXISTS idx_one_to_one_scheduled ON one_to_one_meetings(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_one_to_one_status ON one_to_one_meetings(status);

-- 18. One-to-One Actions
CREATE TABLE IF NOT EXISTS one_to_one_actions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  meeting_id UUID REFERENCES one_to_one_meetings(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  owner_type TEXT CHECK (owner_type IN ('employee', 'manager')),
  is_completed BOOLEAN DEFAULT false,
  due_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_one_to_one_actions_meeting ON one_to_one_actions(meeting_id);
CREATE INDEX IF NOT EXISTS idx_one_to_one_actions_due ON one_to_one_actions(due_date);

-- 19. Email Outbox (Notification Engine)
CREATE TABLE IF NOT EXISTS email_outbox (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  to_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  sent_at TIMESTAMPTZ,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
  error_message TEXT,
  meta JSONB
);

CREATE INDEX IF NOT EXISTS idx_email_outbox_status ON email_outbox(status);
CREATE INDEX IF NOT EXISTS idx_email_outbox_created ON email_outbox(created_at DESC);

-- 20. Org Units (Organization Structure)
CREATE TABLE IF NOT EXISTS org_units (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  code TEXT,
  parent_id UUID REFERENCES org_units(id),
  type TEXT CHECK (type IN ('company', 'site', 'department', 'team', 'division', 'unit')),
  manager_employee_id UUID REFERENCES employees(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_org_units_parent ON org_units(parent_id);
CREATE INDEX IF NOT EXISTS idx_org_units_manager ON org_units(manager_employee_id);
CREATE INDEX IF NOT EXISTS idx_org_units_type ON org_units(type);

-- Add FK for employees.org_unit_id
ALTER TABLE employees ADD CONSTRAINT fk_employees_org_unit 
  FOREIGN KEY (org_unit_id) REFERENCES org_units(id) ON DELETE SET NULL;

-- 21. Absences (for HR Analytics)
CREATE TABLE IF NOT EXISTS absences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
  type TEXT CHECK (type IN ('sick', 'vacation', 'parental', 'leave', 'other')),
  from_date DATE NOT NULL,
  to_date DATE NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_absences_employee ON absences(employee_id);
CREATE INDEX IF NOT EXISTS idx_absences_dates ON absences(from_date, to_date);
CREATE INDEX IF NOT EXISTS idx_absences_type ON absences(type);

-- 22. Users (for RBAC)
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id UUID REFERENCES employees(id) ON DELETE SET NULL,
  email TEXT UNIQUE NOT NULL,
  role TEXT DEFAULT 'EMPLOYEE' CHECK (role IN ('HR_ADMIN', 'MANAGER', 'EMPLOYEE')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_employee ON users(employee_id);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- 23. HR Workflow Instances
CREATE TABLE IF NOT EXISTS hr_workflow_instances (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  template_id TEXT NOT NULL CHECK (template_id IN ('sick_leave', 'rehab', 'parental_leave', 'reboarding', 'onboarding', 'offboarding')),
  template_name TEXT NOT NULL,
  employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
  employee_name TEXT,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  due_date DATE,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
  steps JSONB NOT NULL DEFAULT '[]',
  created_by UUID REFERENCES users(id),
  completed_at TIMESTAMPTZ,
  notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_hr_workflow_instances_employee ON hr_workflow_instances(employee_id);
CREATE INDEX IF NOT EXISTS idx_hr_workflow_instances_status ON hr_workflow_instances(status);
CREATE INDEX IF NOT EXISTS idx_hr_workflow_instances_template ON hr_workflow_instances(template_id);
CREATE INDEX IF NOT EXISTS idx_hr_workflow_instances_started ON hr_workflow_instances(started_at DESC);

-- Seed default review templates
INSERT INTO review_templates (name, description, audience, is_active)
VALUES 
  ('Årligt medarbetarsamtal', 'Årlig uppföljning av prestation, utveckling och trivsel', 'both', true),
  ('Lönesamtal', 'Samtal inför lönerevision', 'both', true),
  ('Provanställningssamtal', 'Utvärdering av provanställning', 'both', true)
ON CONFLICT DO NOTHING;
