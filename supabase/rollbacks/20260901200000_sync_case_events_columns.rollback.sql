BEGIN;

-- Estrategia conservadora:
-- Como la migración usa ADD COLUMN IF NOT EXISTS, no podemos saber si
-- las columnas event_date o title ya existían.
-- Para no destruir datos de columnas preexistentes,
-- el rollback se limitará a relajar la restricción NOT NULL.
-- Tampoco se eliminan incondicionalmente los índices, ya que podrían ser preexistentes.

ALTER TABLE public.case_events
  ALTER COLUMN event_date DROP NOT NULL;

ALTER TABLE public.case_events
  ALTER COLUMN title DROP NOT NULL;

NOTIFY pgrst, 'reload schema';

COMMIT;
