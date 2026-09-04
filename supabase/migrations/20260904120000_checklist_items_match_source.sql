-- ==============================================================================
-- MIGRATION: 20260904120000_checklist_items_match_source.sql
-- Finalidad: Registrar el origen de la vinculación en checklist_items ('manual' | 'automatic' | NULL)
-- para garantizar que las decisiones humanas prevalezcan sobre el auto-match (C-M3-J-001).
-- Compatibilidad: Columna nullable con DEFAULT NULL para filas preexistentes.
-- RLS: No debilita RLS. Las políticas existentes sobre checklist_items continúan vigentes.
-- ==============================================================================

BEGIN;

-- 1. Agregar columna match_source si no existe
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'checklist_items'
      AND column_name = 'match_source'
  ) THEN
    ALTER TABLE public.checklist_items
      ADD COLUMN match_source text;
  END IF;
END $$;

-- 2. Agregar check constraint para valores permitidos ('manual', 'automatic')
ALTER TABLE public.checklist_items
  DROP CONSTRAINT IF EXISTS checklist_items_match_source_chk;

ALTER TABLE public.checklist_items
  ADD CONSTRAINT checklist_items_match_source_chk
  CHECK (match_source IS NULL OR match_source IN ('manual', 'automatic'));

-- 3. Documentar la columna
COMMENT ON COLUMN public.checklist_items.match_source IS
  'Origen de la vinculacion: manual (decision de usuario) o automatic (auto-match heuristico). Prevalece manual.';

COMMIT;
