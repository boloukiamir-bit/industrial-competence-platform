# P0.9.1 Done-at Verification

## Overview

Truthful done metrics: `done7d` KPI now uses `done_at` instead of `created_at`. Added `updated_at` and `done_at` columns plus trigger.

## Schema

- `updated_at` timestamptz NOT NULL DEFAULT now() — set by trigger on UPDATE
- `done_at` timestamptz NULL — set explicitly when status becomes 'done'

## SQL Checks

```sql
-- Legacy done rows without done_at (pre-migration completions; excluded from done7d)
SELECT count(*) FROM public.compliance_actions
WHERE status = 'done' AND done_at IS NULL;

-- Sample rows
SELECT id, status, created_at, updated_at, done_at
FROM public.compliance_actions
ORDER BY created_at DESC
LIMIT 10;
```

## curl

```bash
# Mark done -> verify done_at not null
curl -X POST -b cookies.txt "https://<BASE>/api/compliance/actions/<ACTION_ID>/done"
# Then in DB: SELECT done_at FROM compliance_actions WHERE id = '<ACTION_ID>';  -- should be non-null

# Update due_date -> verify updated_at changes
curl -X POST -b cookies.txt \
  -H "Content-Type: application/json" \
  -d '{"due_date":"2025-02-15"}' \
  "https://<BASE>/api/compliance/actions/<ACTION_ID>/update"
# Then in DB: SELECT updated_at FROM compliance_actions WHERE id = '<ACTION_ID>';  -- should reflect recent update
```

## UI

1. Open Action Inbox (`/app/compliance/actions`).
2. Mark an open action as done via "Mark done".
3. Refresh; "Done last 7d" KPI card should increase (if done_at is within last 7 days).
