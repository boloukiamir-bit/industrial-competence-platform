# P1.1 Recommended Actions Autopop Verification

## Overview

HR can generate recommended compliance actions from the current risk state with a preview step. No workflow engine. Idempotent (no duplicate open actions for same org + site + employee + compliance + action_type).

## Rules (deterministic, in code)

- **Overdue** → `action_type = 'request_renewal'`, `due_date = asOf + 3 days`
- **Missing** → `action_type = 'request_evidence'`, `due_date = asOf + 7 days`
- **Expiring** (within `expiringDays`) → `action_type = 'notify_employee'`, `due_date = valid_to - 7 days` (clamped ≥ asOf)

Idempotency: do not recommend if an OPEN action already exists for same `org_id`, `site_id`, `employee_id`, `compliance_id`, `action_type`.

## API

### POST /api/compliance/actions/recommend/preview

**Auth:** Tenant + Admin/HR only. Same scoping as summary (including `activeSiteId` strict).

**Body:**
- `asOf` (YYYY-MM-DD, optional, default today)
- `expiringDays` (optional, default 30)
- `category` ("all" | "license" | "medical" | "contract")
- `line` (optional)
- `q` (optional search)

**Response:**
- `context`: activeSiteId, activeSiteName, asOf, expiringDays
- `counts`: willCreateTotal, skippedExistingTotal
- `byType`: request_renewal, request_evidence, notify_employee
- `preview`: list (max 200) of { employee_id, employee_name, compliance_code, compliance_name, reason, action_type, due_date }

### POST /api/compliance/actions/recommend/commit

**Body:** Same as preview + `maxCreate` (optional, default 200, max 500).

**Behavior:** Runs same computation as preview, then inserts rows for recommended items. Skips when an open action already exists (enforced by unique index).

**Response:** `createdCount`, `skippedCount`

## Idempotency (DB)

Partial unique index:

- `uniq_compliance_actions_open_per_scope` on `(org_id, COALESCE(site_id, zero-uuid), employee_id, compliance_id, action_type)` WHERE `status = 'open'`

Migration: `20260203180000_compliance_actions_recommend_idempotent.sql`

## curl

```bash
# Preview (use session cookies or dev bearer)
curl -s -X POST -b cookies.txt -H "Content-Type: application/json" \
  -d '{"expiringDays":30,"category":"all"}' \
  "https://<BASE>/api/compliance/actions/recommend/preview" | jq .

# Commit (same filters + optional maxCreate)
curl -s -X POST -b cookies.txt -H "Content-Type: application/json" \
  -d '{"expiringDays":30,"category":"all","maxCreate":200}' \
  "https://<BASE>/api/compliance/actions/recommend/commit" | jq .
```

## UI Checks

1. **Summary page:** As admin/hr, open `/app/compliance/summary`. "Generate recommended actions" button is visible in the Actions snapshot card.
2. **Open modal:** Click "Generate recommended actions" → modal opens, preview request runs (loading spinner).
3. **Preview content:** Modal shows counts (will create, skipped already open), by-type counts, and a table of first N recommendations (employee, compliance, reason, action type, due date).
4. **Create actions:** Click "Create actions" → commit request runs; on success: toast "Actions created" with count, modal closes, summary refetches.
5. **Action Inbox:** "Go to Action Inbox" (in modal when 0 to create, or in snapshot card) links to `/app/compliance/actions?status=open`.
6. **Idempotency:** Run "Generate recommended actions" again with same filters → preview shows same willCreateTotal; skippedExistingTotal includes the ones just created. Commit again → createdCount 0 or low, skippedCount high.
7. **No duplicates:** In Action Inbox, no duplicate open actions for same employee + compliance + action type.

## Build

```bash
rm -rf .next && npm run build
```

Must pass.
