-- shift_rules: net working time per shift (break_minutes, paid_break_minutes)
-- Used to compute assignedHours as net (gross - break + paid_break) so 07-16 with 60 min break = 8h net.

CREATE TABLE IF NOT EXISTS public.shift_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  shift_type text NOT NULL CHECK (shift_type IN ('Day','Evening','Night')),
  shift_start time NOT NULL,
  shift_end time NOT NULL,
  break_minutes int NOT NULL DEFAULT 0,
  paid_break_minutes int NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (org_id, shift_type)
);

CREATE INDEX IF NOT EXISTS idx_shift_rules_org ON public.shift_rules(org_id);

ALTER TABLE public.shift_rules ENABLE ROW LEVEL SECURITY;

-- RLS: authenticated org members can select; service_role has full (bypasses RLS)
DROP POLICY IF EXISTS "shift_rules_select" ON public.shift_rules;
CREATE POLICY "shift_rules_select" ON public.shift_rules FOR SELECT
  USING (public.is_org_member(org_id));

DROP POLICY IF EXISTS "shift_rules_insert" ON public.shift_rules;
CREATE POLICY "shift_rules_insert" ON public.shift_rules FOR INSERT
  WITH CHECK (public.is_org_admin(org_id));

DROP POLICY IF EXISTS "shift_rules_update" ON public.shift_rules;
CREATE POLICY "shift_rules_update" ON public.shift_rules FOR UPDATE
  USING (public.is_org_admin(org_id));

DROP POLICY IF EXISTS "shift_rules_delete" ON public.shift_rules;
CREATE POLICY "shift_rules_delete" ON public.shift_rules FOR DELETE
  USING (public.is_org_admin(org_id));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.shift_rules TO authenticated;
GRANT ALL ON public.shift_rules TO service_role;

-- Seed default rules for org a1b2c3d4-e5f6-7890-abcd-ef1234567890 (FK-safe: only when org exists)
INSERT INTO public.shift_rules (org_id, shift_type, shift_start, shift_end, break_minutes, paid_break_minutes)
SELECT v.org_id, v.shift_type, v.shift_start, v.shift_end, v.break_minutes, v.paid_break_minutes
FROM (VALUES
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890'::uuid, 'Day'::text,     '07:00'::time, '16:00'::time, 60, 0),
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890'::uuid, 'Evening'::text, '14:00'::time, '22:00'::time,  0, 0),
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890'::uuid, 'Night'::text,   '22:00'::time, '06:00'::time,  0, 0)
) AS v(org_id, shift_type, shift_start, shift_end, break_minutes, paid_break_minutes)
WHERE EXISTS (SELECT 1 FROM public.organizations WHERE id = v.org_id)
ON CONFLICT (org_id, shift_type) DO UPDATE SET
  shift_start = EXCLUDED.shift_start,
  shift_end = EXCLUDED.shift_end,
  break_minutes = EXCLUDED.break_minutes,
  paid_break_minutes = EXCLUDED.paid_break_minutes,
  updated_at = now();
