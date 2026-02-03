-- Add recurrence column to person_events if missing (e.g. "12m", "24m" for recurring events).
-- Used by services/events.ts and autoGenerateRecurringEvents.

ALTER TABLE public.person_events
  ADD COLUMN IF NOT EXISTS recurrence text;

COMMENT ON COLUMN public.person_events.recurrence IS 'Recurrence interval e.g. 12m, 24m; used to auto-create next event after completion';
