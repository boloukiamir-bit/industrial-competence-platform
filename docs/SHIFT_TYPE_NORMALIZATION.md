# Shift type normalization (P0.21 Step 2)

Canonical internal representation: **"Day" | "Evening" | "Night"**. APIs accept both cases (Day/day, etc.) and normalize to canonical for DB and comparisons.

## Helper: `lib/shiftType.ts`

- **normalizeShiftType(input)**: returns `"Day" | "Evening" | "Night" | null` (null if invalid).
- **toQueryShiftType(canonical)**: returns `"day" | "evening" | "night"` for URLs/query params.
- **normalizeShiftTypeOrDefault(input)**: returns canonical or `"Day"` if invalid (used in APIs).

## File list (changes)

| File | Change |
|------|--------|
| `lib/shiftType.ts` | **New.** normalizeShiftType, toQueryShiftType, normalizeShiftTypeOrDefault. |
| `app/api/tomorrows-gaps/route.ts` | Use normalizeShiftTypeOrDefault for query `shift`. |
| `app/api/tomorrows-gaps/decisions/route.ts` | Normalize body `shift` to canonical before lineShiftTargetId. |
| `app/api/line-overview/route.ts` | Use normalizeShiftTypeOrDefault for query `shift`. |
| `app/api/line-overview/week/route.ts` | Use normalizeShiftTypeOrDefault for query `shift`. |
| `app/api/line-overview/demand/route.ts` | Use normalizeShiftTypeOrDefault for body/query `shift`. |
| `app/api/line-overview/demand/generate/route.ts` | Use normalizeShiftTypeOrDefault for body `shiftType`. |
| `app/api/line-overview/assignments/route.ts` | Use normalizeShiftTypeOrDefault for body `shift`. |
| `app/api/line-overview/suggestions/route.ts` | Use normalizeShiftTypeOrDefault for body `shift`. |
| `app/api/cockpit/summary/route.ts` | Normalize query `shift`; use canonical in lineShiftTargetId. |
| `app/api/cockpit/shift-ids/route.ts` | Normalize query `shift` to canonical. |
| `app/api/cockpit/decisions/route.ts` | Normalize query `shift`; use canonical in lineShiftTargetId. |
| `app/api/cockpit/root-cause/route.ts` | Use normalizeShiftTypeOrDefault instead of local shiftParamToDbValue. |

## 3 curl examples (both forms return same behavior)

Replace `BASE` with your app origin (e.g. `http://localhost:3000`) and ensure auth cookies/session if required.

### 1. Tomorrow's Gaps — `shift=day` vs `shift=Day`

```bash
# lowercase
curl -s -b cookies.txt "$BASE/api/tomorrows-gaps?date=2026-02-01&shift=day" | jq '.lines | length'

# canonical
curl -s -b cookies.txt "$BASE/api/tomorrows-gaps?date=2026-02-01&shift=Day" | jq '.lines | length'
```

Both should return the same `lines` array length and structure.

### 2. Generate demand — body `shiftType: "day"` vs `"Day"`

```bash
# lowercase
curl -s -X POST -H "Content-Type: application/json" -b cookies.txt -d '{"date":"2026-02-01","shiftType":"day","lineCode":"BEA","hoursPerStation":8}' "$BASE/api/line-overview/demand/generate" | jq .

# canonical
curl -s -X POST -H "Content-Type: application/json" -b cookies.txt -d '{"date":"2026-02-01","shiftType":"Day","lineCode":"BEA","hoursPerStation":8}' "$BASE/api/line-overview/demand/generate" | jq .
```

Both should return the same `created`/`updated` behavior (and same DB `shift_type` = "Day").

### 3. Cockpit summary — `shift=evening` vs `shift=Evening`

```bash
# lowercase
curl -s -b cookies.txt "$BASE/api/cockpit/summary?date=2026-02-01&shift=evening" | jq '.active_total'

# canonical
curl -s -b cookies.txt "$BASE/api/cockpit/summary?date=2026-02-01&shift=Evening" | jq '.active_total'
```

Both should return the same summary (same `shift_type` filter in DB).
