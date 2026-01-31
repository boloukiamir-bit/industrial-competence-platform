# P0.17 Step 3: Tomorrow's Gaps + Cockpit decision center – verification

## Summary

- **Tomorrow's Gaps API**: Gaps computed per line and per station using `pl_machine_demand` (required_hours) and `pl_assignment_segments` (assigned hours). Uses **stations** table and `station_id` (with `machine_code` fallback). Root cause: **CAPACITY** (gap hours), **SKILLS** (no eligible meeting station skills), **COVERAGE** (eligible count below threshold). Response includes `root_cause`, `stations[]`, `missing_skill_codes`, `recommended_action`.
- **Tomorrow's Gaps page**: "View root cause" on NO-GO/WARNING cards opens **LineRootCauseDrawer** (station list, gap hours, eligible count, missing skill codes top 3, recommended action). Resolve opens existing ResolveModal; decisions write to `execution_decisions` with deterministic `target_id` (line+date+shift). "Show resolved" toggle works.
- **Cockpit**: "Top risks (Tomorrow's Gaps)" section fetches same engine; NO-GO/WARNING sorted by severity then gap hours; "View root cause" reuses **LineRootCauseDrawer**.
- **Decisions**: POST /api/tomorrows-gaps/decisions accepts optional `root_cause`; stored in `execution_decisions.root_cause` JSON.

## File paths and changes

### 1. `app/api/tomorrows-gaps/route.ts`

- Switched from `pl_machines` to **stations** (id, name, code, line); demand/assignments keyed by `station_id` and `machine_code` fallback.
- Per-line: per-station breakdown (`stations[]`: stationId, stationCode, stationName, requiredHours, assignedHours, gapHours).
- **root_cause**: `{ primary: CAPACITY | SKILLS | COVERAGE, causes: RootCauseType[] }`.
- **missing_skill_codes**: top 3 when no eligible operators and required skills exist.
- **recommended_action**: "assign" | "call_in" | "swap".
- **lineName**: uses `getLineName(lineCode)`.

### 2. `app/api/tomorrows-gaps/decisions/route.ts`

- Reads optional `body.root_cause` and stores in `root_cause` JSON (type, causes).

### 3. `components/line-overview/LineRootCauseDrawer.tsx` (new)

- Props: open, onOpenChange, line (with stations, root_cause, missing_skill_codes, recommended_action), date, shift, onResolve?.
- Content: root cause badge, station list with gap hours, eligible count, missing skill codes (top 3), recommended action, "Open Line Overview" link, optional "Resolve" button (calls onResolve(line)).

### 4. `app/app/tomorrows-gaps/page.tsx`

- Type `TomorrowsGapsLineRow`: added `root_cause`, `stations`, `missing_skill_codes`, `recommended_action`, `eligibleOperatorsCount`.
- LineCard: "View root cause" button (NO-GO/WARNING) opens LineRootCauseDrawer.
- State: `rootCauseDrawerLine`; drawer onResolve closes drawer and opens ResolveModal with same line.
- ResolveModal: POST body includes `root_cause: line.root_cause`.

### 5. `app/app/(cockpit)/cockpit/page.tsx`

- Type `GapsLineRow`; state `gapsLines`, `gapsLoading`, `rootCauseDrawerLine`.
- useEffect: fetch `/api/tomorrows-gaps?date=&shift=` (when !isDemo); set `gapsLines`.
- "Top risks (Tomorrow's Gaps)": NO-GO/WARNING sorted by severity then gap hours, up to 5 cards; "View root cause" opens LineRootCauseDrawer; link to Tomorrow's Gaps.
- LineRootCauseDrawer with same line/date/shift (no onResolve on Cockpit).

## Verification steps

1. **Generate demand for BEA day, zero assignments**  
   - POST /api/line-overview/demand/generate with date, shiftType Day, lineCode BEA.  
   - GET /api/tomorrows-gaps?date=…&shift=day → BEA line shows NO-GO with gap hours.

2. **Add one assignment**  
   - Create assignment for one station on BEA; refresh Tomorrow's Gaps → gap hours reduce; status may become WARNING or OK.

3. **Resolve one issue**  
   - Click Resolve on a line, save → line shows "Resolved"; refresh → resolved state persists (execution_decisions).

4. **View root cause**  
   - On NO-GO/WARNING card, click "View root cause" → drawer shows station list, gap hours, eligible count, missing skill codes (top 3), recommended action.

5. **Cockpit**  
   - Open Cockpit (non-demo); "Top risks (Tomorrow's Gaps)" shows same NO-GO/WARNING lines; "View root cause" opens same drawer.

## 3 curl examples

Replace `BASE_URL` and use a valid session cookie or Bearer token for an authenticated user with active org.

### 1) Gaps endpoint – output includes root_cause fields

```bash
BASE_URL="http://localhost:3000"

curl -s "$BASE_URL/api/tomorrows-gaps?date=2026-01-30&shift=day" \
  -H "Cookie: sb-<project>-auth-token=..." \
  | jq '.lines[0] | { lineCode, lineName, gapHours, competenceStatus, root_cause, stations: (.stations | length), missing_skill_codes, recommended_action }'
```

Expected: `root_cause` with `primary` and `causes`; `stations` array; `missing_skill_codes`; `recommended_action`.

### 2) Cockpit summary – includes same issues (from execution_decisions)

```bash
curl -s "$BASE_URL/api/cockpit/summary?date=2026-01-30&shift=Day" \
  -H "Cookie: sb-<project>-auth-token=..." \
  | jq '{ active_total, active_blocking, active_nonblocking, by_type }'
```

Expected: Counts and by_type; issues come from execution_decisions (resolved items still in DB with status active).

### 3) Decisions endpoint – write and read back

```bash
# Write (resolve) a line
curl -s -X POST "$BASE_URL/api/tomorrows-gaps/decisions" \
  -H "Content-Type: application/json" \
  -H "Cookie: sb-<project>-auth-token=..." \
  -d '{"date":"2026-01-30","shift":"day","line":"BEA","decision_type":"acknowledged","note":"Verified"}' \
  | jq .

# Read back: gaps response includes resolved flag for that line
curl -s "$BASE_URL/api/tomorrows-gaps?date=2026-01-30&shift=day" \
  -H "Cookie: sb-<project>-auth-token=..." \
  | jq '.lines[] | select(.lineCode=="BEA") | { lineCode, resolved }'
```

Expected: POST returns `{ success: true, resolution: { ... } }`; GET shows that line with `resolved: true` when a matching execution_decision exists.
