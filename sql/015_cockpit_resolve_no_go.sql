-- Cockpit Resolve NO-GO - Schema Updates
-- Run this after 006_cockpit_tables.sql

-- 1. Add columns to shifts table for date/type/line tracking
ALTER TABLE shifts 
  ADD COLUMN IF NOT EXISTS shift_date DATE,
  ADD COLUMN IF NOT EXISTS shift_type TEXT CHECK (shift_type IN ('Day', 'Evening', 'Night')),
  ADD COLUMN IF NOT EXISTS line TEXT;

-- Create unique index for shifts: (org_id, shift_date, shift_type, line)
CREATE UNIQUE INDEX IF NOT EXISTS idx_shifts_org_date_type_line 
  ON shifts(org_id, shift_date, shift_type, line) 
  WHERE shift_date IS NOT NULL AND shift_type IS NOT NULL AND line IS NOT NULL;

-- 2. Create unique index for shift_assignments: (org_id, shift_id, station_id)
CREATE UNIQUE INDEX IF NOT EXISTS idx_shift_assignments_org_shift_station 
  ON shift_assignments(org_id, shift_id, station_id);

-- 3. Create execution_decisions table if it doesn't exist
CREATE TABLE IF NOT EXISTS execution_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  site_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  decision_type TEXT NOT NULL CHECK (decision_type IN ('resolve_no_go', 'accept_risk', 'swap_operator', 'assign_operator', 'call_in', 'escalate')),
  target_type TEXT NOT NULL CHECK (target_type IN ('line_shift', 'assignment', 'employee', 'shift_assignment')),
  target_id UUID NOT NULL,
  reason TEXT,
  root_cause JSONB,
  actions JSONB,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'superseded')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Unique index for idempotency: (decision_type, target_type, target_id) where status='active'
CREATE UNIQUE INDEX IF NOT EXISTS idx_execution_decisions_idempotent 
  ON execution_decisions(decision_type, target_type, target_id) 
  WHERE status = 'active';

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_execution_decisions_org ON execution_decisions(org_id);
CREATE INDEX IF NOT EXISTS idx_execution_decisions_target ON execution_decisions(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_execution_decisions_status ON execution_decisions(status);
CREATE INDEX IF NOT EXISTS idx_execution_decisions_created ON execution_decisions(created_at DESC);

-- Enable RLS
ALTER TABLE execution_decisions ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can access execution_decisions for their org
CREATE POLICY "execution_decisions_org_access" ON execution_decisions
  FOR ALL USING (is_org_member(org_id));

-- 4. Add active_org_id and active_site_id to profiles if they don't exist
ALTER TABLE profiles 
  ADD COLUMN IF NOT EXISTS active_org_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS active_site_id UUID REFERENCES organizations(id) ON DELETE SET NULL;

-- Index for profiles active_org_id
CREATE INDEX IF NOT EXISTS idx_profiles_active_org ON profiles(active_org_id);
CREATE INDEX IF NOT EXISTS idx_profiles_active_site ON profiles(active_site_id);
