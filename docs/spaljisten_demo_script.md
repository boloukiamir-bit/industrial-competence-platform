# Spaljisten Demo Script (7 minutes)

## Pre-Demo Checklist
- [ ] Logged in as Daniel Buhre (daniel.buhre@spaljisten.se) or dev mode enabled
- [ ] Data reset and clean import completed
- [ ] Browser console open for troubleshooting

---

## Demo Flow (7 minutes)

### 1. Introduction (1 min)
"Welcome to Spaljisten's Skill Matrix system. This tool helps you identify skill gaps and coverage risks across your production areas."

### 2. Dashboard Overview (2 min)
Navigate to: `/app/spaljisten/dashboard`

Point out:
- **Tenant Banner**: Shows org name, ID, and current counts (Areas, Employees, Skills, Ratings)
- **KPI Cards**: Total employees, areas, skills, and independent rate percentage
- **Risk Definitions**:
  - Independent = rating >= 3
  - Recommended minimum coverage = 2

### 3. Risk Analysis (2 min)
Show the **Top 10 Risk Skills** table:
- **Critical (Red)**: No independent coverage - no one can do this skill independently
- **Warning (Yellow)**: Single point of failure - only 1 person can do this independently
- **OK (Green)**: Coverage OK - 2+ people can do this independently

Expand a skill in the **Skill Gap Details** section to show:
- Individual employee ratings
- Which area each employee belongs to

### 4. Area Filtering (1 min)
Demonstrate filtering:
1. Select an area from the dropdown (e.g., "Bearbetning")
2. Show that only skills for that area appear
3. Point out that counts in the banner update

### 5. Export (1 min)
Click **Export CSV**:
- Show the downloaded file
- Confirm rows match what's visible on dashboard
- Explain columns: Station, Skill, Independent Count, Total, Risk Level, Employee Names

---

## Key Messages
1. "Single point of failure" means business continuity risk
2. The system uses a 0-5 rating scale where 3+ = independent
3. All data is org-scoped and GDPR compliant
4. Imports are idempotent - re-importing doesn't create duplicates

---

## Troubleshooting
If dashboard shows 0 counts:
1. Check tenant banner for org_id
2. Navigate to Import page and verify data was imported
3. Check browser console for errors

If filter shows wrong data:
1. Verify skill->station->area relationships in database
2. Re-import stations.csv with correct area_code mappings
