# Data Provenance Map (P0.1)

Single-source-of-truth for core metrics. All tenant data must be filtered by `active_org_id` (or `org_id` where applicable).

## Page → API route(s) → DB table(s) → org_id filter

| Page | Data shown | API route(s) | DB table(s) | Required org_id filter |
|------|------------|--------------|-------------|------------------------|
| `/app/dashboard` | headcount, compliance risk, contracts ending, open workflows | (none; client Supabase) | `employees`, `person_events`, `hr_workflow_instances` | **Yes** – all queries must use `org_id` / active org |
| `/app/org/overview` | units count, employee count | (none; client `getOrgTree` + Supabase count) | `org_units`, `employees` | **Yes** – `org_units.org_id`, `employees.org_id` |
| `/app/competence-matrix` | skill columns, employee rows | (none; server `competenceService`) | `employees`, `skills`, `employee_skills` | **Yes** – `employees.org_id`; skills via employees in org |
| `/app/line-overview` | lines, machines list | `GET /api/line-overview`, `GET /api/line-overview/week` | `profiles` (active_org_id), `stations`, `pl_machines`, `pl_machine_demand`, `pl_assignment_segments`, `pl_attendance`, `pl_employees`, `shift_rules` | **Yes** – all tables use `org_id` or `active_org_id` |

## Tables without org_id (do not use for tenant-scoped metrics)

- **`public.positions`** – no `org_id`; do not use for multi-tenant data until migrated. APIs that would return cross-tenant data from this table must return an explicit error in dev. No API route in `app/api` currently uses `positions` for tenant data.

## Hard guard (P0.1)

- Dashboard, Organization, Competence Matrix, Line Overview: all use `org_id` or `active_org_id` (or scope via org’s employee ids). Demo data is only used when `NEXT_PUBLIC_DEMO_MODE=true` (default false); production never uses demo.

## Demo / hardcoded sources (P0.1 behavior)

- **Production**: never use demo/hardcoded data.
- **Dev**: demo data only when `NEXT_PUBLIC_DEMO_MODE=true` (default false). When `DEMO_MODE` is false, use tenant-scoped DB only.
- Known demo sources: `lib/demoData.ts`, `lib/demoRuntime.ts`, `services/competenceService.ts` (seedDemoDataIfEmpty, demo skill/employee constants), `lib/cockpitDemo.ts` (cockpit page only).
