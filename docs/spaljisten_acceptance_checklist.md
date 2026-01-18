# Spaljisten Acceptance Checklist

## GATE 1: Data Integrity

### P0-2.1 UNIQUE CONSTRAINTS
- [ ] sp_areas has UNIQUE(org_id, area_code)
- [ ] sp_stations has UNIQUE(org_id, station_code)
- [ ] sp_employees has UNIQUE(org_id, employee_id)
- [ ] sp_skills has UNIQUE(org_id, skill_id)
- [ ] sp_employee_skills has UNIQUE(org_id, employee_id, skill_id)

### P0-2.2 IMPORT IS PURE UPSERT
- [ ] Import same CSV twice -> counts unchanged
- [ ] No duplicate rows after re-import
- [ ] Updated timestamps show for updated rows

### P0-2.3 RESET IS ORG-SCOPED
- [ ] Reset only deletes data for current org_id
- [ ] Other orgs' data is unaffected
- [ ] Counts show 0 after reset

### P0-2.4 EMPLOYEES DON'T CREATE AREAS
- [ ] Import employees with unknown area_code -> FAILS with error
- [ ] Error message says: "Unknown area_code. Import areas.csv first."
- [ ] No ghost areas created

---

## GATE 2: Filter + Export Match

### P0-3.1 FILTER LOGIC IS TRUTHFUL
- [ ] Select area "Bearbetning" -> only Bearbetning skills shown
- [ ] No cross-area skills in results
- [ ] Filter path: skill -> station -> area

### P0-3.2 EXPORT MATCHES DASHBOARD
- [ ] Export row count == visible skill count on dashboard
- [ ] Same filter applied to both
- [ ] Same sorting (Critical -> Warning -> OK)
- [ ] Same inclusion condition (totalEmployees > 0)

---

## GATE 3: UX Clarity

### P0-4.1 WARNING MEANING IS CLEAR
- [ ] CRITICAL shows: "No independent coverage"
- [ ] WARNING shows: "Single point of failure"
- [ ] OK shows: "Coverage OK (X+ people)"
- [ ] Banner shows: "Independent = rating >= 3"
- [ ] Banner shows: "Recommended minimum coverage = 2"

---

## DEFINITION OF DONE

- [ ] Areas count is exactly 5 (no duplicates)
- [ ] Re-import does not change counts
- [ ] Area filter is truthful (no cross-area)
- [ ] Export matches dashboard 1:1
- [ ] WARNING wording includes "Single point of failure"
- [ ] All changes committed to git

---

## Sign-Off

| Gate | Status | Verified By | Date |
|------|--------|-------------|------|
| Gate 1 | | | |
| Gate 2 | | | |
| Gate 3 | | | |

**Final Approval**: _________________ Date: _________
