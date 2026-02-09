-- One-time migration: copy employee_competences -> employee_skills.
-- Maps competence_id to skill_id by matching (org_id, code) or (org_id, name) when code is null.
-- Run once before deprecating employee_competences. Idempotent: uses ON CONFLICT DO UPDATE.
-- No-op if employee_competences or competences tables do not exist.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'employee_competences')
     AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'competences') THEN
    INSERT INTO public.employee_skills (employee_id, skill_id, level, valid_to)
    SELECT ec.employee_id, s.id, COALESCE(ec.level, 0)::smallint, ec.valid_to
    FROM public.employee_competences ec
    INNER JOIN public.employees e ON e.id = ec.employee_id AND e.org_id IS NOT NULL
    INNER JOIN public.competences c ON c.id = ec.competence_id AND c.org_id = e.org_id
    INNER JOIN public.skills s ON s.org_id = e.org_id
      AND ((c.code IS NOT NULL AND s.code = c.code) OR (COALESCE(c.code, '') = '' AND COALESCE(s.code, '') = '' AND s.name = c.name))
    ON CONFLICT (employee_id, skill_id) DO UPDATE SET level = EXCLUDED.level, valid_to = EXCLUDED.valid_to;
  END IF;
END $$;
