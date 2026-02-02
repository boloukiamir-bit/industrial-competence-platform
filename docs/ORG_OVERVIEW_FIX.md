# Org Overview Fix — Verification SQL

Use these snippets in Supabase SQL editor to verify the Organization Overview counts.
Replace the placeholder IDs with real values.

## 1) Active org + site from session

```sql
select active_org_id, active_site_id
from profiles
where id = auth.uid();
```

## 2) Employee counts (org only vs site-filtered)

```sql
-- Org-scoped active employees (matches Employees page when no active_site_id)
select count(*) as employees_org_only
from employees
where org_id = '<active_org_id>'
  and is_active = true;
```

```sql
-- Org + site scoped active employees (use only when active_site_id is set)
select count(*) as employees_org_site
from employees
where org_id = '<active_org_id>'
  and is_active = true
  and site_id = '<active_site_id>';
```

## 3) Org units and root detection

```sql
select id, name, parent_id
from org_units
where org_id = '<active_org_id>'
order by name;
```

## 4) Fix: set one top-level unit (parent_id = NULL)

```sql
update org_units
set parent_id = null
where id = '<unit_id>'
  and org_id = '<active_org_id>';
```

## 5) API verification (Bearer)```bash
BASE="http://localhost:5001"
curl -s -4 -H "Authorization: Bearer $TOKEN" "$BASE/api/org/units" | jq '.meta'
```Expected: `meta.totalEmployeesAfterSiteFilter` matches Employees page count.