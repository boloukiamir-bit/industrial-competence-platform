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

-- 4. Cross-training template seeding REMOVED
-- SECURITY FIX: Hardcoded org seeding has been removed.
-- Use the /api/workflows/setup endpoint to seed templates for a specific org.
-- See sql/015_workflow_production_templates.sql for the seed_production_workflow_templates() function.
