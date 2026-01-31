-- Add org_id to skills for tenant isolation
-- Backfill existing rows to Spaljisten org and enforce RLS by active_org_id

ALTER TABLE public.skills
  ADD COLUMN IF NOT EXISTS org_id uuid;

UPDATE public.skills
SET org_id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
WHERE org_id IS NULL;

ALTER TABLE public.skills
  ALTER COLUMN org_id SET NOT NULL;

ALTER TABLE public.skills
  DROP CONSTRAINT IF EXISTS skills_org_id_fkey;

ALTER TABLE public.skills
  ADD CONSTRAINT skills_org_id_fkey
  FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;

CREATE UNIQUE INDEX IF NOT EXISTS idx_skills_org_code ON public.skills(org_id, code);
CREATE INDEX IF NOT EXISTS idx_skills_org ON public.skills(org_id);

ALTER TABLE public.skills ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS skills_select ON public.skills;
DROP POLICY IF EXISTS skills_insert ON public.skills;
DROP POLICY IF EXISTS skills_update ON public.skills;
DROP POLICY IF EXISTS skills_delete ON public.skills;

CREATE POLICY skills_select ON public.skills
  FOR SELECT USING (
    org_id = (SELECT active_org_id FROM public.profiles WHERE id = auth.uid())
  );

CREATE POLICY skills_insert ON public.skills
  FOR INSERT WITH CHECK (
    org_id = (SELECT active_org_id FROM public.profiles WHERE id = auth.uid())
  );

CREATE POLICY skills_update ON public.skills
  FOR UPDATE USING (
    org_id = (SELECT active_org_id FROM public.profiles WHERE id = auth.uid())
  ) WITH CHECK (
    org_id = (SELECT active_org_id FROM public.profiles WHERE id = auth.uid())
  );

CREATE POLICY skills_delete ON public.skills
  FOR DELETE USING (
    org_id = (SELECT active_org_id FROM public.profiles WHERE id = auth.uid())
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.skills TO authenticated;
