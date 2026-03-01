-- Readiness Snapshots: tamper-evident integrity (SHA-256 payload hash).
-- New rows get hash on insert; existing rows remain null (no backfill).

ALTER TABLE public.readiness_snapshots
  ADD COLUMN IF NOT EXISTS payload_hash text NULL,
  ADD COLUMN IF NOT EXISTS payload_hash_algo text NOT NULL DEFAULT 'SHA256_V1';

COMMENT ON COLUMN public.readiness_snapshots.payload_hash IS 'SHA-256 hex digest of canonical JSON payload (deterministic). Null for pre-hash snapshots.';
COMMENT ON COLUMN public.readiness_snapshots.payload_hash_algo IS 'Algorithm identifier for payload_hash (e.g. SHA256_V1).';

CREATE INDEX IF NOT EXISTS idx_readiness_snapshots_payload_hash
  ON public.readiness_snapshots (payload_hash)
  WHERE payload_hash IS NOT NULL;
