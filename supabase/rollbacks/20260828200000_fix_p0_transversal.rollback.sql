BEGIN;

-- ==============================================================================
-- ROLLBACK P0-001: POLÍTICAS RLS RESIDUALES _org_all
-- ==============================================================================

-- DOCUMENTS
DROP POLICY IF EXISTS "documents_select_role" ON public.documents;
DROP POLICY IF EXISTS "documents_insert_role" ON public.documents;
DROP POLICY IF EXISTS "documents_update_role" ON public.documents;
DROP POLICY IF EXISTS "documents_delete_role" ON public.documents;
CREATE POLICY "documents_org_all" ON public.documents FOR ALL USING (organization_id = public.current_user_organization_id());

-- CHECKLISTS
DROP POLICY IF EXISTS "checklists_select_role" ON public.checklists;
DROP POLICY IF EXISTS "checklists_insert_role" ON public.checklists;
DROP POLICY IF EXISTS "checklists_update_role" ON public.checklists;
DROP POLICY IF EXISTS "checklists_delete_role" ON public.checklists;
CREATE POLICY "checklists_org_all" ON public.checklists FOR ALL USING (organization_id = public.current_user_organization_id());

-- AUDIT_LOGS
DROP POLICY IF EXISTS "audit_logs_select_role" ON public.audit_logs;
CREATE POLICY "audit_logs_org_all" ON public.audit_logs FOR ALL USING (organization_id = public.current_user_organization_id());

-- REPORTS
DROP POLICY IF EXISTS "reports_select_role" ON public.reports;
DROP POLICY IF EXISTS "reports_insert_role" ON public.reports;
DROP POLICY IF EXISTS "reports_update_role" ON public.reports;
DROP POLICY IF EXISTS "reports_delete_role" ON public.reports;
CREATE POLICY "reports_org_all" ON public.reports FOR ALL USING (organization_id = public.current_user_organization_id());

-- CASE_EVENTS
DROP POLICY IF EXISTS "case_events_select_role" ON public.case_events;
DROP POLICY IF EXISTS "case_events_insert_role" ON public.case_events;
DROP POLICY IF EXISTS "case_events_update_role" ON public.case_events;
DROP POLICY IF EXISTS "case_events_delete_role" ON public.case_events;
CREATE POLICY "case_events_org_all" ON public.case_events FOR ALL USING (organization_id = public.current_user_organization_id());

-- DOCUMENT_CHUNKS
DROP POLICY IF EXISTS "document_chunks_select_role" ON public.document_chunks;
DROP POLICY IF EXISTS "document_chunks_insert_role" ON public.document_chunks;
DROP POLICY IF EXISTS "document_chunks_update_role" ON public.document_chunks;
DROP POLICY IF EXISTS "document_chunks_delete_role" ON public.document_chunks;
CREATE POLICY "document_chunks_org_all" ON public.document_chunks FOR ALL USING (document_id IN (SELECT id FROM public.documents WHERE organization_id = public.current_user_organization_id()));


-- ==============================================================================
-- ROLLBACK P0-002: POLÍTICAS DE case_derivations
-- ==============================================================================
DROP POLICY IF EXISTS "case_derivations_select_role" ON public.case_derivations;
DROP POLICY IF EXISTS "case_derivations_insert_role" ON public.case_derivations;
DROP POLICY IF EXISTS "case_derivations_update_role" ON public.case_derivations;
DROP POLICY IF EXISTS "case_derivations_delete_role" ON public.case_derivations;

-- Nota: No eliminamos las columnas from/to_organization_id, etc. para evitar 
-- pérdida accidental de datos en rollback, pero podríamos hacerlo si la especificación
-- fuera estricta sobre recrear el schema idéntico. Se dejan por seguridad.

-- ==============================================================================
-- ROLLBACK P0-005: PROTOCOLO NOTARIAL
-- ==============================================================================
DROP POLICY IF EXISTS "protocolo_select_role" ON public.protocolo_escrituras;
DROP POLICY IF EXISTS "protocolo_insert_role" ON public.protocolo_escrituras;
DROP POLICY IF EXISTS "protocolo_update_role" ON public.protocolo_escrituras;
DROP POLICY IF EXISTS "protocolo_delete_role" ON public.protocolo_escrituras;

-- Si se desea restaurar el estado anterior donde la tabla no existía, descomentar:
-- DROP TABLE IF EXISTS public.protocolo_escrituras CASCADE;

COMMIT;
