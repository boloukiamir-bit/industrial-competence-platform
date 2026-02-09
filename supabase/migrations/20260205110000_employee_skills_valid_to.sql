-- Add valid_to to employee_skills for competence expiry tracking.
ALTER TABLE public.employee_skills
  ADD COLUMN IF NOT EXISTS valid_to date;
