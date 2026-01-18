-- Add production workflow fields to wf_instances
-- Run this migration after 012_workflow_system.sql

-- Add nullable columns for production workflows
ALTER TABLE wf_instances 
  ADD COLUMN IF NOT EXISTS shift_date DATE,
  ADD COLUMN IF NOT EXISTS shift_type TEXT CHECK (shift_type IS NULL OR shift_type IN ('Day', 'Evening', 'Night')),
  ADD COLUMN IF NOT EXISTS area_code TEXT;

-- Make employee_id nullable for production workflows that don't require an employee
ALTER TABLE wf_instances ALTER COLUMN employee_id DROP NOT NULL;
ALTER TABLE wf_instances ALTER COLUMN employee_name DROP NOT NULL;

-- Add indexes for querying by shift/area
CREATE INDEX IF NOT EXISTS idx_wf_instances_shift ON wf_instances(shift_date, shift_type);
CREATE INDEX IF NOT EXISTS idx_wf_instances_area ON wf_instances(area_code);
