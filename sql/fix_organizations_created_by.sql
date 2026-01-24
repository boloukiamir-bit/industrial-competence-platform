-- =============================================================================
-- FIX: Add created_by to organizations if missing (for existing databases)
-- =============================================================================
-- This migration adds created_by column if it doesn't exist
-- and sets it for existing organizations
-- =============================================================================

-- Check if created_by column exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'organizations' 
    AND column_name = 'created_by'
  ) THEN
    -- Add created_by column (nullable first)
    ALTER TABLE public.organizations 
    ADD COLUMN created_by uuid REFERENCES auth.users(id);
    
    -- Set created_by for existing organizations
    -- Option 1: Use the first admin user from memberships
    UPDATE public.organizations o
    SET created_by = (
      SELECT m.user_id 
      FROM public.memberships m 
      WHERE m.org_id = o.id 
        AND m.role = 'admin' 
        AND m.status = 'active'
      ORDER BY m.created_at ASC
      LIMIT 1
    )
    WHERE created_by IS NULL;
    
    -- Option 2: If no admin found, use first user from memberships
    UPDATE public.organizations o
    SET created_by = (
      SELECT m.user_id 
      FROM public.memberships m 
      WHERE m.org_id = o.id 
        AND m.status = 'active'
      ORDER BY m.created_at ASC
      LIMIT 1
    )
    WHERE created_by IS NULL;
    
    -- Option 3: If still NULL, use a system user (you may need to create one)
    -- UPDATE public.organizations
    -- SET created_by = '<SYSTEM_USER_ID>'::uuid  -- Replace with actual system user ID
    -- WHERE created_by IS NULL;
    
    -- Now make it NOT NULL (only if all rows have values)
    -- Uncomment after verifying all rows have created_by set:
    -- ALTER TABLE public.organizations 
    -- ALTER COLUMN created_by SET NOT NULL;
    
    RAISE NOTICE 'Added created_by column to organizations table. Please verify all rows have values before making it NOT NULL.';
  ELSE
    RAISE NOTICE 'created_by column already exists in organizations table.';
  END IF;
END $$;

-- Verify the update
SELECT 
  id,
  name,
  slug,
  created_by,
  CASE 
    WHEN created_by IS NULL THEN 'WARNING: NULL created_by'
    ELSE 'OK'
  END as status
FROM public.organizations
ORDER BY created_at;
