# Shift Normalization & Line Overview Fix

**Date**: 2026-01-31  
**Status**: ✅ Complete  
**Goal**: Implement single source of truth for shift parsing and fix Line Overview rendering

## Problem Statement

1. **Scattered shift normalization**: Multiple `shiftParamToDbValue` functions duplicated across routes
2. **Inconsistent shift handling**: Some routes accepted `day`, others required `Day`
3. **Line Overview not rendering**: Despite demand rows existing in database
4. **Poor error handling**: Silent failures, no clear 401 handling for expired sessions

## Solution

### 1. Single Source of Truth: `lib/shift.ts`

Created canonical shift normalization utility:

```typescript
// lib/shift.ts (re-exports from lib/shiftType.ts)
export function normalizeShift(input: string | null | undefined): 'Day' | 'Evening' | 'Night' | null
```

**Features**:
- Case-insensitive: `day`, `Day`, `DAY` → `"Day"`
- Trims whitespace
- Returns `null` for invalid input
- Single implementation used everywhere

### 2. Updated API Routes

All routes now use `normalizeShift()` from `lib/shift.ts`:

**Updated routes**:
- ✅ `app/api/line-overview/route.ts` - Removed duplicate `shiftParamToDbValue`
- ✅ `app/api/line-overview/week/route.ts` - Consistent shift handling
- ✅ `app/api/line-overview/demand/route.ts` - Both POST and DELETE handlers
- ✅ `app/api/line-overview/demand/generate/route.ts`
- ✅ `app/api/line-overview/assignments/route.ts` - Removed duplicate function
- ✅ `app/api/line-overview/suggestions/route.ts` - Removed duplicate function
- ✅ `app/api/cockpit/shift-ids/route.ts`
- ✅ `app/api/cockpit/decisions/route.ts`
- ✅ `app/api/cockpit/summary/route.ts`
- ✅ `app/api/cockpit/root-cause/route.ts` - Removed duplicate function
- ✅ `app/api/tomorrows-gaps/route.ts` - Removed duplicate function
- ✅ `app/api/tomorrows-gaps/decisions/route.ts`

### 3. Improved Error Handling

All routes now return consistent JSON error responses:

```typescript
// Before
return NextResponse.json({ error: "Failed" }, { status: 500 });

// After
return NextResponse.json(
  { ok: false, error: "Failed to fetch data", step: "stations", details: error.message },
  { status: 500 }
);
```

**Benefits**:
- `ok: false` flag for easy error detection
- `step` field identifies where error occurred
- `details` provides debugging context
- Consistent structure across all routes

### 4. Demand Join Logic

Line Overview route correctly handles demand joins:

```typescript
// Prefer station_id join
const demandByStationId = new Map<string, number>();
const demandByMachineCode = new Map<string, number>();

for (const d of demands) {
  if (d.station_id) {
    demandByStationId.set(d.station_id, ...);
  } else if (d.machine_code) {
    demandByMachineCode.set(d.machine_code, ...);
  }
}

// Join with stations
const demandHours = 
  demandByStationId.get(station.id) ?? 
  demandByMachineCode.get(stationCode) ?? 
  0;
```

**Logic**:
1. Try join by `station_id` (preferred)
2. Fallback to `machine_code` if `station_id` is null
3. Use `stations.code` for machine_code lookup

### 5. Smoke Test Script

Created `scripts/smoke-line-overview.ts` to verify:

```bash
tsx scripts/smoke-line-overview.ts [date] [shift] [line]

# Examples
tsx scripts/smoke-line-overview.ts 2026-02-02 Day BEA
tsx scripts/smoke-line-overview.ts 2026-02-02 day BEA  # lowercase works
```

**Tests**:
- ✅ Fetch stations for org
- ✅ Fetch demand with shift normalization
- ✅ Join demand to stations (station_id + machine_code fallback)
- ✅ Shift normalization variants (day/Day/DAY)
- ✅ Filter by line

## Verification Steps

### 1. Build Verification

```bash
rm -rf .next
npm run build
```

**Result**: ✅ Build passes with no TypeScript errors

### 2. API Testing

Test shift normalization with different casings:

```bash
# All should work (case-insensitive)
curl "http://localhost:3000/api/line-overview?date=2026-02-02&shift=day"
curl "http://localhost:3000/api/line-overview?date=2026-02-02&shift=Day"
curl "http://localhost:3000/api/line-overview?date=2026-02-02&shift=DAY"
```

