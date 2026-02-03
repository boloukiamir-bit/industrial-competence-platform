# P0.9 Action Inbox Verification

## Overview

Action Inbox (`/app/compliance/actions`) is the daily execution surface for HR to see and execute OPEN compliance actions across employees. No workflow engine; minimal surface area.

## API

### 1. GET /api/compliance/actions/inbox

**Query params:**
- `status`: `open` | `done` | `all` (default `open`)
- `q`: search over employee name or employee number (optional)
- `actionType`: one of `request_renewal`, `request_evidence`, `notify_employee`, `mark_waived_review`, or `all`
- `due`: `overdue` | `7d` | `30d` | `all`
- `line`: line filter (employees.line)
- `category`: `license` | `medical` | `contract` | `all`
- `limit`: default 200

**Site scoping:**
- If `activeSiteId` (from profile) is set → filter `compliance_actions.site_id = activeSiteId`
- Else → all sites (UI shows "Site: All")

**Response:** `{ ok, actions, activeSiteId, activeSiteName, kpis: { open, overdue, due7d, done7d }, lines }`

### 2. POST /api/compliance/actions/[id]/update

**Body:** `{ due_date?: string|null, notes?: string|null, owner_user_id?: string|null }`

Admin/HR only. If `activeSiteId` exists, action must belong to that site (403 if cross-site).

### 3. POST /api/compliance/actions/[id]/done

Existing endpoint. Marks action as done.

---

## Verification

### Inbox list

```bash
# Open actions (default)
curl -s -b cookies.txt "https://<BASE>/api/compliance/actions/inbox" | jq .

# Overdue only
curl -s -b cookies.txt "https://<BASE>/api/compliance/actions/inbox?status=open&due=overdue" | jq .

# Search by employee name/number
curl -s -b cookies.txt "https://<BASE>/api/compliance/actions/inbox?q=smith" | jq .
```

### Update (assign to me, set due date)

```bash
# Assign to me (requires current user id; use from session)
curl -X POST -b cookies.txt \
  -H "Content-Type: application/json" \
  -d '{"owner_user_id":"<USER_UUID>"}' \
  "https://<BASE>/api/compliance/actions/<ACTION_ID>/update"

# Set due date
curl -X POST -b cookies.txt \
  -H "Content-Type: application/json" \
  -d '{"due_date":"2025-02-15"}' \
  "https://<BASE>/api/compliance/actions/<ACTION_ID>/update"
```

### Mark done

```bash
curl -X POST -b cookies.txt \
  "https://<BASE>/api/compliance/actions/<ACTION_ID>/done"
```

Verify list changes: refetch inbox; action should have `status: "done"`.

---

## UI Verification

1. **Load:** Navigate to `/app/compliance/actions` as admin/hr. Page loads with KPI strip, filters, table.
2. **Site chip:** Shows "Site: {name}" when site selected, "Site: All" when not, "Unknown site" if site not found.
3. **Filters refetch:** Change status, due, search, action type, category, line → table refetches.
4. **KPI click:** Click "Overdue" → due filter set to overdue. Click "Open" → status open.
5. **Mark done:** Click "Mark done" on an open action → succeeds, list refreshes, action moves/disappears per status filter.
6. **Assign to me:** Click "Assign to me" → owner set, button becomes "You".
7. **Set due date:** Click calendar icon → dialog opens, set date, Save → due date updates.
8. **Row click:** Opens ComplianceDrawer for that employee.
9. **Non-admin:** Non-admin/hr sees "Admin or HR access required" card.
