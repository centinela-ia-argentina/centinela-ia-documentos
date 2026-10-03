-- ==============================================================================
-- ROLLBACK: 20260904120000_checklist_items_match_source.rollback.sql
-- Reversión de la columna match_source en checklist_items
-- ==============================================================================

BEGIN;

ALTER TABLE public.checklist_items
  DROP CONSTRAINT IF EXISTS checklist_items_match_source_chk;

ALTER TABLE public.checklist_items
  DROP COLUMN IF EXISTS match_source;

COMMIT;
