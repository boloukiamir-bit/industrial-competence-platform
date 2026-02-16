-- Enrich hr_tasks with operational context for training tasks from Cockpit.
-- Enables actionable cards: line, station, shift, owner, target person, source link.

ALTER TABLE public.hr_tasks
  ADD COLUMN IF NOT EXISTS line text NULL,
  ADD COLUMN IF NOT EXISTS station_id uuid NULL,
  ADD COLUMN IF NOT EXISTS station_name text NULL,
  ADD COLUMN IF NOT EXISTS shift_code text NULL,
  ADD COLUMN IF NOT EXISTS shift_date date NULL,
  ADD COLUMN IF NOT EXISTS target_employee_id uuid NULL REFERENCES public.employees(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_hr_tasks_station ON public.hr_tasks(station_id) WHERE station_id IS NOT NULL;
