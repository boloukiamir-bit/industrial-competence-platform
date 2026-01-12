-- Milestone 1: Production Leader OS - Cockpit Tables
-- All tables include org_id for multi-tenancy

-- Stations table (work stations in the facility)
CREATE TABLE IF NOT EXISTS stations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  code TEXT,
  line TEXT,
  area TEXT,
  capacity INTEGER DEFAULT 1,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Shifts table (Day/Evening/Night shifts)
CREATE TABLE IF NOT EXISTS shifts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  code TEXT,
  start_time TIME,
  end_time TIME,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Shift assignments (employee assigned to station for a shift)
CREATE TABLE IF NOT EXISTS shift_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  shift_id UUID REFERENCES shifts(id) ON DELETE CASCADE,
  station_id UUID REFERENCES stations(id) ON DELETE CASCADE,
  employee_id UUID REFERENCES employees(id) ON DELETE SET NULL,
  assignment_date DATE NOT NULL,
  status TEXT DEFAULT 'assigned',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Compliance items (certifications, trainings, medical checks with expiry)
CREATE TABLE IF NOT EXISTS compliance_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  issued_date DATE,
  expiry_date DATE,
  status TEXT DEFAULT 'valid',
  document_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Actions table (tasks across Ops/People/Safety domains)
CREATE TABLE IF NOT EXISTS actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  domain TEXT NOT NULL,
  severity TEXT DEFAULT 'medium',
  status TEXT DEFAULT 'open',
  due_date DATE,
  completed_date DATE,
  owner_id UUID REFERENCES employees(id) ON DELETE SET NULL,
  related_employee_id UUID REFERENCES employees(id) ON DELETE SET NULL,
  related_station_id UUID REFERENCES stations(id) ON DELETE SET NULL,
  impact TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Safety observations
CREATE TABLE IF NOT EXISTS safety_observations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  severity TEXT DEFAULT 'low',
  location TEXT,
  station_id UUID REFERENCES stations(id) ON DELETE SET NULL,
  reported_by UUID REFERENCES employees(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'open',
  action_id UUID REFERENCES actions(id) ON DELETE SET NULL,
  observed_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Station role requirements (for replacement suggestions)
CREATE TABLE IF NOT EXISTS station_role_requirements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  station_id UUID REFERENCES stations(id) ON DELETE CASCADE,
  skill_id UUID,
  required_level INTEGER DEFAULT 1,
  is_mandatory BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Rehab cases placeholder (for Milestone 3)
CREATE TABLE IF NOT EXISTS rehab_cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'active',
  start_date DATE,
  next_action_date DATE,
  owner_id UUID REFERENCES employees(id) ON DELETE SET NULL,
  notes TEXT,
  is_confidential BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS Policies
ALTER TABLE stations ENABLE ROW LEVEL SECURITY;
ALTER TABLE shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE shift_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE compliance_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE safety_observations ENABLE ROW LEVEL SECURITY;
ALTER TABLE station_role_requirements ENABLE ROW LEVEL SECURITY;
ALTER TABLE rehab_cases ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for org membership (using existing is_org_member function)
CREATE POLICY "stations_org_access" ON stations
  FOR ALL USING (is_org_member(org_id));

CREATE POLICY "shifts_org_access" ON shifts
  FOR ALL USING (is_org_member(org_id));

CREATE POLICY "shift_assignments_org_access" ON shift_assignments
  FOR ALL USING (is_org_member(org_id));

CREATE POLICY "compliance_items_org_access" ON compliance_items
  FOR ALL USING (is_org_member(org_id));

CREATE POLICY "actions_org_access" ON actions
  FOR ALL USING (is_org_member(org_id));

CREATE POLICY "safety_observations_org_access" ON safety_observations
  FOR ALL USING (is_org_member(org_id));

CREATE POLICY "station_role_requirements_org_access" ON station_role_requirements
  FOR ALL USING (is_org_member(org_id));

CREATE POLICY "rehab_cases_org_access" ON rehab_cases
  FOR ALL USING (is_org_member(org_id));

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_stations_org ON stations(org_id);
CREATE INDEX IF NOT EXISTS idx_shifts_org ON shifts(org_id);
CREATE INDEX IF NOT EXISTS idx_shift_assignments_org ON shift_assignments(org_id);
CREATE INDEX IF NOT EXISTS idx_shift_assignments_date ON shift_assignments(assignment_date);
CREATE INDEX IF NOT EXISTS idx_compliance_items_org ON compliance_items(org_id);
CREATE INDEX IF NOT EXISTS idx_compliance_items_expiry ON compliance_items(expiry_date);
CREATE INDEX IF NOT EXISTS idx_actions_org ON actions(org_id);
CREATE INDEX IF NOT EXISTS idx_actions_status ON actions(status);
CREATE INDEX IF NOT EXISTS idx_actions_due_date ON actions(due_date);
CREATE INDEX IF NOT EXISTS idx_safety_observations_org ON safety_observations(org_id);
CREATE INDEX IF NOT EXISTS idx_rehab_cases_org ON rehab_cases(org_id);
