# P1.8 Pilot Execution Pack

## Overview

Single script + docs so Daniel can validate the Compliance pilot in **&lt;10 minutes** with realistic data.

- **Seed endpoint:** `POST /api/compliance/pilot/seed` (dev-only or `ALLOW_PILOT_SEED=true`)
- **Guards:** Non-production or `ALLOW_PILOT_SEED=true`; Admin/HR only; tenant-scoped via `getActiveOrgFromSession`.

---

## Prerequisites

1. **Login** as a user with an active session (cookie or Bearer token).
2. **Role:** Admin or HR in the active organization.
3. **Active org:** Profile must have `active_org_id` set (e.g. from Org switcher).
4. **Optional:** Set `active_site_id` to seed into a specific site; otherwise seed uses first available site or org-wide.

---

## Step-by-step pilot script (8 steps)

1. **Seed pilot data**  
   `POST /api/compliance/pilot/seed`  
   Expect: `{ ok: true, counts: { employees, catalog, employee_compliance, actions, events }, examples: { oneActionId, oneEmployeeId } }`.

2. **Open Compliance → Action Inbox**  
   Verify chips show site name when a site is selected; inbox lists open/overdue/due7d/done.

3. **Check Summary**  
   `GET /api/compliance/summary`  
   Verify risk/expirations and action counts.

4. **Recommend/preview + commit**  
   `POST /api/compliance/actions/recommend/preview` then `POST /api/compliance/actions/recommend/commit`  
   Verify recommended actions appear and commit creates only missing ones.

5. **Inbox with SLA filters**  
   `GET /api/compliance/actions/inbox?sla=overdue` and `?sla=due7d`  
   Verify counts and rows match seeded data.

6. **Evidence badge**  
   In Inbox or Drawer, confirm at least one action shows evidence (URL + notes + evidence_added_at).

7. **Draft history**  
   In Action Drawer, confirm draft history shows at least 2× draft_copied and 1× evidence_added.

8. **Export**  
   `GET /api/compliance/actions/export`  
   Verify CSV contains subject/body columns and at least one row with `template_status=missing` (disabled template for one action type).

---

## Expected outcomes

| Check | Expected |
|-------|----------|
| Chips | Site name shown when site is selected. |
| Inbox counts | Open, overdue, due7d, done7d KPIs reflect seeded actions. |
| Evidence badge | At least one action has evidence (URL + notes + evidence_added_at). |
| Draft history | 2× draft_copied, 1× evidence_added events visible. |
| Export | CSV has subject/body; one row has `template_status=missing`. |

---

## Curl examples

Replace `<BASE_URL>` with your app origin (e.g. `http://localhost:3000`) and use session cookie or Bearer token.

### Seed endpoint

```bash
# With session cookie
curl -X POST -b cookies.txt "<BASE_URL>/api/compliance/pilot/seed"

# With Bearer token
curl -X POST -H "Authorization: Bearer <access_token>" "<BASE_URL>/api/compliance/pilot/seed"
```

### Summary

```bash
curl -b cookies.txt "<BASE_URL>/api/compliance/summary?expiringDays=30"
```

### Recommend preview + commit

```bash
# Preview
curl -X POST -b cookies.txt -H "Content-Type: application/json" \
  -d '{"expiringDays":30}' "<BASE_URL>/api/compliance/actions/recommend/preview"

# Commit (creates recommended actions idempotently)
curl -X POST -b cookies.txt -H "Content-Type: application/json" \
  -d '{"expiringDays":30}' "<BASE_URL>/api/compliance/actions/recommend/commit"
```

### Inbox with SLA filters

```bash
# All open
curl -b cookies.txt "<BASE_URL>/api/compliance/actions/inbox?status=open"

# Overdue only
curl -b cookies.txt "<BASE_URL>/api/compliance/actions/inbox?sla=overdue"

# Due in 7 days
curl -b cookies.txt "<BASE_URL>/api/compliance/actions/inbox?sla=due7d"
```

### Export endpoint

```bash
curl -b cookies.txt -o export.csv "<BASE_URL>/api/compliance/actions/export?status=open&channel=email&limit=500"
# Inspect: subject, body, template_status (one row should be "missing"), evidence_status
```

---

## Seed data summary

- **Employees:** 3 (PILOT_E001, PILOT_E002, PILOT_E003) with distinct names and lines.
- **Catalog:** 6 items (license, medical, contract).
- **Employee compliance:** 2 rows (overdue, expiring); one combo left without row ⇒ "missing".
- **Actions:** 3+ open, 1 overdue, 1 due7d, 1 done; one action with evidence; events: 2× draft_copied, 1× evidence_added.
- **Templates:** 3 active; one template code disabled so export shows `template_status=missing` for one action type.
