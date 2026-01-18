-- Spaljisten Go-Live v1 Schema
-- Tables for Skill Matrix + Gap/Risk View

-- SECURITY FIX: Organization auto-seeding has been disabled.
-- Organizations must be created through the proper signup/invite flow.
-- Use /api/workflows/setup for template seeding after org exists.
-- 
-- Original (disabled):
-- INSERT INTO organizations (id, name, slug, created_at)
-- VALUES (
--   'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
--   'Spaljisten',
--   'spaljisten',
--   NOW()
-- ) ON CONFLICT (slug) DO NOTHING;

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

-- RLS Policies 
-- SECURITY FIX: Original USING (TRUE) policies have been replaced.
-- See sql/017_spaljisten_rls_fix.sql for proper org-scoped RLS policies.
-- 
-- The 017 migration drops these placeholder policies and creates:
-- - SELECT: is_org_member(org_id)
-- - INSERT/UPDATE/DELETE: is_org_admin(org_id)
--
-- Placeholder policies (will be replaced by 017 migration):
CREATE POLICY IF NOT EXISTS sp_rating_scales_placeholder ON sp_rating_scales FOR SELECT USING (public.is_org_member(org_id));
CREATE POLICY IF NOT EXISTS sp_areas_placeholder ON sp_areas FOR SELECT USING (public.is_org_member(org_id));
CREATE POLICY IF NOT EXISTS sp_stations_placeholder ON sp_stations FOR SELECT USING (public.is_org_member(org_id));
CREATE POLICY IF NOT EXISTS sp_skills_placeholder ON sp_skills FOR SELECT USING (public.is_org_member(org_id));
CREATE POLICY IF NOT EXISTS sp_employees_placeholder ON sp_employees FOR SELECT USING (public.is_org_member(org_id));
CREATE POLICY IF NOT EXISTS sp_employee_skills_placeholder ON sp_employee_skills FOR SELECT USING (public.is_org_member(org_id));
CREATE POLICY IF NOT EXISTS sp_area_leaders_placeholder ON sp_area_leaders FOR SELECT USING (public.is_org_member(org_id));
CREATE POLICY IF NOT EXISTS sp_import_logs_placeholder ON sp_import_logs FOR SELECT USING (public.is_org_admin(org_id));

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
