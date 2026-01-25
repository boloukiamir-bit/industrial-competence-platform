-- Enforce that status='active' requires root_cause with a valid type.
-- Prevents future corruption from null or missing root_cause.type on active decisions.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'execution_decisions_active_requires_root_cause_type'
  ) THEN
    ALTER TABLE public.execution_decisions
    ADD CONSTRAINT execution_decisions_active_requires_root_cause_type
    CHECK (
      status <> 'active'
      OR (root_cause IS NOT NULL AND root_cause->>'type' IS NOT NULL)
    );
  END IF;
END $$;
