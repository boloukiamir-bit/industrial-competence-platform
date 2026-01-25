-- Drop legacy root_cause constraint.
-- We keep: execution_decisions_active_requires_root_cause_type
-- (enforces root_cause->>'type' instead of plain root_cause).

ALTER TABLE public.execution_decisions
DROP CONSTRAINT IF EXISTS execution_decisions_active_requires_root_cause;
