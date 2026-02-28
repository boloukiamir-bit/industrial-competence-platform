-- Readiness Snapshots v2: self-contained immutable payload for full reconstruction (IRI_V2 etc.).
-- New columns: reason_codes + samples + engines. Existing rows get defaults.

ALTER TABLE public.readiness_snapshots
  ADD COLUMN IF NOT EXISTS overall_reason_codes text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS legal_blockers_sample jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS ops_no_go_stations_sample jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS engines jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.readiness_snapshots.overall_reason_codes IS 'Readiness-v3 overall.reason_codes at freeze time (LEGAL_BLOCKING, LEGAL_EXPIRING, OPS_NO_COVERAGE, OPS_RISK).';
COMMENT ON COLUMN public.readiness_snapshots.legal_blockers_sample IS 'Sample of legal blockers from readiness-v3 (requirement_code, requirement_name, blocking_affected_employee_count).';
COMMENT ON COLUMN public.readiness_snapshots.ops_no_go_stations_sample IS 'Sample of ops NO_GO stations from readiness-v3 (station_code, station_name).';
COMMENT ON COLUMN public.readiness_snapshots.engines IS 'Engine versions at freeze time, e.g. { "readiness":"V3", "iri":"IRI_V1", "compliance":"MATRIX_V2", "competence":"MATRIX_V2" }.';

CREATE INDEX IF NOT EXISTS idx_readiness_snapshots_overall_reason_codes
  ON public.readiness_snapshots USING gin (overall_reason_codes);
