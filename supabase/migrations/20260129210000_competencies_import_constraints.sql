-- Competencies import: skills description, uniqueness, employee_skills unique.
-- Tenant-scoped by session (active_org_id); used by POST /api/competencies/import/*.

-- 1. skills.description (DB-first)
ALTER TABLE public.skills
  ADD COLUMN IF NOT EXISTS description text;

-- 2. Unique per org on skills: (org_id, code) — already enforced by idx_skills_org_code.
--    Drop legacy UNIQUE(name) so same name can exist across orgs.
ALTER TABLE public.skills
  DROP CONSTRAINT IF EXISTS skills_name_key;

-- 3. employee_skills uniqueness: (employee_id, skill_id)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.employee_skills'::regclass
      AND conname = 'employee_skills_employee_id_skill_id_key'
  ) THEN
    ALTER TABLE public.employee_skills
      ADD CONSTRAINT employee_skills_employee_id_skill_id_key
      UNIQUE (employee_id, skill_id);
  END IF;
END $$;

