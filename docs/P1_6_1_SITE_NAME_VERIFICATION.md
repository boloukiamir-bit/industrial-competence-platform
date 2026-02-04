# P1.6.1 Site Name Verification

## Overview

Site name for the context chip is resolved **only** from `public.org_units` (never `organizations.name`). When `activeSiteId` is set but the primary lookup fails, a single-site fallback applies: if the org has exactly one `org_unit`, that unit’s name is shown; otherwise the chip shows “Unknown site”.

---

## Logic summary

- **Primary:** `org_units` where `id = siteId` AND `org_id = orgId` (when `orgId` provided). Return `org_units.name`.
- **Fallback (primary miss + `orgId` provided):** fetch `org_units` where `org_id = orgId`.
  - If exactly one row → return that unit’s name.
  - Else → return `null` (chip shows “Unknown site”).
- **Chip label:**
  - No `activeSiteId` → “All”
  - `activeSiteId` + resolved name → that name
  - `activeSiteId` + `null` → “Unknown site”

---

## SQL: Confirm org_units for org and site

Use your real `org_id` and `active_site_id` (from `profiles` or session).

```sql
-- Org’s org_units (replace with your org_id)
SELECT id, org_id, name, code, type
FROM public.org_units
WHERE org_id = 'YOUR_ORG_ID'
ORDER BY name;

-- Check if active_site_id exists in org_units for this org (replace both IDs)
SELECT ou.id, ou.org_id, ou.name
FROM public.org_units ou
WHERE ou.id = 'YOUR_ACTIVE_SITE_ID'
  AND ou.org_id = 'YOUR_ORG_ID';

-- Single-unit org check (expect 1 row for single-site fallback to work)
SELECT count(*) AS unit_count
FROM public.org_units
WHERE org_id = 'YOUR_ORG_ID';
```

If the second query returns no row but the third returns `1`, the single-site fallback will still show that one unit’s name instead of “Unknown site”.

---

## curl: Inbox returns activeSiteName

Requires a valid session (cookie or auth header). Replace base URL and ensure you’re logged in as Admin/HR.

```bash
# Session cookie (browser or login response)
curl -s -b "sb-access-token=YOUR_TOKEN; sb-refresh-token=YOUR_REFRESH" \
  "https://your-app/api/compliance/actions/inbox?status=open&limit=10" | jq '{ activeSiteId, activeSiteName }'
```

Expected: `activeSiteId` (UUID or null) and `activeSiteName` (string or null). When `activeSiteId` is set, `activeSiteName` should be the org_unit name (or the single org_unit name if fallback applies), not “Unknown site” for a single-unit org.

---

## UI check: Chip shows site name (not Unknown) for single-unit org

1. Log in as Admin/HR and set **active org** and **active site** (e.g. via org/site switcher or profile).
2. Open:
   - **Action Inbox** (`/app/compliance/actions`)
   - **Compliance Summary** (`/app/compliance/summary`)
   - **Compliance Matrix** (`/app/compliance/matrix`)
   - **Compliance Overview** (`/app/compliance`)
   - **Compliance Templates** (`/app/hr/templates/compliance-actions`)
3. For each page, check the site chip:
   - If no site is selected → chip shows **“All”**.
   - If a site is selected and it resolves → chip shows **that site name** (from `org_units.name`).
   - If a site is selected but lookup fails and the org has **exactly one** org_unit → chip shows **that single unit’s name** (single-site fallback).
   - If a site is selected but lookup fails and the org has 0 or 2+ org_units → chip shows **“Unknown site”**.

---

## API routes that return activeSiteName

All use `getActiveSiteName(supabase, siteId, orgId)` with session `orgId` (tenant-safe):

- `GET /api/compliance/actions/inbox`
- `GET /api/compliance/summary`
- `GET /api/compliance/matrix`
- `GET /api/compliance/overview`
- `POST /api/compliance/actions/recommend/preview`
- `GET /api/hr/templates/compliance-actions/list`
- `POST /api/hr/templates/compliance-actions/render` (uses same helper for draft `site_name`)

No route uses `organizations.name` or a `sites` table for the site chip name.

---

## Unit tests

`tests/unit/siteName.test.ts`:

- Primary hit → returns correct name.
- Primary miss + exactly one org_unit for org → returns that name.
- Primary miss + multiple org_units → returns `null`.
- Primary miss + no `orgId` → returns `null`.

Run: `npm test --silent`
