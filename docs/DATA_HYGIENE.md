# Data Hygiene (Admin)

Admin-only tool to purge (deactivate) demo/test employees for the active organization.

## API

**POST** `/api/admin/data-hygiene/purge-demo`

- **Auth:** Session required; user must have `active_org_id` set and role `admin` or `hr_admin`.
- **Behavior:** Sets `is_active = false` for employees in the active org matching demo/test patterns (Spaljisten-style): `employee_number` LIKE E9%, E100%, TEST%; `name` ILIKE %Test%; or `employee_number` in a configurable list (e.g. `20022`, `t001`).
- **Idempotent:** Safe to run multiple times; returns `{ deactivatedEmployees: number }`.

### cURL example

```bash
# Replace ACCESS_TOKEN with a valid session access token (e.g. from Supabase auth).
# The session must be for a user with admin or hr_admin role in the active org.

curl -X POST "https://YOUR_APP_URL/api/admin/data-hygiene/purge-demo" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ACCESS_TOKEN" \
  -H "Cookie: sb-access-token=ACCESS_TOKEN; sb-refresh-token=REFRESH_TOKEN" \
  --data '{}'
```

Example response:

```json
{ "deactivatedEmployees": 5 }
```

## UI

- **Admin** → **Purge demo/test data** button (admin-only).
- Confirmation modal: type `PURGE` to proceed.
- On success: toast and page refresh.

## List/suggest endpoints

All employee list and suggestion endpoints already filter by `is_active = true`, so deactivated employees are excluded from line-overview, tomorrows-gaps, suggestions, etc.
