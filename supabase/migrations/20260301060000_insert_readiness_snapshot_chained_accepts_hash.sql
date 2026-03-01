-- Single source of truth for snapshot hash: app (Node) computes hash; DB stores it.
-- New RPC returns next chain position and previous hash; insert RPC accepts hash and chain fields from app.

-- 1) RPC: return next chain position and previous hash for an org (under advisory lock).
create or replace function public.get_next_readiness_snapshot_chain_head(p_org_id uuid)
returns table (next_position bigint, prev_hash text)
language plpgsql
security definer
set search_path = public
as $$
declare
  last_rec record;
begin
  perform pg_advisory_xact_lock(hashtext(p_org_id::text));

  select rs.chain_position, rs.payload_hash
  into last_rec
  from public.readiness_snapshots rs
  where rs.org_id = p_org_id
  order by rs.chain_position desc nulls last, rs.created_at desc
  limit 1;

  next_position := coalesce(last_rec.chain_position, 0) + 1;
  prev_hash := last_rec.payload_hash;
  return next;
end;
$$;

comment on function public.get_next_readiness_snapshot_chain_head is
'Returns (next_position, prev_hash) for app to compute canonical V2 hash before calling insert_readiness_snapshot_chained.';

-- 2) Replace insert RPC: accept payload_hash and chain fields from app; do not compute hash in DB.
create or replace function public.insert_readiness_snapshot_chained(
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
  p_chain_position bigint,
  p_previous_hash text,
  p_payload_hash text,
  p_payload_hash_algo text
)
returns table (id uuid, created_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  last_rec record;
  new_id uuid;
  new_created_at timestamptz;
begin
  if p_payload_hash is null or p_payload_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid p_payload_hash: must be 64 hex chars';
  end if;
  if p_payload_hash_algo is null or p_payload_hash_algo not in ('SHA256_V2', 'SHA256_V1') then
    raise exception 'invalid p_payload_hash_algo: must be SHA256_V2 or SHA256_V1';
  end if;

  perform pg_advisory_xact_lock(hashtext(p_org_id::text));

  select rs.chain_position, rs.payload_hash
  into last_rec
  from public.readiness_snapshots rs
  where rs.org_id = p_org_id
  order by rs.chain_position desc nulls last, rs.created_at desc
  limit 1;

  if p_chain_position = 1 then
    if last_rec.chain_position is not null then
      raise exception 'chain_position 1 but ledger already has rows';
    end if;
    if p_previous_hash is not null and p_previous_hash <> '' then
      raise exception 'chain_position 1 must have null previous_hash';
    end if;
  else
    if coalesce(last_rec.chain_position, 0) + 1 <> p_chain_position then
      raise exception 'chain_position mismatch: expected % got %', coalesce(last_rec.chain_position, 0) + 1, p_chain_position;
    end if;
    if last_rec.payload_hash is distinct from p_previous_hash then
      raise exception 'previous_hash mismatch';
    end if;
  end if;

  insert into public.readiness_snapshots (
    org_id, site_id, shift_date, shift_code,
    legal_flag, ops_flag, overall_status, iri_score, iri_grade,
    roster_employee_count, version, created_by,
    overall_reason_codes, legal_blockers_sample, ops_no_go_stations_sample, engines,
    chain_position, previous_hash, payload_hash, payload_hash_algo
  )
  values (
    p_org_id, p_site_id, p_shift_date, p_shift_code,
    p_legal_flag, p_ops_flag, p_overall_status, p_iri_score, p_iri_grade,
    p_roster_employee_count, p_version, p_created_by,
    coalesce(p_overall_reason_codes, '{}'), coalesce(p_legal_blockers_sample, '[]'::jsonb), coalesce(p_ops_no_go_stations_sample, '[]'::jsonb), coalesce(p_engines, '{}'::jsonb),
    p_chain_position, nullif(trim(p_previous_hash), ''), p_payload_hash, p_payload_hash_algo
  )
  returning readiness_snapshots.id, readiness_snapshots.created_at
  into new_id, new_created_at;

  id := new_id;
  created_at := new_created_at;
  return next;
end;
$$;

comment on function public.insert_readiness_snapshot_chained is
'Inserts one readiness snapshot; app supplies chain_position, previous_hash, payload_hash (hash computed in Node).';
