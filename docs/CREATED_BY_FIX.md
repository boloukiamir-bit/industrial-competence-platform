# Fix: organizations.created_by NOT NULL Constraint

## Problem
Inserting into `organizations` table fails because `created_by` is NOT NULL but SQL scripts don't set it.

## Root Cause
The schema in `sql/002_multi_tenant_rls.sql` defines:
```sql
created_by uuid NOT NULL REFERENCES auth.users(id)
```

But bootstrap SQL scripts were not setting this value.

## Solution

### 1. API Route (Already Fixed)
✅ `app/api/org/create/route.ts` already sets `created_by: user.id` correctly.

### 2. SQL Bootstrap Scripts (Fixed)
Updated the following scripts to require and set `created_by`:
- ✅ `sql/tenant_bootstrap_cleanup.sql` - Step 2 and Step 7
- ✅ `sql/setup_spaljisten_org.sql` - Step 2

### 3. Migration for Existing Databases
Created `sql/fix_organizations_created_by.sql` to:
- Add `created_by` column if missing
- Backfill existing organizations with admin user from memberships
- Provide instructions for making it NOT NULL

## Usage

### For New Organizations (via API)
The API route automatically sets `created_by` from the authenticated user:
```typescript
created_by: user.id  // From auth token
```

### For SQL Bootstrap Scripts
Always include `created_by` when creating organizations:
```sql
-- Step 1: Get user_id
SELECT id FROM auth.users WHERE email = 'user@example.com';

-- Step 2: Create org with created_by
INSERT INTO public.organizations (name, slug, created_by)
VALUES ('My Org', 'my-org', '<USER_ID>'::uuid);
```

### For Existing Databases
Run the migration:
```sql
-- See sql/fix_organizations_created_by.sql
-- This will:
-- 1. Add created_by column if missing
-- 2. Backfill from memberships table
-- 3. Provide verification query
```

## Verification

Check that all organizations have `created_by` set:
```sql
SELECT 
  id,
  name,
  slug,
  created_by,
  CASE 
    WHEN created_by IS NULL THEN 'WARNING: NULL created_by'
    ELSE 'OK'
  END as status
FROM public.organizations;
```

## Foreign Key Target
- ✅ `created_by` references `auth.users(id)` (not `profiles`)
- ✅ This matches the schema definition in `sql/002_multi_tenant_rls.sql`

## Files Changed
- ✅ `sql/tenant_bootstrap_cleanup.sql` - Updated Step 2 and Step 7
- ✅ `sql/setup_spaljisten_org.sql` - Updated Step 2
- ✅ `sql/fix_organizations_created_by.sql` - New migration for existing DBs
- ✅ `sql/005_supabase_schema_update.sql` - Added note about created_by
- ✅ `app/api/org/create/route.ts` - Already correct (no changes needed)

## Notes
- The API route uses `auth.uid()` via the authenticated user token
- SQL scripts require manual user_id lookup from `auth.users` table
- All FK references point to `auth.users(id)`, not `profiles`
