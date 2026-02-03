# P1.2 Ownership & SLA Verification

## Overview

Every OPEN compliance action has clear owner and SLA visibility. Action Inbox shows SLA badges, quick filters (Overdue, Due <7d, No due date, Unassigned, Mine), and Assign-to-me. Autopop creates actions owned by the current user. No user directory; owner is only null vs set vs current user.

## SLA (server-side)

Computed per row using `asOf` (today) and `due_date`:

- **overdue**: `status === 'open'` && `due_date < asOf`
- **due7d**: `status === 'open'` && `due_date >= asOf` && `due_date <= asOf+7`
- **nodue**: `status === 'open'` && `due_date` is null
- **ok**: otherwise (e.g. done, or open with due > asOf+7)

## API

### GET /api/compliance/actions/inbox

**Extended query params:**

- `unassignedOnly=1` (default 0) — only open actions with `owner_user_id` null
- `sla=overdue|due7d|nodue|all` (default all) — filter by SLA (applied in SQL; when set, forces `status=open`)
- `owner=me|unassigned|all` (default all) — `me` = current user id from session

**Extended response:**

- Each action has `sla`: `"overdue" | "due7d" | "nodue" | "ok"`
- Top-level `unassignedCount`: count of open actions (in scope) with `owner_user_id` null

KPIs unchanged.

### POST /api/compliance/actions/[id]/assign

**Body:** `{ owner_user_id?: string | null }` — if omitted, assign to current user.

**Auth:** Admin/HR only. Org-scoped. Strict site check when `activeSiteId` set.

**Response:** `{ ok: true, action_id }`

## curl

```bash
# Inbox with SLA filter (overdue only)
curl -s -b cookies.txt "https://<BASE>/api/compliance/actions/inbox?status=open&sla=overdue" | jq '.actions[0].sla, .unassignedCount'

# Inbox unassigned only
curl -s -b cookies.txt "https://<BASE>/api/compliance/actions/inbox?status=open&unassignedOnly=1" | jq '.unassignedCount, .actions | length'

# Inbox mine only
curl -s -b cookies.txt "https://<BASE>/api/compliance/actions/inbox?status=open&owner=me" | jq .

# Assign action to current user (no body)
curl -s -X POST -b cookies.txt -H "Content-Type: application/json" \
  -d '{}' \
  "https://<BASE>/api/compliance/actions/<ACTION_ID>/assign" | jq .
```

## UI Checks

1. **SLA column:** Table has SLA column; badges: Overdue (red), Due <7d (amber), No due date (gray), OK (subtle). Values match server `sla`.
2. **Quick filters:** Chips "Overdue", "Due <7d", "No due date", "Unassigned", "Mine" set params and refetch. Active chip is highlighted.
3. **Unassigned count:** "Unassigned" chip shows count when > 0 (from `unassignedCount`).
4. **Assign:** Row with `owner_user_id` null shows "Assign to me" button; on click calls `/assign` (no body), then "Mine". Row with owner = current user shows "Mine". Row with other owner shows "Assigned" (no user name).
5. **Row click:** Clicking "Assign to me", due date calendar, or "Mark done" does not open the employee drawer (stopPropagation).
6. **Autopop:** After "Generate recommended actions" → Commit, new actions appear in inbox with owner = current user; unassigned count does not increase for those.

## DB (optional)

Index for inbox filters:

- `idx_compliance_actions_org_status_owner_due` on `(org_id, status, owner_user_id, due_date)`

Migration: `20260203190000_compliance_actions_inbox_index.sql`

## P1.2.1 Server-side SLA filtering

SLA filters are applied in the **SQL query** (not post-enrichment). See `app/api/compliance/actions/inbox/route.ts`: when `sla !== "all"`, the base actions query adds `status = 'open'` and due_date constraints (overdue: `due_date < todayStr`; due7d: `due_date` between today and today+7; nodue: `due_date IS NULL`). When `sla !== "all"`, the `status` query param is ignored and results are open-only. Per-row `sla` is still computed for the response (for the SLA badge column).

**curl (confirm only matching rows; each response still includes `sla` per row):**

```bash
# Overdue only (open, due_date < today)
curl -s -b cookies.txt "https://<BASE>/api/compliance/actions/inbox?sla=overdue" | jq '[.actions[] | {sla, due_date, status}] | .[0:3]'

# Due within 7 days (open, due_date in [today, today+7])
curl -s -b cookies.txt "https://<BASE>/api/compliance/actions/inbox?sla=due7d" | jq '[.actions[] | {sla, due_date, status}] | .[0:3]'

# No due date (open, due_date null)
curl -s -b cookies.txt "https://<BASE>/api/compliance/actions/inbox?sla=nodue" | jq '[.actions[] | {sla, due_date, status}] | .[0:3]'
```

All returned rows must have `sla` matching the requested filter and `status === "open"`.

## Build

```bash
rm -rf .next && npm run build
```

Must pass.
