-- Add source column to person_events to mark seed/test/demo data
-- This allows filtering out seeded data from production queries

-- Add source column with default 'manual' (backwards compatible)
ALTER TABLE public.person_events
  ADD COLUMN IF NOT EXISTS source text DEFAULT 'manual'
  CHECK (source IN ('seed', 'import', 'manual', 'test'));

-- Create index for efficient filtering
CREATE INDEX IF NOT EXISTS idx_person_events_source ON public.person_events(source);

-- Mark existing rows with "(seed)" or "(test)" in title as seed/test
UPDATE public.person_events
SET source = CASE
  WHEN title ILIKE '%(seed)%' THEN 'seed'
  WHEN title ILIKE '%(test)%' THEN 'test'
  ELSE 'manual'
END
WHERE source = 'manual' OR source IS NULL;

-- Comment for documentation
COMMENT ON COLUMN public.person_events.source IS 'Source of the event: seed (demo/test data), import (bulk import), manual (user-created), or test (test data)';
