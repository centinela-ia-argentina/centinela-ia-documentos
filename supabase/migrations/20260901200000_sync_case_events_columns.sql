BEGIN;

ALTER TABLE public.case_events
  ADD COLUMN IF NOT EXISTS event_date date;

UPDATE public.case_events
SET event_date = (created_at AT TIME ZONE 'UTC')::date
WHERE event_date IS NULL;

ALTER TABLE public.case_events
  ALTER COLUMN event_date SET NOT NULL;

ALTER TABLE public.case_events
  ADD COLUMN IF NOT EXISTS title text;

UPDATE public.case_events
SET title = event_type
WHERE title IS NULL;

ALTER TABLE public.case_events
  ALTER COLUMN title SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_case_events_case_id ON public.case_events(case_id);
CREATE INDEX IF NOT EXISTS idx_case_events_organization_id ON public.case_events(organization_id);
CREATE INDEX IF NOT EXISTS idx_case_events_event_date ON public.case_events(event_date);

NOTIFY pgrst, 'reload schema';

COMMIT;
