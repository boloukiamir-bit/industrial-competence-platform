-- Compliance Gap -> Create Action v1: minimal action engine + governance_events audit.
-- Extends existing public.compliance_actions with title, description, created_by, closed_at, closed_by;
-- allows action_type 'COMPLIANCE_GAP' and status OPEN/IN_PROGRESS/CLOSED.

-- 1) Add columns for gap-action flow
ALTER TABLE public.compliance_actions
  ADD COLUMN IF NOT EXISTS title text NULL,
  ADD COLUMN IF NOT EXISTS description text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS created_by uuid NULL,
  ADD COLUMN IF NOT EXISTS closed_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS closed_by uuid NULL;

-- requirement_id: use existing compliance_id (compliance_catalog.id). Allow null for generic actions.
ALTER TABLE public.compliance_actions
  ALTER COLUMN compliance_id DROP NOT NULL;

-- employee_id nullable for generic org-level actions
ALTER TABLE public.compliance_actions
  ALTER COLUMN employee_id DROP NOT NULL;

-- 2) Extend action_type to include COMPLIANCE_GAP
ALTER TABLE public.compliance_actions
  DROP CONSTRAINT IF EXISTS compliance_actions_action_type_check;
ALTER TABLE public.compliance_actions
  ADD CONSTRAINT compliance_actions_action_type_check
  CHECK (action_type IN (
    'request_renewal', 'request_evidence', 'notify_employee', 'mark_waived_review',
    'COMPLIANCE_GAP'
  ));

-- 3) Extend status to include OPEN, IN_PROGRESS, CLOSED
ALTER TABLE public.compliance_actions
  DROP CONSTRAINT IF EXISTS compliance_actions_status_check;
ALTER TABLE public.compliance_actions
  ADD CONSTRAINT compliance_actions_status_check
  CHECK (status IN ('open', 'done', 'OPEN', 'IN_PROGRESS', 'CLOSED'));

-- 4) assigned_to: use existing owner_user_id; optional alias for clarity (no new column).
COMMENT ON COLUMN public.compliance_actions.owner_user_id IS 'Assigned owner; also used as assigned_to_user_id for COMPLIANCE_GAP actions.';

-- 5) Indexes already exist: (org_id, status), (org_id, employee_id). No change.

-- 6) Governance events: app layer inserts on create/close (no trigger) to keep meta flexible.
