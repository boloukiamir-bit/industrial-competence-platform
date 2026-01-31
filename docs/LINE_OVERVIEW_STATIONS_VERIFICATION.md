# Line Overview – Stations Verification

Line Overview uses **DB stations** as machines (no demo/hardcoded pl_machines). Tenant scope from `getActiveOrgFromSession` (active_org_id, active_site_id).

## Exact file paths + summary of changes

| File | Change |
|------|--------|
| `app/api/line-overview/route.ts` | Use `getActiveOrgFromSession`; fetch stations (id, name, code, line) instead of pl_machines; build lineData from stations; employees scoped by org + optional site_id. |
| `app/api/line-overview/week/route.ts` | Use `getActiveOrgFromSession`; fetch stations instead of pl_machines; build lineData from stations. |
| `app/api/line-overview/assignments/route.ts` | Use `getActiveOrgFromSession`; resolve line from stations (by code or id) instead of pl_machines. |
| `app/api/line-overview/suggestions/route.ts` | Use `getActiveOrgFromSession`; resolve line from stations (by code or id); employees scoped by org + optional site_id. |
| `app/api/line-overview/lines/route.ts` | **New.** GET distinct lines from stations for active tenant (session-scoped). |
| `app/api/line-overview/stations/route.ts` | **New.** GET stations (station_name + station_code per line) for active tenant. |
| `docs/LINE_OVERVIEW_STATIONS_VERIFICATION.md` | **New.** Verification SQL + curl examples + UI checks. |

No UI component changes: MachineCard already shows `machineName` + `machineCode` (now station_name + station_code). Assignment drawer already receives `employees` from the main GET (now org + site + is_active).

## Verification SQL (counts per line from stations)

Run against your tenant org (replace `'a1b2c3d4-...'` with actual `org_id` and optionally filter by `site_id` if column exists):

```sql
-- Count stations per line for tenant
SELECT line, COUNT(*) AS station_count
FROM public.stations
WHERE org_id = 'a1b2c3d4-...'  -- replace with active org_id
  AND is_active = true
  AND line IS NOT NULL
GROUP BY line
ORDER BY line;
```

Expected for Spaljisten: 5 lines (OMM, BEA, PAC, LOG, UND) with counts per line.

```sql
-- List station names and codes per line (match stations.csv: Schelling, Homag, etc.)
SELECT line, code AS station_code, name AS station_name
FROM public.stations
WHERE org_id = 'a1b2c3d4-...'
  AND is_active = true
  AND line IS NOT NULL
ORDER BY line, name;
```

## API curl examples

**1) Lines (distinct lines from stations, session-scoped)**

```bash
curl -s -b cookies.txt -c cookies.txt \
  'http://localhost:3000/api/line-overview/lines'
```

Expected: `{ "lines": ["BEA", "LOG", "OMM", "PAC", "UND"] }` (or your tenant’s line codes, sorted).

**2) Stations (all stations for tenant, session-scoped)**

```bash
curl -s -b cookies.txt -c cookies.txt \
  'http://localhost:3000/api/line-overview/stations'
```

Expected: `{ "stations": [ { "id": "...", "station_name": "Schelling ...", "station_code": "...", "line": "BEA" }, ... ] }`.

Use session cookies from a logged-in user with `active_org_id` set to the Spaljisten org. Without cookies you get 401/403.

## UI checks

- **Line selector / list**: All 5 lines (OMM, BEA, PAC, LOG, UND) appear when stations exist for that org.
- **Cards**: Each card shows **station_name** + **station_code** (from `stations` table).
- **Assignment drawer**: Employee dropdown uses active employees (org_id + site_id when set + is_active=true); with 89 employees the list populates.

## Optional: leader header per line

If `area_leaders` (or equivalent) exists and is imported, a leader header per line can be added later; otherwise keep placeholder until imported.

---

## Station_id hardening (canonical key)

Demand and assignments use **station_id (uuid)** as the canonical key; **machine_code** is display-only.

### SQL: confirm demand/assignments have station_id

```sql
-- Demand: rows with station_id not null (after backfill)
SELECT 'pl_machine_demand' AS tbl, COUNT(*) AS total, COUNT(station_id) AS with_station_id
FROM public.pl_machine_demand
UNION ALL
SELECT 'pl_assignment_segments', COUNT(*), COUNT(station_id)
FROM public.pl_assignment_segments;
```

After migration backfill, `with_station_id` should equal `total` for matched rows. Unmatched legacy rows may have null `station_id`.

### UI checks

- Selecting a line shows **line_name** (e.g. Bearbetning, Ommantling) in the header; **line_code** is used for keys.
- Station cards show **station_name** + **station_code**; assignment saving uses **station_id** and works reliably.
