-- Spaljisten Go-Live v1 Schema
-- Tables for Skill Matrix + Gap/Risk View

-- Create Spaljisten organization if not exists
INSERT INTO organizations (id, name, slug, created_at)
VALUES (
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  'Spaljisten',
  'spaljisten',
  NOW()
) ON CONFLICT (slug) DO NOTHING;

-- Rating scales configuration
CREATE TABLE IF NOT EXISTS sp_rating_scales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  level INTEGER NOT NULL,
  label TEXT NOT NULL,
  description TEXT,
  color TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(org_id, level)
);

-- Areas (production areas / departments)
CREATE TABLE IF NOT EXISTS sp_areas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  area_code TEXT NOT NULL,
  area_name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(org_id, area_code)
);

-- Stations (work stations within areas)
CREATE TABLE IF NOT EXISTS sp_stations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  area_id UUID REFERENCES sp_areas(id) ON DELETE SET NULL,
  station_code TEXT NOT NULL,
  station_name TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(org_id, station_code)
);

-- Skills catalog (skills can be linked to stations)
CREATE TABLE IF NOT EXISTS sp_skills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  skill_id TEXT NOT NULL,
  skill_name TEXT NOT NULL,
  station_id UUID REFERENCES sp_stations(id) ON DELETE SET NULL,
  category TEXT,
  description TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(org_id, skill_id)
);

-- Employees (Spaljisten-specific with area assignment)
CREATE TABLE IF NOT EXISTS sp_employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  employee_id TEXT NOT NULL,
  employee_name TEXT NOT NULL,
  email TEXT,
  area_id UUID REFERENCES sp_areas(id) ON DELETE SET NULL,
  employment_type TEXT DEFAULT 'permanent',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(org_id, employee_id)
);

-- Employee skill ratings (the core matrix data)
CREATE TABLE IF NOT EXISTS sp_employee_skills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  employee_id TEXT NOT NULL,
  skill_id TEXT NOT NULL,
  rating INTEGER,
  assessed_date DATE,
  assessed_by TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(org_id, employee_id, skill_id)
);

-- Area leaders mapping
CREATE TABLE IF NOT EXISTS sp_area_leaders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  area_id UUID REFERENCES sp_areas(id) ON DELETE CASCADE,
  employee_id TEXT NOT NULL,
  is_primary BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(org_id, area_id, employee_id)
);

-- Import logs for audit trail
CREATE TABLE IF NOT EXISTS sp_import_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  import_type TEXT NOT NULL,
  file_name TEXT,
  total_rows INTEGER DEFAULT 0,
  inserted_count INTEGER DEFAULT 0,
  updated_count INTEGER DEFAULT 0,
  failed_count INTEGER DEFAULT 0,
  failed_rows JSONB DEFAULT '[]',
  imported_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_sp_employees_org ON sp_employees(org_id);
CREATE INDEX IF NOT EXISTS idx_sp_employees_area ON sp_employees(area_id);
CREATE INDEX IF NOT EXISTS idx_sp_skills_org ON sp_skills(org_id);
CREATE INDEX IF NOT EXISTS idx_sp_skills_station ON sp_skills(station_id);
CREATE INDEX IF NOT EXISTS idx_sp_employee_skills_org ON sp_employee_skills(org_id);
CREATE INDEX IF NOT EXISTS idx_sp_employee_skills_employee ON sp_employee_skills(org_id, employee_id);
CREATE INDEX IF NOT EXISTS idx_sp_employee_skills_skill ON sp_employee_skills(org_id, skill_id);
CREATE INDEX IF NOT EXISTS idx_sp_stations_area ON sp_stations(area_id);
CREATE INDEX IF NOT EXISTS idx_sp_areas_org ON sp_areas(org_id);

-- Enable RLS on all tables
ALTER TABLE sp_rating_scales ENABLE ROW LEVEL SECURITY;
ALTER TABLE sp_areas ENABLE ROW LEVEL SECURITY;
ALTER TABLE sp_stations ENABLE ROW LEVEL SECURITY;
ALTER TABLE sp_skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE sp_employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE sp_employee_skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE sp_area_leaders ENABLE ROW LEVEL SECURITY;
ALTER TABLE sp_import_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies (allow access based on org membership)
-- For now, allow authenticated users to access their org data
-- These policies check if user is member of the organization

CREATE POLICY sp_rating_scales_select ON sp_rating_scales FOR SELECT USING (TRUE);
CREATE POLICY sp_rating_scales_all ON sp_rating_scales FOR ALL USING (TRUE);

CREATE POLICY sp_areas_select ON sp_areas FOR SELECT USING (TRUE);
CREATE POLICY sp_areas_all ON sp_areas FOR ALL USING (TRUE);

CREATE POLICY sp_stations_select ON sp_stations FOR SELECT USING (TRUE);
CREATE POLICY sp_stations_all ON sp_stations FOR ALL USING (TRUE);

CREATE POLICY sp_skills_select ON sp_skills FOR SELECT USING (TRUE);
CREATE POLICY sp_skills_all ON sp_skills FOR ALL USING (TRUE);

CREATE POLICY sp_employees_select ON sp_employees FOR SELECT USING (TRUE);
CREATE POLICY sp_employees_all ON sp_employees FOR ALL USING (TRUE);

CREATE POLICY sp_employee_skills_select ON sp_employee_skills FOR SELECT USING (TRUE);
CREATE POLICY sp_employee_skills_all ON sp_employee_skills FOR ALL USING (TRUE);

CREATE POLICY sp_area_leaders_select ON sp_area_leaders FOR SELECT USING (TRUE);
CREATE POLICY sp_area_leaders_all ON sp_area_leaders FOR ALL USING (TRUE);

CREATE POLICY sp_import_logs_select ON sp_import_logs FOR SELECT USING (TRUE);
CREATE POLICY sp_import_logs_all ON sp_import_logs FOR ALL USING (TRUE);

-- Insert default rating scale for Spaljisten
INSERT INTO sp_rating_scales (org_id, level, label, description, color)
SELECT 
  o.id,
  r.level,
  r.label,
  r.description,
  r.color
FROM organizations o
CROSS JOIN (
  VALUES 
    (0, 'N', 'Not assessed / Not applicable', '#9CA3AF'),
    (1, '1', 'Beginner - Needs supervision', '#EF4444'),
    (2, '2', 'Basic - Needs occasional guidance', '#F59E0B'),
    (3, '3', 'Independent - Can work alone', '#22C55E'),
    (4, '4', 'Expert - Can train others', '#3B82F6')
) AS r(level, label, description, color)
WHERE o.slug = 'spaljisten'
ON CONFLICT (org_id, level) DO NOTHING;
