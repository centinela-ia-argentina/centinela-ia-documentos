-- ROLLBACK EXACTO Y NO EXPANSIVO
-- Restaura el estado previo a las fases 2 y 3.

-- 1. Rollback Relaciones faltantes
ALTER TABLE public.case_events DROP CONSTRAINT IF EXISTS case_events_case_fk;
ALTER TABLE public.reports DROP CONSTRAINT IF EXISTS reports_case_fk;

-- 2. Rollback ON DELETE SET NULL en composite FKs
ALTER TABLE public.cases DROP CONSTRAINT IF EXISTS cases_property_fk;
ALTER TABLE public.cases ADD CONSTRAINT cases_property_fk
FOREIGN KEY (property_id, organization_id) REFERENCES public.properties(id, organization_id) ON DELETE SET NULL;

ALTER TABLE public.checklist_items DROP CONSTRAINT IF EXISTS checklist_items_org_match_doc;
ALTER TABLE public.checklist_items ADD CONSTRAINT checklist_items_org_match_doc
FOREIGN KEY (document_id, organization_id) REFERENCES public.documents(id, organization_id) ON DELETE SET NULL;

-- Rollback UNIQUE constraints added for FKs
ALTER TABLE public.cases DROP CONSTRAINT IF EXISTS cases_id_org_key;
ALTER TABLE public.documents DROP CONSTRAINT IF EXISTS docs_id_org_key;
ALTER TABLE public.properties DROP CONSTRAINT IF EXISTS props_id_org_key;

-- 3. Rollback file_hash e Idempotencia (documents_unique_case_hash, etc.)
DROP INDEX IF EXISTS public.documents_unique_case_hash;
DROP INDEX IF EXISTS public.documents_unique_general_hash;
ALTER TABLE public.documents DROP COLUMN IF EXISTS file_hash;

-- 4. Rollback RPC nueva
DROP FUNCTION IF EXISTS public.match_case_document_chunks;

-- 5. Rollback Storage policies (Si se modificaron o agregaron, eliminarlas)
-- (Como no hay un registro explícito en los scripts de la fase 3 de nuevas políticas,
-- se agregarían los DROP POLICY aquí si fuera necesario)
