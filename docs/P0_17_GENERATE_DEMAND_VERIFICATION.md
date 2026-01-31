# P0.17 Generate demand template – verification

## What was added

- **API**: `POST /api/line-overview/demand/generate` (admin/HR only)
  - Body: `{ date, shiftType, lineCode, hoursPerStation? }`
  - Creates/updates demand rows for all active stations in the given line (tenant-scoped).
  - Idempotent: upsert by `(org_id, plan_date, shift_type, station_id)`.
- **UI**: Line Overview – per-line "Generate demo demand" button (visible to admin/HR).
- **SQL**: Unique index `uniq_pl_machine_demand_org_date_shift_station` for upsert.

## Verification

1. **After click**: Line Overview shows required hours > 0 for that line and gap calculations update.
2. **Curl example** (replace `BASE_URL` and use a valid session cookie or Bearer token for an admin/HR user):

```bash
BASE_URL="http://localhost:3000"

# With cookie (copy from browser after logging in as admin):
curl -X POST "$BASE_URL/api/line-overview/demand/generate" \
  -H "Content-Type: application/json" \
  -H "Cookie: sb-<project>-auth-token=..." \
  -d '{"date":"2026-01-30","shiftType":"Day","lineCode":"BEA","hoursPerStation":8}'

# With Bearer token:
curl -X POST "$BASE_URL/api/line-overview/demand/generate" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -d '{"date":"2026-01-30","shiftType":"Day","lineCode":"BEA","hoursPerStation":8}'
```

Expected response (example): `{"created":23,"updated":0}` when 23 active stations exist for line BEA (Bearbetning) and no prior demand rows.

3. **Acceptance test** (Spaljisten org, line BEA = Bearbetning):
   - Delete legacy demand rows for 2026-01-30 Day for that org (e.g. old rows with machine_code B-01/B-02/B-03 that had no station_id or wrong code).
   - Call generate with `date=2026-01-30`, `shiftType=Day`, `lineCode=BEA`.
   - Expect `created=23`, `updated=0` (when 23 active stations for Bearbetning).
   - DB: `SELECT count(*), count(station_id) FROM pl_machine_demand WHERE org_id=<spaljisten> AND plan_date='2026-01-30' AND shift_type='Day'` → total=23, with_station_id=23.
   - No rows have `machine_code` in ('B-01','B-02','B-03') unless those are actual `stations.code` values.
