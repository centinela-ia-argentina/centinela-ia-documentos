-- ==============================================================================
-- ROLLBACK: 20260818120000_juridico_commercial_ready_fase2
-- ==============================================================================

BEGIN;

-- 1. Revert Storage
UPDATE storage.buckets SET file_size_limit = NULL, public = false, allowed_mime_types = NULL WHERE id = 'documents';
UPDATE storage.buckets SET file_size_limit = NULL, public = false, allowed_mime_types = NULL WHERE id = 'branding';

-- 2. Restore Default RLS
DROP POLICY IF EXISTS "agenda_select_policy" ON agenda_plazos;
DROP POLICY IF EXISTS "agenda_insert_policy" ON agenda_plazos;
DROP POLICY IF EXISTS "agenda_update_policy" ON agenda_plazos;
DROP POLICY IF EXISTS "agenda_delete_policy" ON agenda_plazos;
CREATE POLICY "agenda_plazos_org_all" ON agenda_plazos FOR ALL USING (
    organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid())
);

DROP POLICY IF EXISTS "agent_messages_select_policy" ON agent_messages;
DROP POLICY IF EXISTS "agent_messages_insert_policy" ON agent_messages;
DROP POLICY IF EXISTS "agent_messages_delete_policy" ON agent_messages;

DROP POLICY IF EXISTS "ai_outputs_delete_policy" ON ai_outputs;
DROP POLICY IF EXISTS "ai_outputs_insert_policy" ON ai_outputs;

-- 3. Drop unique constraints and composite FKs, restore simple FKs
ALTER TABLE public.cases DROP CONSTRAINT IF EXISTS cases_property_fk;
ALTER TABLE public.cases ADD CONSTRAINT cases_property_id_fkey FOREIGN KEY (property_id) REFERENCES public.properties(id) ON DELETE SET NULL;

ALTER TABLE public.documents DROP CONSTRAINT IF EXISTS doc_org_match_case;
ALTER TABLE public.documents ADD CONSTRAINT documents_case_id_fkey FOREIGN KEY (case_id) REFERENCES public.cases(id) ON DELETE CASCADE;

ALTER TABLE public.agenda_plazos DROP CONSTRAINT IF EXISTS agenda_org_match_case;
ALTER TABLE public.agenda_plazos ADD CONSTRAINT agenda_plazos_case_id_fkey FOREIGN KEY (case_id) REFERENCES public.cases(id) ON DELETE CASCADE;

ALTER TABLE public.agent_messages DROP CONSTRAINT IF EXISTS agent_org_match_case;
ALTER TABLE public.agent_messages ADD CONSTRAINT agent_messages_case_id_fkey FOREIGN KEY (case_id) REFERENCES public.cases(id) ON DELETE CASCADE;

ALTER TABLE public.ai_outputs DROP CONSTRAINT IF EXISTS ai_org_match_case;
ALTER TABLE public.ai_outputs ADD CONSTRAINT ai_outputs_case_id_fkey FOREIGN KEY (case_id) REFERENCES public.cases(id) ON DELETE CASCADE;

ALTER TABLE public.ai_outputs DROP CONSTRAINT IF EXISTS ai_org_match_doc;
ALTER TABLE public.ai_outputs ADD CONSTRAINT ai_outputs_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.documents(id) ON DELETE CASCADE;

ALTER TABLE public.checklists DROP CONSTRAINT IF EXISTS checklist_org_match_case;
ALTER TABLE public.checklists ADD CONSTRAINT checklists_case_id_fkey FOREIGN KEY (case_id) REFERENCES public.cases(id) ON DELETE CASCADE;

ALTER TABLE public.checklist_items DROP CONSTRAINT IF EXISTS checklist_items_org_match_chk;
ALTER TABLE public.checklist_items ADD CONSTRAINT checklist_items_checklist_id_fkey FOREIGN KEY (checklist_id) REFERENCES public.checklists(id) ON DELETE CASCADE;

ALTER TABLE public.checklist_items DROP CONSTRAINT IF EXISTS checklist_items_org_match_doc;
ALTER TABLE public.checklist_items ADD CONSTRAINT checklist_items_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.documents(id) ON DELETE SET NULL;

ALTER TABLE public.case_events DROP CONSTRAINT IF EXISTS case_events_case_fk;
ALTER TABLE public.case_events ADD CONSTRAINT case_events_case_id_fkey FOREIGN KEY (case_id) REFERENCES public.cases(id) ON DELETE CASCADE;

ALTER TABLE public.reports DROP CONSTRAINT IF EXISTS reports_case_fk;
ALTER TABLE public.reports ADD CONSTRAINT reports_case_id_fkey FOREIGN KEY (case_id) REFERENCES public.cases(id) ON DELETE CASCADE;

-- Drop the UNIQUE composite keys added by 120000
ALTER TABLE public.properties DROP CONSTRAINT IF EXISTS properties_id_org_key;
ALTER TABLE public.cases DROP CONSTRAINT IF EXISTS cases_id_org_key;
ALTER TABLE public.documents DROP CONSTRAINT IF EXISTS documents_id_org_key;
ALTER TABLE public.checklists DROP CONSTRAINT IF EXISTS checklists_id_org_key;

DROP INDEX IF EXISTS agenda_plazos_unique_event_idx;

-- 4. Re-create old indexes/columns if needed
-- (Since we did not DROP hora, we leave it or drop it, user said "Do not drop hora" in rollback? Wait.
-- User said: "Verificá expresamente que la migración principal no: - elimine la columna hora"
-- In rollback, usually we drop new columns. But maybe we keep it to not lose data. I will leave it).

COMMIT;
