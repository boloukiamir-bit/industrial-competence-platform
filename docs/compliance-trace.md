# Cockpit compliance data path trace

End-to-end trace: UI → API → SQL/RPC/view. Used to confirm roster-scoping and data source determinism.

## 1. Cockpit compliance (canonical) — matrix-v2

| Layer | File | Detail |
|-------|------|--------|
| **UI entry** | `app/app/(cockpit)/cockpit/page.tsx` | Single `useEffect` fetches `/api/compliance/matrix-v2?date=...&shift_code=...` when `sessionOk` **and** `date` and `shiftCode` are set. Response drives both the **Requirements** block (counts, top_requirements) and the **Expiring** tile/panel (expiredCount, expiringCount, top10). No call until date+shift selected. |
| **API route** | `app/api/compliance/matrix-v2/route.ts` | `GET` → requires `date` + `shift_code` (400 SHIFT_CONTEXT_REQUIRED if missing). Roster via `getRosterEmployeeIdsForShift`. Same underlying data as overview-v2: `employees` (roster), `employee_compliance` (roster), `compliance_catalog`, `compliance_requirement_applicability`. Returns `readiness_flag` (LEGAL_NO_GO | LEGAL_WARNING | LEGAL_GO), `kpis`, `by_requirement`, `by_employee`, `expiring_sample`. |
| **SQL / tables** | employees, compliance_catalog, employee_compliance, compliance_requirement_applicability | Roster-scoped employees and assignments; catalog/applicability org-scoped. |
| **Scoping** | **Roster-scoped** | Scope = org_id + site_id + roster_employee_ids for that shift. Single canonical engine; no duplicated logic in cockpit. |

**Debug:** `GET /api/compliance/matrix-v2?date=YYYY-MM-DD&shift_code=Day&debug=1` returns `_debug` with `source`, `scope_inputs` (roster_employee_ids_count), `catalog_count`, `compliance_rows_count`.

### Endpoints no longer used by cockpit (kept for bake time)

| Endpoint | Note |
|----------|------|
| `/api/cockpit/requirements-summary-v2` | Cockpit now uses matrix-v2 for requirement counts; route unchanged. |
| `/api/compliance/overview-v2` | Cockpit now uses matrix-v2 for expiring/legal stoppers; route unchanged. |
| `/api/cockpit/requirements-summary` | Legacy org-wide; `_debug.mode: "legacy"`. |
| `/api/compliance/overview` | Legacy org-wide; `_debug.mode: "legacy"`. |

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

| Endpoint | Source | Used by cockpit |
|----------|--------|-----------------|
| `/api/compliance/matrix-v2` | tables: employees, compliance_catalog, employee_compliance, compliance_requirement_applicability (roster-filtered) | **Yes** (canonical; Requirements + Expiring) |
| `/api/cockpit/requirements-summary-v2` | view: v_employee_requirement_status (filtered by roster) | No (kept; bake time) |
| `/api/cockpit/requirements-summary` | rpc:get_requirements_summary_v1 | No (legacy) |
| `/api/compliance/overview-v2` | same tables as matrix-v2, roster-filtered | No (kept; bake time) |
| `/api/compliance/overview` | same tables, org-wide | No (legacy) |
| `/api/cockpit/summary` | view: v_cockpit_station_summary + lib evaluateEmployeeComplianceV2 | Yes (shift legitimacy) |
