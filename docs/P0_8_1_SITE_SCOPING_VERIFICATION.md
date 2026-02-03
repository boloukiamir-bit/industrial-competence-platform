# P0.8.1 Site-Scoping Hardening – Verification Notes

## Summary

- **Goal:** Deterministic site scoping for `compliance_actions`: `site_id` set when employee has a site; list strictly by `site_id` when `activeSiteId` is set; 409 on create when employee does not belong to active site.
- **DB:** Backfill + index; no global NOT NULL on `site_id`; enforcement at API level.
- **APIs:** Create returns 409 `site_mismatch` when active site and employee site differ; list filters `site_id = activeSiteId` when set (no null inclusion).
- **UI:** ComplianceDrawer shows toast "Wrong site selected for this employee" on 409 `site_mismatch`.

---

## A) DB migration

Apply after `20260203150000_compliance_actions.sql`:

```bash
supabase db push
# or
psql $DATABASE_URL -f supabase/migrations/20260203160000_compliance_actions_site_hardening.sql
```

### SQL to confirm backfill

Run before and after migration to compare counts:

```sql
-- Count rows with null site_id (before: may be > 0; after: should be 0 for employees that have site_id)
SELECT COUNT(*) AS null_site_count
FROM public.compliance_actions a
WHERE a.site_id IS NULL;

-- Optional: count backfill candidates (actions with null site_id where employee has site_id)
SELECT COUNT(*) AS backfill_candidates
FROM public.compliance_actions a
JOIN public.employees e ON e.id = a.employee_id AND e.org_id = a.org_id
WHERE a.site_id IS NULL AND e.site_id IS NOT NULL;
```

After migration: `backfill_candidates` should be 0; `null_site_count` may still be > 0 for actions whose employee has no `site_id` (org-wide).

---

## B) cURL examples

Assume `BASE=http://localhost:3000` (or your app URL), session cookie or dev bearer in `Cookie` / `Authorization: Bearer <token>`. User must have `active_org_id` and optionally `active_site_id` set in `profiles`.

### 1) Create action in correct site => 200

- Set profile `active_site_id` to the same site as the employee (or leave null for org-wide).
- Create action:

```bash
curl -s -w "\n%{http_code}" -X POST "$BASE/api/compliance/actions/create" \
  -H "Content-Type: application/json" \
  -H "Cookie: <session-cookie>" \
  -d '{
    "employee_id": "<employee-uuid-with-site>",
    "compliance_code": "FORKLIFT",
    "action_type": "request_renewal"
  }'
# Expected: {"ok":true,"action_id":"<uuid>"} and HTTP 200
```

### 2) Create action with activeSiteId set to different site => 409 site_mismatch

- Set profile `active_site_id` to site A; use an employee that has `site_id` = site B.
- Create action:

```bash
curl -s -w "\n%{http_code}" -X POST "$BASE/api/compliance/actions/create" \
  -H "Content-Type: application/json" \
  -H "Cookie: <session-cookie>" \
  -d '{
    "employee_id": "<employee-uuid-with-site-B>",
    "compliance_code": "FORKLIFT",
    "action_type": "request_renewal"
  }'
# Expected: {"ok":false,"step":"site_mismatch","message":"Employee does not belong to active site"} and HTTP 409
```

### 3) List actions with activeSiteId set => only that site

- Set profile `active_site_id` to a specific site.
- List actions for an employee that has actions on that site and possibly others:

```bash
curl -s "$BASE/api/compliance/actions?employeeId=<employee-uuid>" \
  -H "Cookie: <session-cookie>"
# Expected: {"ok":true,"actions":[...]} with only actions where site_id = active_site_id (no cross-site, no null-inclusion)
```

---

## C) UI checks (ComplianceDrawer)

1. **Correct site:** Open Compliance Matrix, set site filter to the employee’s site, open drawer for that employee, create an action → success toast; action appears in list.
2. **Wrong site:** Set site filter to a different site than the employee’s, open drawer for the employee (if still visible) or via direct navigation, try to create an action → toast: “Wrong site selected for this employee”; drawer does not break; list refetches and stays consistent.
3. **List scoping:** With site filter set, create an action for an employee in that site → switch to “All sites” (if available) or another site → list in drawer shows only actions for the selected context (strict by site when site is selected).

---

## Constraints (unchanged)

- No changes to RLS functions or policies.
- No workflow engine changes.
- Build: `rm -rf .next && npm run build` must pass.
