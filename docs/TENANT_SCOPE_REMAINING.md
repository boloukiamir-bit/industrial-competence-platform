# Tenant scope: remaining client-side usage

Session-scoped `active_org_id` is canonical. CORE flows must not use client-side Supabase with `currentOrg.id`; all data must come from server APIs scoped by `getActiveOrgFromSession`.

## CORE kill list (fixed)

Every CORE file that previously used `supabase.from(...).eq("org_id", currentOrg.id)` or similar:

| File | Line(s) | Fix |
|------|--------|-----|
| `app/app/employees/page.tsx` | 7 (import), 336 (supabase.auth.getSession) | Removed supabase; PATCH uses credentials only |
| `app/app/employees/[id]/page.tsx` | 25 (import), 157–163 (supabase.from), getMeetingsForEmployee | New `GET /api/employees/[id]/profile`; page uses API only |
| `app/app/admin/users/page.tsx` | 6 (import), 94, 118, 136 (orgId in body) | APIs use getActiveOrgFromSession; client no longer sends orgId |

## CORE pages checklist

- [x] **Cockpit** — `app/app/(cockpit)/cockpit/page.tsx` — No client Supabase; uses APIs only.
- [x] **Line Overview** — `app/app/line-overview/page.tsx` — No client Supabase; uses `services/lineOverview` (API).
- [x] **Tomorrow's Gaps** — `app/app/tomorrows-gaps/page.tsx` — No client Supabase; uses `GET /api/tomorrows-gaps`.
- [x] **Employees (list)** — `app/app/employees/page.tsx` — Fixed: no supabase; `GET /api/employees`, PATCH with credentials only.
- [x] **Employees (detail)** — `app/app/employees/[id]/page.tsx` — Fixed: no supabase; `GET /api/employees/[id]` + `GET /api/employees/[id]/profile`.
- [x] **Org Overview** — `app/app/org/overview/page.tsx` — No client Supabase; uses `GET /api/org/units`.
- [x] **Competence Matrix** — `app/app/competence-matrix/page.tsx` — Server Supabase only (RSC); no client import.
- [x] **Setup** — `app/app/setup/page.tsx` — No client Supabase; uses `GET /api/setup/progress`.
- [x] **Admin Users** — `app/app/admin/users/page.tsx` — Fixed: no supabase; invite/role/disable APIs use session org; client does not pass orgId.

## Lint rule

ESLint `no-restricted-imports` forbids `@/lib/supabaseClient` in the CORE page paths listed in `eslint.config.mjs`. Use server APIs only.

## Verification

1. **Switch org in UI** → `POST /api/me/active-org` (body: `{ active_org_id }`).
2. **Navigate CORE pages** — Cockpit, Line Overview, Tomorrow's Gaps, Employees, Org Overview, Competence Matrix, Setup, Admin Users — all show data for the same org without refresh.
3. **5 curl examples** (session = cookies or Bearer; responses include or are scoped by session org):

```bash
# 1) Employees list (org_id in each employee or 403 if no org)
curl -s -H "Cookie: sb-<project-ref>-auth-token=..." "https://<BASE_URL>/api/employees"

# 2) Employee detail (tenant-scoped; 404 if wrong org)
curl -s -H "Cookie: sb-<project-ref>-auth-token=..." "https://<BASE_URL>/api/employees/<EMPLOYEE_UUID>"

# 3) Employee profile (skills, events, documents, etc. — session org)
curl -s -H "Cookie: sb-<project-ref>-auth-token=..." "https://<BASE_URL>/api/employees/<EMPLOYEE_UUID>/profile"

# 4) Org units (tree for session org)
curl -s -H "Cookie: sb-<project-ref>-auth-token=..." "https://<BASE_URL>/api/org/units"

# 5) Tomorrow's gaps (lines/scoped by session org)
curl -s -H "Cookie: sb-<project-ref>-auth-token=..." "https://<BASE_URL>/api/tomorrows-gaps?date=2026-01-30&shift=day"
```

Replace `<BASE_URL>` with your origin, and use the same auth cookie (or `Authorization: Bearer <access_token>`) for all calls. Responses are scoped by `getActiveOrgFromSession`; `org_id` in payloads matches the session org.

## Already session-scoped (server APIs)

- Employees: `GET /api/employees`, `GET /api/employees/[id]`, `GET /api/employees/[id]/profile`, `PATCH /api/employees/[id]`
- Org overview: `GET /api/org/units`
- Setup: `GET /api/setup/progress`
- Admin: `GET /api/admin/audit`, `GET /api/admin/members`, `POST /api/admin/invite`, `POST /api/admin/membership/role`, `POST /api/admin/membership/disable` (all use session org)
- Competence matrix: RSC uses `getActiveOrgIdForRSC()` + `getEmployeesWithSkills(orgId, …)`
- Tomorrow's gaps: `GET /api/tomorrows-gaps`
- Line overview: `GET /api/line-overview/*` (session-scoped)
- Cockpit: `GET /api/cockpit/*` (session-scoped)

## Still using `currentOrg.id` on the client (non-CORE)

| Page / component | Usage | Suggested API |
|------------------|--------|----------------|
| `app/debug/page.tsx` | Counts, schema check | `GET /api/debug/counts`, `GET /api/debug/schema` (session-scoped) |
| `components/dashboard/ManagerDashboard.tsx` | employees by org_id | Use `GET /api/employees` |
| `app/billing/page.tsx` | employees by org_id | Use `GET /api/employees` |
| `app/equipment/page.tsx` | equipment by org_id | `GET /api/equipment` (create if missing) |
| `app/employees/[id]/salary/new/page.tsx` | employee name | Use `GET /api/employees/[id]` |
| `app/employees/[id]/reviews/new/page.tsx` | employee name | Use `GET /api/employees/[id]` |
| `app/employees/[id]/one-to-ones/page.tsx` | employee + list | Use `GET /api/employees/[id]` + employees API |
| `app/employees/new/page.tsx` | create with org_id | API sets org from session |
| `app/one-to-ones/page.tsx` | employees by org_id | Use `GET /api/employees` |
| `app/safety/certificates/page.tsx` | employees + certificates | `GET /api/employees`, certificates API |
| `app/hr/workflows/page.tsx` | workflows by org_id | Workflows API with session |
| `components/dashboard/HrDashboard.tsx` | employees by org_id | Use `GET /api/employees` |
| `app/workflows/*` | org for loading | Ensure workflows APIs use session only |
| `app/spaljisten/dashboard/page.tsx` | currentOrg fallback | Prefer session |

## Skills catalog fix (done)

- `public.skills` has no `description` column. Removed from select in `services/competenceService.ts` and `app/api/skills/route.ts`. `GET /api/skills` now uses `getActiveOrgFromSession`.
