-- Backfill: move root_cause.details.missing -> root_cause.missing and remove from details.
-- Only affects rows where details.missing exists and root-level missing is absent.

update public.execution_decisions
set root_cause =
  jsonb_set(
    jsonb_set(
      root_cause,
      '{missing}',
      coalesce(root_cause->'missing', root_cause->'details'->'missing', '[]'::jsonb),
      true
    ),
    '{details}',
    (root_cause->'details') - 'missing',
    true
  )
where root_cause ? 'details'
  and (root_cause->'details') ? 'missing'
  and not (root_cause ? 'missing');
