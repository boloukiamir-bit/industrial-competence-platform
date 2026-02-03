# P1.0 Compliance Summary Verification

## Overview

Compliance Coverage Summary provides HR with a single-page executive view: risk + expirations + actions, scoped by tenant and site.

## API

### GET /api/compliance/summary

**Query params:**
- `asOf` (YYYY-MM-DD, optional, default today)
- `expiringDays` (default 30)
- `category` ("all" | "license" | "medical" | "contract")
- `line` (optional)
- `q` (optional search for employee name/number)
- `limitUpcoming` (default 50)

**Site scoping:** If `activeSiteId` in profile => strict site filter. Else => all sites.

**Response:**
- `context`: activeSiteId, activeSiteName, asOf, expiringDays, category
- `lines`: distinct lines in scope
- `kpis`: employeesWithMissing, employeesWithOverdue, employeesWithExpiring, employeesWithAnyIssue, totalEmployeesInScope
- `topRiskItems`: top 10 worst compliance items (missing, overdue, expiring, affected)
- `upcomingExpirations`: list sorted by days_left asc
- `actionsSnapshot`: openActionsCount, overdueActionsCount, due7dActionsCount, recentDoneActionsCount, openActions (top 20)

## curl

```bash
# Basic
curl -s -b cookies.txt "https://<BASE>/api/compliance/summary" | jq .

# With filters
curl -s -b cookies.txt "https://<BASE>/api/compliance/summary?expiringDays=14&category=license&line=LineA&q=smith" | jq .
```

## UI Checks

1. **Load:** Navigate to `/app/compliance/summary` as admin/hr. Page loads with KPIs, top risk items, upcoming expirations, actions snapshot.
2. **Site chip:** Shows "Site: X" when site selected, "Site: All" when not.
3. **Filters:** Change expiringDays, category, line, search → refetches.
4. **KPI values:** Any issues, Overdue, Missing, Expiring, Open actions render correctly.
5. **Top risk items:** Table shows Item, Missing, Overdue, Expiring, Affected.
6. **Upcoming expirations:** Click a row → ComplianceDrawer opens for that employee.
7. **Action Inbox link:** "Go to Action Inbox" navigates to `/app/compliance/actions`.
8. **Compliance page link:** On `/app/compliance`, "Compliance Summary" button (admin/hr only) links to summary.
