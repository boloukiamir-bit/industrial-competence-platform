# Org units: canonical source and verification

Setup Progress and Organization Overview both use the same tenant scope: **profile.active_org_id** (session), with fallback to **currentOrg.id** (UI). Both query `org_units` with that `org_id`.

## Verify counts (same tenant scope)

Replace `ACTIVE_ORG_ID` with the session’s `active_org_id` (e.g. from `profiles.active_org_id` for the current user).

```sql
-- 1) Org units count for the tenant (what Setup and Overview use)
SELECT COUNT(*) AS org_units_count
FROM public.org_units
WHERE org_id = 'ACTIVE_ORG_ID';

-- 2) Same tenant: list units (optional)
SELECT id, name, code, type, org_id
FROM public.org_units
WHERE org_id = 'ACTIVE_ORG_ID'
ORDER BY name;
```

To get `ACTIVE_ORG_ID` for the current user:

```sql
SELECT p.active_org_id
FROM public.profiles p
WHERE p.id = auth.uid()
LIMIT 1;
```

Combined (run as the authenticated user in Supabase SQL editor):

```sql
SELECT (SELECT COUNT(*) FROM public.org_units WHERE org_id = (SELECT active_org_id FROM public.profiles WHERE id = auth.uid() LIMIT 1)) AS org_units_count;
```
