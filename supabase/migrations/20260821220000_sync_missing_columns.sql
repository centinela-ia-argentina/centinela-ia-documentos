BEGIN;

ALTER TABLE public.checklist_items
  ADD COLUMN IF NOT EXISTS notes text;

ALTER TABLE public.agenda_plazos
  ADD COLUMN IF NOT EXISTS detalle text;

NOTIFY pgrst, 'reload schema';

COMMIT;
