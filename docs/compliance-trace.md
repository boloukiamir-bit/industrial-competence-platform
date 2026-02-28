# Cockpit compliance data path trace

End-to-end trace: UI → API → SQL/RPC/view. Used to confirm roster-scoping and data source determinism.

## 1. Cockpit requirements block (GO / WARNING / ILLEGAL counts) — roster-scoped (v2)

| Layer | File | Detail |
|-------|------|--------|
| **UI entry** | `app/app/(cockpit)/cockpit/page.tsx` | `useEffect` fetches `/api/cockpit/requirements-summary-v2?date=...&shift_code=...` when `sessionOk` **and** `date` and `shiftCode` are set. No call until date+shift selected (avoids 400). |
| **API route** | `app/api/cockpit/requirements-summary-v2/route.ts` | `GET` → requires `date` + `shift_code` (400 SHIFT_CONTEXT_REQUIRED if missing). Resolves roster via `getRosterEmployeeIdsForShift` (shifts + shift_assignments), then queries `v_employee_requirement_status` filtered by `employee_id IN (roster_employee_ids)`. |
| **SQL / lib** | View `v_employee_requirement_status`; helper `lib/server/getRosterEmployeeIdsForShift.ts` | Roster = first shift matching org/site/date/shift_code → shift_assignments.employee_id. Requirement rows filtered by roster; counts and top_requirements aggregated in route (incl. affected_employee_count per requirement). |
| **Scoping** | **Roster-scoped** | Scope = org_id + site_id + roster_employee_ids for that shift. Counts change when switching date/shift. |

**Debug:** `GET /api/cockpit/requirements-summary-v2?date=YYYY-MM-DD&shift_code=Day&debug=1` returns `_debug` with `roster_scoping: true`, `roster_employee_ids_count`, `source`, `scope_inputs`.

### Legacy endpoint (unchanged)

| Layer | File | Detail |
|-------|------|--------|
| **API route** | `app/api/cockpit/requirements-summary/route.ts` | Same as before: `get_requirements_summary_v1(p_org_id, p_site_id)`. **Not used by cockpit UI** after v2 rollout. |
| **Scoping** | **Org-wide (site-optional)** | No roster. When `?debug=1`, response includes `_debug.mode: "legacy"`. |

---

## 2. Compliance expiring / Legal Stoppers (overview table)

| Layer | File | Detail |
|-------|------|--------|
| **UI entry** | `app/app/(cockpit)/cockpit/page.tsx` | `useEffect` (around line 724) fetches `/api/compliance/overview` when `sessionOk`; optional client-side filter by `line` on rows. |
| **API route** | `app/api/compliance/overview/route.ts` | `GET` → `getActiveOrgFromSession`; queries `employees`, `compliance_catalog`, `employee_compliance`, `compliance_requirement_applicability`. Optional query params: `siteId`, `category`, `status`, `search`. |
| **SQL objects** | Tables (no RPC) | `employees`, `compliance_catalog`, `employee_compliance`, `compliance_requirement_applicability`. Org-scoped; optional site filter on employees. |
| **Scoping** | **Org-wide (site-optional)** | No roster scoping. No date, shift, or roster employee list. |

**Debug:** `GET /api/compliance/overview?debug=1` returns `_debug` with `source`, `scope_inputs`, `requirement_count`, `employees_count`.

---

## 3. Shift legitimacy (cockpit summary, date+shift)

| Layer | File | Detail |
|-------|------|--------|
| **UI entry** | Cockpit uses `/api/cockpit/summary` when date + shift are selected (shift legitimacy, issue counts). | Triggered from cockpit summary/issue flow with `date`, `shift_code`, optional `line`. |
| **API route** | `app/api/cockpit/summary/route.ts` | Uses `v_cockpit_station_summary` (via `fetchCockpitIssues`) and for roster-scoped legitimacy calls `evaluateEmployeeComplianceV2` per employee from roster. |
| **SQL / lib** | View `v_cockpit_station_summary`; lib `lib/server/compliance/evaluateEmployeeComplianceV2` | View is roster/date/shift-based. Compliance evaluation is per-employee (roster-scoped). |
| **Scoping** | **Roster-scoped** | Employee list comes from roster for the selected date/shift; compliance and legitimacy are computed for that set. |

**Debug:** `GET /api/cockpit/summary?date=...&shift_code=...&debug=1` (or `_debug=1` in this route) returns `_debug` with data source and scope (see existing implementation in route).

---

## Objects not used by cockpit compliance UI

- `get_compliance_matrix_aggregated` — not referenced in app/lib.
- `calculate_compliance_station_shift_v2` — used only inside `calculate_industrial_readiness_v2` (migration), not by cockpit API routes.
- `v_employee_compliance_blockers_pilot` — not referenced in app/lib.
- `v_employee_compliance_status` — not used by current cockpit compliance endpoints (cockpit uses `v_employee_requirement_status` and tables above).
- `v_active_compliance_requirements` — catalog view; used by HR catalog/requirements flows, not by cockpit compliance summary/overview.

---

## Summary

| Endpoint | Source | Roster-scoped |
|----------|--------|----------------|
| `/api/cockpit/requirements-summary-v2` | view: v_employee_requirement_status (filtered by roster employee_ids); roster via getRosterEmployeeIdsForShift | **Yes** (cockpit uses this) |
| `/api/cockpit/requirements-summary` | rpc:get_requirements_summary_v1 (view: v_employee_requirement_status) | No (legacy; _debug.mode: "legacy") |
| `/api/compliance/overview` | tables: employees, compliance_catalog, employee_compliance, compliance_requirement_applicability | No |
| `/api/cockpit/summary` | view: v_cockpit_station_summary + lib evaluateEmployeeComplianceV2 | Yes |
