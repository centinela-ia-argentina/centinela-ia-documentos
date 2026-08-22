BEGIN;

ALTER TABLE public.agenda_plazos
  DROP COLUMN IF EXISTS detalle;

ALTER TABLE public.checklist_items
  DROP COLUMN IF EXISTS notes;

NOTIFY pgrst, 'reload schema';

COMMIT;