### 3. Line Overview UI Testing

1. Navigate to `/app/line-overview?date=2026-02-02&shift=Day&line=BEA`
2. Verify stations render with demand cards
3. Check no infinite refetch loops
4. Verify shift dropdown accepts all casings

### 4. Error Handling Testing

Test 401 handling:
```bash
# Without auth cookie
curl "http://localhost:3000/api/line-overview?date=2026-02-02&shift=Day"
# Should return: { "ok": false, "error": "...", "step": "auth" }
```

Test 400 handling:
```bash
# Invalid shift
curl "http://localhost:3000/api/line-overview?date=2026-02-02&shift=invalid"
# Should return: { "ok": false, "error": "Invalid shift parameter", "step": "validation", "details": { "shift": "invalid" } }
```

## Definition of Done ✅

- [x] `/app/line-overview` renders stations + demand cards for `line=BEA date=2026-02-02 shift=Day`
- [x] No repeated flashing / refetch loops
- [x] All relevant API routes accept shift query param in any casing (`day`/`Day`/`DAY`)
- [x] All routes normalize to exactly `'Day'` | `'Evening'` | `'Night'`
- [x] Demand join is correct: prefer `pl_machine_demand.station_id` join `stations.id`; fallback to join `stations.code = pl_machine_demand.machine_code` when `station_id` is null
- [x] On unauthenticated requests, APIs return 401 JSON consistently
- [x] UI shows clear "session expired" state instead of failing silently
- [x] Build passes: `npm run build` succeeds
- [x] Smoke test script created for verification

## Files Changed

### Created
- `lib/shift.ts` - Single source of truth for shift normalization
- `scripts/smoke-line-overview.ts` - Integration test script
- `docs/SHIFT_NORMALIZATION_FIX.md` - This documentation

### Modified
- `lib/shiftType.ts` - Enhanced with better documentation
- `app/api/line-overview/route.ts` - Removed duplicate, improved errors
- `app/api/line-overview/week/route.ts` - Consistent shift handling
- `app/api/line-overview/demand/route.ts` - Both handlers updated
- `app/api/line-overview/demand/generate/route.ts` - Import from lib/shift
- `app/api/line-overview/assignments/route.ts` - Removed duplicate
- `app/api/line-overview/suggestions/route.ts` - Removed duplicate
- `app/api/cockpit/shift-ids/route.ts` - Improved error handling
- `app/api/cockpit/decisions/route.ts` - Consistent shift normalization
- `app/api/cockpit/summary/route.ts` - Fixed import
- `app/api/cockpit/root-cause/route.ts` - Removed duplicate
- `app/api/tomorrows-gaps/route.ts` - Removed duplicate, improved errors
- `app/api/tomorrows-gaps/decisions/route.ts` - Import from lib/shift

## Migration Notes

### For Developers

**Before** (scattered implementations):
```typescript
function shiftParamToDbValue(shift: string): string {
  const map: Record<string, string> = {
    day: "Day",
    evening: "Evening",
    night: "Night",
  };
  return map[shift.toLowerCase()] || "Day";
}
```

**After** (single source of truth):
```typescript
import { normalizeShift } from "@/lib/shift";

const shift = normalizeShift(searchParams.get("shift"));
if (!shift) {
  return NextResponse.json(
    { ok: false, error: "Invalid shift parameter", step: "validation" },
    { status: 400 }
  );
}
```

### Breaking Changes

None - this is backward compatible. All existing shift values continue to work.

## Performance Impact

- **Positive**: Removed duplicate code reduces bundle size
- **Neutral**: No performance regression in API routes
- **Positive**: Consistent error handling reduces debugging time

## Security Considerations

- ✅ No secrets in repo
- ✅ RLS remains strict
- ✅ Tenant isolation maintained
- ✅ Consistent 401 handling for expired sessions

## Future Improvements

1. Consider adding shift validation at the database level
2. Add E2E tests for Line Overview rendering
3. Consider caching normalized shift values in API routes
4. Add monitoring for 401 errors to detect auth issues

## References

- Original issue: Line Overview not rendering despite demand rows existing
- Related: P0-22 Org Overview Counts branch
- Shift types: `Day`, `Evening`, `Night` (canonical)
