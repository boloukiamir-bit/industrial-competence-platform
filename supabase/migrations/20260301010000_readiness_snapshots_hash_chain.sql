-- Readiness snapshots: append-only org-scoped hash-chain ledger.
-- Adds chain columns, enforces immutability (no UPDATE/DELETE).

-- 1) Add chain columns
ALTER TABLE public.readiness_snapshots
  ADD COLUMN IF NOT EXISTS previous_hash text NULL,
  ADD COLUMN IF NOT EXISTS chain_position bigint NULL;

-- 2) Unique chain position per org
CREATE UNIQUE INDEX IF NOT EXISTS readiness_snapshots_org_chain_position_idx
  ON public.readiness_snapshots (org_id, chain_position)
  WHERE chain_position IS NOT NULL;

-- 3) Block UPDATE (immutability)
CREATE OR REPLACE FUNCTION public.prevent_readiness_snapshot_update()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'readiness_snapshots is immutable. Updates are not allowed.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS readiness_snapshot_no_update ON public.readiness_snapshots;
CREATE TRIGGER readiness_snapshot_no_update
  BEFORE UPDATE ON public.readiness_snapshots
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_readiness_snapshot_update();

-- 4) Block DELETE (append-only)
CREATE OR REPLACE FUNCTION public.prevent_readiness_snapshot_delete()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'readiness_snapshots is append-only. Deletes are not allowed.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS readiness_snapshot_no_delete ON public.readiness_snapshots;
CREATE TRIGGER readiness_snapshot_no_delete
  BEFORE DELETE ON public.readiness_snapshots
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_readiness_snapshot_delete();
