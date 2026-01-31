# P0.17 Step 2: SuggestModal / AssignmentDrawer for large headcount (89 employees)

## Summary

- **SuggestModal**: Already had search, Eligible/Ineligible tabs, sticky header with counts, and ineligible grouped by reason (collapsed). Refinements: sort Eligible by **score (best-first)** then alphabetical; ineligible sort alphabetical; added short copy “N ineligible — expand by reason below”; increased list max-height to 50vh.
- **AssignmentDrawer**: Added **client-side search** (name + employee number) for both the “New Assignment” employee Select and the “Available Employees” list; single search state so both stay in sync; count “X of Y” when filtered; increased Available Employees list to `max-h-[40vh]` for scrolling.

No backend changes.

---

## File paths and changes

### 1. `components/line-overview/SuggestModal.tsx`

**Diffs (summary):**

- **Eligible sort**: Replaced `stationsPassed`-then-`employeeCode` with **score (desc)** then **fullName** (case-insensitive). If `score` is missing, falls back to alphabetical.
- **Ineligible sort**: Alphabetical by fullName/employeeCode (case-insensitive).
- **Ineligible tab**: Added one-line summary: “{N} ineligible — expand by reason below” above the reason groups (all groups remain collapsed by default).
- **Scroll area**: `max-h-[40vh]` → `max-h-[50vh]` for Eligible and Ineligible lists.
- **Test ids**: `data-testid="eligible-list"` and `data-testid="ineligible-list"` on scroll containers.

**Existing (unchanged):**

- Search input (client-side) matching `fullName` and `employeeNumber`/`employeeCode`.
- Tabs: Eligible (default), Ineligible.
- Sticky header with “Eligible X” / “Ineligible Y”.
- Ineligible grouped by reason (stations/skills) with Collapsible; all collapsed by default.
- Apply button only on Eligible rows.

### 2. `components/line-overview/AssignmentDrawer.tsx`

**Diffs (summary):**

- **State**: `employeeSearchQuery` (string), reset when drawer opens.
- **Filter**: `filteredEmployees` = filter `selectableEmployees` by `name` and `code` (employee number) containing `employeeSearchQuery` (case-insensitive, client-side).
- **New Assignment form**:
  - Search input above the Employee Select (same placeholder as SuggestModal).
  - Select options use `filteredEmployees` instead of `selectableEmployees`.
  - When `q` is set: “Showing X of Y employees” under the Select.
- **Available Employees**:
  - Sticky-style header with count: “X of Y” when filtered, else “Y” only.
  - Search input above the list (same `employeeSearchQuery` as form).
  - List renders `filteredEmployees`; empty state: “No employees match ‘…’”.
  - List container: `max-h-48` → `max-h-[40vh]`.
- **Test ids**: `data-testid="assignment-drawer-search"` and `data-testid="assignment-drawer-available-search"`.

---

## Before / after behavior checklist

### SuggestModal

| Before | After |
|--------|--------|
| Eligible list sorted by station coverage then employee code | Eligible list sorted by **score (best-first)** then name (alphabetical) |
| Ineligible: only grouped by reason, no summary | Ineligible: “N ineligible — expand by reason below” + same groups (collapsed) |
| List height 40vh | List height **50vh** for both tabs |
| Search + tabs + counts already present | Same; sort and copy improved |

### AssignmentDrawer

| Before | After |
|--------|--------|
| Single long list of all employees (e.g. 89) in Select and “Available Employees” | **Search** filters both by name and employee number; same filter in form and list |
| No count when many employees | **“X of Y”** (or “Y”) in header and under Select when filtered |
| “Available Employees” max-h-48 (short) | **max-h-[40vh]** for scroll with many employees |
| No empty state for filter | **“No employees match ‘…’”** when search has no results |

### Verification (89 employees)

- **Eligible tab**: Opens on default tab; list is score-ordered; search narrows in &lt;100ms (client-side).
- **Ineligible tab**: Does not overwhelm; summary line + collapsed-by-reason groups; expand only what’s needed.
- **AssignmentDrawer**: Search in “New Assignment” and “Available Employees” narrows list; count updates; no backend calls for filter.

---

## Optional manual tests

1. **SuggestModal**: Open for a station with 89 suggestions; confirm Eligible tab default, score order, then type name/number and confirm list shrinks quickly.
2. **SuggestModal**: Switch to Ineligible; confirm “N ineligible — expand by reason below” and that groups are collapsed; expand one reason and confirm names.
3. **AssignmentDrawer**: Open for a station; open “Add” / “New Assignment”; type in search; confirm Select options and “Available Employees” list both filter and show “X of Y”.
4. **AssignmentDrawer**: Clear search; confirm full list and count; search for a non-existent string; confirm “No employees match …”.
