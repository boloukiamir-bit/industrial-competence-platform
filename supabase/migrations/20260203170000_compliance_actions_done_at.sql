-- P0.9.1 Truthful Done Metrics: add updated_at, done_at for correct KPIs and audit.

-- 1) Add columns
ALTER TABLE public.compliance_actions
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS done_at timestamptz NULL;

-- 2) Backfill updated_at for existing rows (PG 11+ ADD COLUMN may leave existing rows null)
UPDATE public.compliance_actions
SET updated_at = COALESCE(updated_at, created_at, now())
WHERE updated_at IS NULL;

-- 3) Trigger function (generic, reusable)
CREATE OR REPLACE FUNCTION public.set_updated_at() RETURNS trigger
  LANGUAGE plpgsql
  AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_compliance_actions_updated_at ON public.compliance_actions;
CREATE TRIGGER trg_compliance_actions_updated_at
  BEFORE UPDATE ON public.compliance_actions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
