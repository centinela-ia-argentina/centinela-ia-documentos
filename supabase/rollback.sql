-- ROLLBACK EXACTO Y NO EXPANSIVO
-- Restaura el estado previo a las fases 2 y 3.

-- 1. Rollback Grants
GRANT EXECUTE ON ALL ROUTINES IN SCHEMA public TO public, anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon;
GRANT TRUNCATE, TRIGGER, REFERENCES ON ALL TABLES IN SCHEMA public TO authenticated;

-- 2. Rollback Relaciones faltantes
ALTER TABLE public.case_events DROP CONSTRAINT IF EXISTS case_events_case_fk;
ALTER TABLE public.reports DROP CONSTRAINT IF EXISTS reports_case_fk;

-- 3. Rollback ON DELETE SET NULL en composite FKs
ALTER TABLE public.cases DROP CONSTRAINT IF EXISTS cases_property_fk;
ALTER TABLE public.cases ADD CONSTRAINT cases_property_fk
FOREIGN KEY (property_id, organization_id) REFERENCES public.properties(id, organization_id) ON DELETE SET NULL;

ALTER TABLE public.checklist_items DROP CONSTRAINT IF EXISTS checklist_items_org_match_doc;
ALTER TABLE public.checklist_items ADD CONSTRAINT checklist_items_org_match_doc
FOREIGN KEY (document_id, organization_id) REFERENCES public.documents(id, organization_id) ON DELETE SET NULL;

-- 4. Rollback file_hash e Idempotencia (documents_unique_case_hash, etc.)
DROP INDEX IF EXISTS public.documents_unique_case_hash;
DROP INDEX IF EXISTS public.documents_unique_general_hash;
-- (Note: file_hash was added previously, to drop it completely if required:)
-- ALTER TABLE public.documents DROP COLUMN IF EXISTS file_hash;

-- 5. Rollback RPC nueva
DROP FUNCTION IF EXISTS public.match_case_document_chunks;

