BEGIN;

DO $$
BEGIN
  IF current_setting('centinela.is_ci', true) = 'true' THEN
    ALTER TABLE public.case_events DROP COLUMN IF EXISTS event_date;
    ALTER TABLE public.case_events DROP COLUMN IF EXISTS title;
    DROP INDEX IF EXISTS idx_case_events_event_date;
  ELSE
    RAISE NOTICE 'Rollback abortado: no es un entorno CI (centinela.is_ci != true)';
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';

COMMIT;
