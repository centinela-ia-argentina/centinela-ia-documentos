-- ==============================================================================
-- ROLLBACK: 20260818120000_juridico_commercial_ready_fase2
-- ==============================================================================

BEGIN;

-- 1. Revert Storage
-- Baseline: 'documents' bucket exists with public=false, allowed_mime_types=NULL, file_size_limit=NULL. 'documents_select/insert/delete' policies did not exist, baseline had 'storage_select_policy' etc.
-- Migración: Set limit to 50MB, allowed types, added 'documents_select/insert/update/delete' policies.
-- Rollback: Reset to NULL, drop new policies, recreate baseline policies.
-- Motivo: Storage must match baseline strictly to prevent false positives in diffs.
UPDATE storage.buckets SET file_size_limit = NULL, public = false, allowed_mime_types = NULL WHERE id = 'documents';

DROP POLICY IF EXISTS "documents_select" ON storage.objects;
DROP POLICY IF EXISTS "documents_insert" ON storage.objects;
DROP POLICY IF EXISTS "documents_update" ON storage.objects;
DROP POLICY IF EXISTS "documents_delete" ON storage.objects;

DROP POLICY IF EXISTS "storage_select_policy" ON storage.objects;
DROP POLICY IF EXISTS "storage_insert_policy" ON storage.objects;
DROP POLICY IF EXISTS "storage_delete_policy" ON storage.objects;

CREATE POLICY "storage_select_policy" ON storage.objects FOR SELECT USING (bucket_id = 'documents' AND (auth.uid() IS NOT NULL));
CREATE POLICY "storage_insert_policy" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'documents' AND (auth.uid() IS NOT NULL));
CREATE POLICY "storage_delete_policy" ON storage.objects FOR DELETE USING (bucket_id = 'documents' AND (auth.uid() IS NOT NULL));

-- 2. Restore Default RLS
-- Baseline: Contextual functions were used to secure agenda_plazos, agent_messages, ai_outputs.
-- Migración: Replaced policies with direct SELECT subqueries for better performance/structure.
-- Rollback: Drop new policies, restore baseline policies that use current_user_organization_id().
-- Motivo: Must match exact baseline string signature for pg_policies diff.
DROP POLICY IF EXISTS "agenda_select_policy" ON agenda_plazos;
DROP POLICY IF EXISTS "agenda_insert_policy" ON agenda_plazos;
DROP POLICY IF EXISTS "agenda_update_policy" ON agenda_plazos;
DROP POLICY IF EXISTS "agenda_delete_policy" ON agenda_plazos;
CREATE POLICY "agenda_plazos_org_all" ON public.agenda_plazos FOR ALL USING (organization_id = public.current_user_organization_id());

DROP POLICY IF EXISTS "agent_messages_select_policy" ON public.agent_messages;
DROP POLICY IF EXISTS "agent_messages_insert_policy" ON public.agent_messages;
DROP POLICY IF EXISTS "agent_messages_delete_policy" ON public.agent_messages;
DROP POLICY IF EXISTS "agent_messages_org_all" ON public.agent_messages;
CREATE POLICY "agent_messages_org_all" ON public.agent_messages FOR ALL USING (organization_id = public.current_user_organization_id());

DROP POLICY IF EXISTS "ai_outputs_select_policy" ON ai_outputs;
DROP POLICY IF EXISTS "ai_outputs_delete_policy" ON ai_outputs;
DROP POLICY IF EXISTS "ai_outputs_insert_policy" ON ai_outputs;
CREATE POLICY "ai_outputs_org_all" ON public.ai_outputs FOR ALL USING (organization_id = public.current_user_organization_id());

DROP POLICY IF EXISTS "cases_select_policy" ON public.cases;
DROP POLICY IF EXISTS "cases_insert_policy" ON public.cases;
DROP POLICY IF EXISTS "cases_update_policy" ON public.cases;
DROP POLICY IF EXISTS "cases_delete_policy" ON public.cases;
CREATE POLICY "cases_org_all" ON public.cases FOR ALL USING (organization_id = public.current_user_organization_id());

-- 3. Drop unique constraints and composite FKs, restore simple FKs
-- Baseline: Simple foreign keys linking to id.
-- Migración: Added composite (id, organization_id) UNIQUE constraints and replaced FKs with composite ones for cross-tenant integrity.
-- Rollback: Drop composite UNIQUE constraints, drop composite FKs, recreate simple FKs linking to id.
-- Motivo: Restore baseline schema structure for pure diff.
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

-- Baseline: index did not exist.
-- Migración: created unique index for atomicity.
-- Rollback: drop index.
-- Motivo: restore baseline indexes.
DROP INDEX IF EXISTS agenda_plazos_unique_event_idx;

COMMIT;
