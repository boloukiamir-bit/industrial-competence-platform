# P1.9 Compliance Daily Digest — Verification

## Overview

- **DB:** `public.compliance_daily_digests` — one row per (org_id, site_id, digest_date); payload = digest JSON.
- **GET /api/compliance/digest** — Live digest (Admin/HR, tenant-scoped). Params: `asOf`, `expiringDays`. Optional site filter via session `activeSiteId`.
- **POST /api/cron/compliance-digest** — Cron: generates digests for all orgs/sites. Protected by `CRON_SECRET` header. Idempotent UPSERT.
- **GET /api/compliance/digest/latest** — Latest stored digest for current org/site (Admin/HR). Used by Summary page “Latest digest” card.

---

## 1. SQL to inspect the table

Run in Supabase SQL Editor (service role or as org member for RLS).

```sql
-- List recent digests (all orgs; service role or RLS will filter by org for authenticated)
SELECT id, org_id, site_id, digest_date, created_at,
       jsonb_pretty(payload) AS payload_preview
FROM public.compliance_daily_digests
ORDER BY digest_date DESC, org_id, site_id NULLS FIRST
LIMIT 20;
```

```sql
-- Count by org and digest_date
SELECT org_id, digest_date, COUNT(*) AS rows
FROM public.compliance_daily_digests
GROUP BY org_id, digest_date
ORDER BY digest_date DESC, org_id;
```

---

## 2. Curl: GET digest (live)

Replace `<BASE_URL>` with your app origin (e.g. `http://localhost:3000`). Use session cookie or Bearer token. Admin/HR only.

```bash
# Default (today, expiringDays=30)
curl -b cookies.txt "<BASE_URL>/api/compliance/digest"

# With params
curl -b cookies.txt "<BASE_URL>/api/compliance/digest?asOf=2025-02-04&expiringDays=30"
```

Expected JSON shape (excerpt):

- `ok: true`
- `context`: `{ orgId, activeSiteId, activeSiteName, asOf, expiringDays }`
- `kpis`: `{ open, overdue, due7d, nodue, unassigned, withEvidence, withoutEvidence }`
- `topItems`: array (max 10) `{ compliance_code, compliance_name, category, overdueCount, expiringCount, missingCount }`
- `topActions`: array (max 20) enriched actions with `sla`, `owner_user_id`, `due_date`, `employee_name`, `evidence_status`, `last_drafted_at`
- `links`: `{ inboxOverdue, inboxDue7d, inboxUnassigned, summary }` (paths)

---

## 3. Curl: GET digest/latest

```bash
curl -b cookies.txt "<BASE_URL>/api/compliance/digest/latest"
```

Expected: `{ ok: true, digest: { id, digest_date, created_at, context, kpis, topItems, topActions, links } }` or `digest: null` if none.

---

## 4. Curl: Cron with secret

Set `CRON_SECRET` in env (e.g. in `.env` or deployment). Then:

```bash
# Header x-cron-secret
curl -X POST -H "x-cron-secret: YOUR_CRON_SECRET" "<BASE_URL>/api/cron/compliance-digest"

# Or Bearer
curl -X POST -H "Authorization: Bearer YOUR_CRON_SECRET" "<BASE_URL>/api/cron/compliance-digest"
```

Expected: `{ ok: true, digestsCreated, digestsSkipped }`. Without valid secret: `401` and `{ ok: false, step: "unauthorized", error: "..." }`.

---

## 5. UI checks

1. **Compliance → Summary** — As Admin/HR, open `/app/compliance/summary`.
2. **Latest digest card** — If at least one digest exists for the current org/site, a “Latest digest” card appears with:
   - Digest date
   - KPIs: Open, Overdue, Due <7d, No due, Unassigned, With evidence, Without evidence
   - Links: Overdue, Due 7d, Unassigned, Summary (each goes to the corresponding inbox/summary view).
3. **Site scope** — With a site selected in the org switcher, latest digest and live digest are scoped to that site.

---

## Constraints (from spec)

- No new dependencies.
- Tenant-safe: all data scoped by org; optional site. No cross-org leakage.
- Cron: batch by org; avoid N+1 where possible.
- `npm run build` and `npm test --silent` must pass.
