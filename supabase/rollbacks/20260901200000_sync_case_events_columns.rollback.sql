BEGIN;

ALTER TABLE public.case_events DROP COLUMN IF EXISTS event_date;
ALTER TABLE public.case_events DROP COLUMN IF EXISTS title;

DROP INDEX IF EXISTS public.idx_case_events_case_id;
DROP INDEX IF EXISTS public.idx_case_events_organization_id;
DROP INDEX IF EXISTS public.idx_case_events_event_date;

NOTIFY pgrst, 'reload schema';

COMMIT;
