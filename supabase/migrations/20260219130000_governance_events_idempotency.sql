-- Phase A: idempotency_key on governance_events to dedupe on retries.
-- Backfill existing rows so unique constraint does not conflict.

ALTER TABLE public.governance_events
  ADD COLUMN IF NOT EXISTS idempotency_key text NULL;

-- Backfill: deterministic key so existing rows remain unique (includes created_at).
UPDATE public.governance_events
SET idempotency_key = encode(
  sha256(
    (org_id::text
     || action
     || coalesce(target_id, '')
     || outcome
     || coalesce(policy_fingerprint, '')
     || created_at::text
    )::bytea
  ),
  'hex'
)
WHERE idempotency_key IS NULL;

COMMENT ON COLUMN public.governance_events.idempotency_key IS 'SHA256 hex of canonical request fields; unique per (org_id, idempotency_key) to dedupe retries.';

CREATE UNIQUE INDEX IF NOT EXISTS idx_governance_events_org_idempotency_key
  ON public.governance_events (org_id, idempotency_key);

-- Supporting index for lookups by org + action + key.
CREATE INDEX IF NOT EXISTS idx_governance_events_org_action_idempotency_key
  ON public.governance_events (org_id, action, idempotency_key);
