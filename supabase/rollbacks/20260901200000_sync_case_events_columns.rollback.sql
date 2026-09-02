BEGIN;

DO $$
BEGIN
  IF current_setting('centinela.is_ci', true) = 'true' THEN
    ALTER TABLE public.case_events DROP COLUMN IF EXISTS event_date;
    ALTER TABLE public.case_events DROP COLUMN IF EXISTS title;
    DROP INDEX IF EXISTS idx_case_events_event_date;
  ELSE
    RAISE EXCEPTION 'Rollback bloqueado: centinela.is_ci debe ser true';
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';

COMMIT;
