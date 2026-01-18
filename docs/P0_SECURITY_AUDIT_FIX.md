# P0 Security Audit Fix Pack

**Date:** 2026-01-18  
**Status:** COMPLETED

## Summary

This document describes the P0 security fixes implemented to address multi-tenant data isolation issues in the Industrial Competence Platform.

---

## P0-1: Spaljisten RLS Fix

**Issue:** `sp_*` tables had RLS policies `USING (TRUE)` allowing any authenticated user to access all data.

**Fix:** Created `sql/017_spaljisten_rls_fix.sql` with proper org-scoped RLS policies:

- **SELECT:** `USING (public.is_org_member(org_id))` - Members can read their org's data
- **INSERT:** `WITH CHECK (public.is_org_admin(org_id))` - Only admins can insert
- **UPDATE:** `USING (is_org_admin(org_id)) WITH CHECK (is_org_admin(org_id))` - Admins only, prevents org_id reassignment
- **DELETE:** `USING (public.is_org_admin(org_id))` - Admins only

**Tables secured:** sp_rating_scales, sp_areas, sp_stations, sp_skills, sp_employees, sp_employee_skills, sp_area_leaders, sp_import_logs

**Verification:**
```sql
-- Run in Supabase SQL Editor to verify policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies 
WHERE tablename LIKE 'sp_%'
ORDER BY tablename, policyname;
```

---

## P0-2: Workflows Org Resolution

**Issue:** Workflow API routes trusted `x-org-id` header and `current_org_id` cookie, allowing forged org access.

**Fix:** Created `lib/orgSession.ts` with `getOrgIdFromSession()` helper that:
1. Extracts access token from Authorization header or sb-access-token cookie
2. Validates token with Supabase Auth
3. Queries memberships table to find active org for user
4. Returns 401/403 if not authenticated or no membership

**Routes refactored:**
- `app/api/workflows/templates/route.ts` (GET/POST)
- `app/api/workflows/templates/[id]/route.ts` (GET)
- `app/api/workflows/instances/route.ts` (GET/POST)
- `app/api/workflows/instances/[id]/route.ts` (GET/PATCH)
- `app/api/workflows/instances/[id]/tasks/route.ts` (PATCH)
- `app/api/workflows/instances/[id]/signoff/route.ts` (POST)
- `app/api/workflows/my-tasks/route.ts` (GET)
- `app/api/workflows/dashboard/route.ts` (GET)
- `app/api/workflows/setup/route.ts` (POST)
- `app/api/workflows/route.ts` (deprecated - returns 410)

**Verification:**
```bash
# Test unauthenticated access (should return 401)
curl -X GET http://localhost:5000/api/workflows/templates

# Test forged org header (should be ignored, uses session membership)
curl -X GET http://localhost:5000/api/workflows/templates \
  -H "x-org-id: fake-org-id-12345" \
  -H "Authorization: Bearer <valid_token>"

# Expected: Returns data for user's actual org, not the forged header
```

---

## P0-3: Seeding Removed

**Issue:** Hardcoded org UUID `a1b2c3d4-e5f6-7890-abcd-ef1234567890` was auto-seeded in migrations.

**Fix:**
1. Commented out org creation in `sql/010_spaljisten_schema.sql`
2. Removed hardcoded template seeding in `sql/016_workflow_v1_upgrades.sql`
3. Created secure `/api/workflows/setup` endpoint that:
   - Requires authentication
   - Validates admin/HR role
   - Seeds templates only for the authenticated user's org

**Files changed:**
- `sql/010_spaljisten_schema.sql` - Org insert commented out
- `sql/016_workflow_v1_upgrades.sql` - Template seed removed
- `app/api/workflows/setup/route.ts` - New secure setup endpoint

**Verification:**
```bash
# Check no hardcoded org in active migrations
grep -r "a1b2c3d4-e5f6-7890-abcd-ef1234567890" sql/*.sql | grep -v "^--"

# Test setup endpoint requires auth
curl -X POST http://localhost:5000/api/workflows/setup
# Expected: 401 Unauthorized
```

---

## Files Changed

| File | Change |
|------|--------|
| `sql/017_spaljisten_rls_fix.sql` | NEW - RLS policy fixes |
| `sql/010_spaljisten_schema.sql` | MODIFIED - Org seeding disabled |
| `sql/016_workflow_v1_upgrades.sql` | MODIFIED - Template seeding removed |
| `lib/orgSession.ts` | NEW - Server-side org resolution |
| `app/api/workflows/templates/route.ts` | MODIFIED - Uses getOrgIdFromSession |
| `app/api/workflows/templates/[id]/route.ts` | MODIFIED - Uses getOrgIdFromSession |
| `app/api/workflows/instances/route.ts` | MODIFIED - Uses getOrgIdFromSession |
| `app/api/workflows/instances/[id]/route.ts` | MODIFIED - Uses getOrgIdFromSession |
| `app/api/workflows/instances/[id]/tasks/route.ts` | MODIFIED - Uses getOrgIdFromSession |
| `app/api/workflows/instances/[id]/signoff/route.ts` | MODIFIED - Uses getOrgIdFromSession |
| `app/api/workflows/my-tasks/route.ts` | MODIFIED - Uses getOrgIdFromSession |
| `app/api/workflows/dashboard/route.ts` | MODIFIED - Uses getOrgIdFromSession |
| `app/api/workflows/setup/route.ts` | NEW - Secure template seeding |
| `app/api/workflows/route.ts` | MODIFIED - Deprecated |

---

## Migration Instructions

1. Run `sql/017_spaljisten_rls_fix.sql` in Supabase SQL Editor to apply RLS fixes
2. Deploy updated code
3. Authenticated admins can call `POST /api/workflows/setup` to seed templates for their org

---

## Definition of Done Checklist

- [x] Non-member users cannot read/write `sp_*` rows
- [x] Workflows APIs ignore forged `x-org-id` header
- [x] No hardcoded org seeding runs on migration automatically
- [x] UPDATE policies include WITH CHECK to prevent org_id reassignment
- [x] All workflow routes use session-based org resolution
