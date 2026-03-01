-- Chain-linked insert for readiness_snapshots: advisory lock + canonical hash in one transaction.
-- Requires pgcrypto for digest(). Canonical payload order must match lib/server/readiness/snapshotPayloadHash.ts.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Build canonical payload hash (same field order and rules as TypeScript).
-- previous_hash and chain_position are between shift_code and legal_flag.
CREATE OR REPLACE FUNCTION public.compute_readiness_snapshot_payload_hash(
  p_org_id uuid,
  p_site_id uuid,
  p_shift_date date,
  p_shift_code text,
  p_previous_hash text,
  p_chain_position bigint,
  p_legal_flag text,
  p_ops_flag text,
  p_overall_status text,
  p_overall_reason_codes text[],
  p_iri_score integer,
  p_iri_grade text,
  p_roster_employee_count integer,
  p_version text,
  p_engines jsonb,
  p_legal_blockers_sample jsonb,
  p_ops_no_go_stations_sample jsonb
)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  reason_codes_sorted text[];
  engines_sorted jsonb;
  canonical json;
  canonical_text text;
BEGIN
  reason_codes_sorted := (SELECT array_agg(x ORDER BY x) FROM unnest(COALESCE(p_overall_reason_codes, '{}')) AS x);
  engines_sorted := (
    SELECT COALESCE(jsonb_object_agg(k, v), '{}'::jsonb)
    FROM (SELECT key AS k, value AS v FROM jsonb_each(COALESCE(p_engines, '{}'::jsonb)) ORDER BY key) t
  );

  canonical := json_build_object(
    'org_id', p_org_id::text,
    'site_id', p_site_id::text,
    'shift_date', to_char(p_shift_date, 'YYYY-MM-DD'),
    'shift_code', p_shift_code,
    'previous_hash', p_previous_hash,
    'chain_position', p_chain_position,
    'legal_flag', p_legal_flag,
    'ops_flag', p_ops_flag,
    'overall_status', p_overall_status,
    'overall_reason_codes', reason_codes_sorted,
    'iri_score', p_iri_score,
    'iri_grade', p_iri_grade,
    'roster_employee_count', p_roster_employee_count,
    'version', p_version,
    'engines', engines_sorted,
    'legal_blockers_sample', COALESCE(p_legal_blockers_sample, '[]'::jsonb),
    'ops_no_go_stations_sample', COALESCE(p_ops_no_go_stations_sample, '[]'::jsonb)
  );

  canonical_text := regexp_replace(canonical::text, '\s+', '', 'g');
  RETURN encode(digest(canonical_text, 'sha256'), 'hex');
END;
$$;

-- Insert one snapshot with chain linking under org-scoped advisory lock.
CREATE OR REPLACE FUNCTION public.insert_readiness_snapshot_chained(
  p_org_id uuid,
  p_site_id uuid,
  p_shift_date date,
  p_shift_code text,
  p_legal_flag text,
  p_ops_flag text,
  p_overall_status text,
  p_iri_score integer,
  p_iri_grade text,
  p_roster_employee_count integer,
  p_version text,
  p_created_by uuid,
  p_overall_reason_codes text[],
  p_legal_blockers_sample jsonb,
  p_ops_no_go_stations_sample jsonb,
  p_engines jsonb,
  p_payload_hash_algo text DEFAULT 'SHA256_V1'
)
RETURNS TABLE (id uuid, created_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  last_rec record;
  next_position bigint;
  prev_hash text;
  payload_hash_val text;
  new_id uuid;
  new_created_at timestamptz;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext(p_org_id::text));

  SELECT rs.chain_position, rs.payload_hash
  INTO last_rec
  FROM public.readiness_snapshots rs
  WHERE rs.org_id = p_org_id
  ORDER BY rs.chain_position DESC NULLS LAST, rs.created_at DESC
  LIMIT 1;

  next_position := COALESCE(last_rec.chain_position, 0) + 1;
  prev_hash := last_rec.payload_hash;

  payload_hash_val := public.compute_readiness_snapshot_payload_hash(
    p_org_id,
    p_site_id,
    p_shift_date,
    p_shift_code,
    prev_hash,
    next_position,
    p_legal_flag,
    p_ops_flag,
    p_overall_status,
    COALESCE(p_overall_reason_codes, '{}'),
    p_iri_score,
    p_iri_grade,
    p_roster_employee_count,
    p_version,
    COALESCE(p_engines, '{}'::jsonb),
    COALESCE(p_legal_blockers_sample, '[]'::jsonb),
    COALESCE(p_ops_no_go_stations_sample, '[]'::jsonb)
  );

  INSERT INTO public.readiness_snapshots (
    org_id, site_id, shift_date, shift_code,
    legal_flag, ops_flag, overall_status, iri_score, iri_grade,
    roster_employee_count, version, created_by,
    overall_reason_codes, legal_blockers_sample, ops_no_go_stations_sample, engines,
    chain_position, previous_hash, payload_hash, payload_hash_algo
  )
  VALUES (
    p_org_id, p_site_id, p_shift_date, p_shift_code,
    p_legal_flag, p_ops_flag, p_overall_status, p_iri_score, p_iri_grade,
    p_roster_employee_count, p_version, p_created_by,
    COALESCE(p_overall_reason_codes, '{}'), COALESCE(p_legal_blockers_sample, '[]'::jsonb), COALESCE(p_ops_no_go_stations_sample, '[]'::jsonb), COALESCE(p_engines, '{}'::jsonb),
    next_position, prev_hash, payload_hash_val, p_payload_hash_algo
  )
  RETURNING readiness_snapshots.id, readiness_snapshots.created_at
  INTO new_id, new_created_at;

  id := new_id;
  created_at := new_created_at;
  RETURN NEXT;
END;
$$;

COMMENT ON FUNCTION public.compute_readiness_snapshot_payload_hash IS 'Canonical SHA-256 payload hash for readiness snapshot; must match snapshotPayloadHash.ts.';
COMMENT ON FUNCTION public.insert_readiness_snapshot_chained IS 'Insert one readiness snapshot with org-scoped chain (advisory lock + chain_position + previous_hash).';
