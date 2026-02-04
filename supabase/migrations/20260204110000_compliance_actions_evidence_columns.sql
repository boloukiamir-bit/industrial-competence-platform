-- P1.6 Evidence on compliance actions: add columns if missing (app already uses them).
ALTER TABLE public.compliance_actions
  ADD COLUMN IF NOT EXISTS evidence_url text NULL,
  ADD COLUMN IF NOT EXISTS evidence_notes text NULL,
  ADD COLUMN IF NOT EXISTS evidence_added_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS evidence_added_by uuid NULL;
