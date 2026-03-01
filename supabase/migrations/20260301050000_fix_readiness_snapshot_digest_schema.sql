create extension if not exists pgcrypto with schema extensions;

create or replace function public.compute_readiness_snapshot_payload_hash(
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
returns text
language plpgsql
immutable
as $$
declare
  reason_codes_sorted text[];
  engines_sorted jsonb;
  canonical json;
  canonical_text text;
begin
  reason_codes_sorted := (select array_agg(x order by x) from unnest(coalesce(p_overall_reason_codes, '{}'::text[])) as x);

  engines_sorted := (
    select coalesce(jsonb_object_agg(k, v), '{}'::jsonb)
    from (select key as k, value as v from jsonb_each(coalesce(p_engines, '{}'::jsonb)) order by key) t
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
    'legal_blockers_sample', coalesce(p_legal_blockers_sample, '[]'::jsonb),
    'ops_no_go_stations_sample', coalesce(p_ops_no_go_stations_sample, '[]'::jsonb)
  );

  canonical_text := regexp_replace(canonical::text, '\s+', '', 'g');

  -- FIX: call digest in extensions schema (Supabase installs pgcrypto there)
  return encode(extensions.digest(convert_to(canonical_text, 'UTF8'), 'sha256'::text), 'hex');
end;
$$;

comment on function public.compute_readiness_snapshot_payload_hash is
'Uses extensions.digest() (pgcrypto in Supabase extensions schema) to compute SHA-256 over canonical JSON text.';
