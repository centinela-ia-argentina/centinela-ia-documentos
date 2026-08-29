BEGIN;

-- ==============================================================================
-- P0-001: POLÍTICAS RLS RESIDUALES _org_all
-- Reemplazo de FOR ALL por políticas granulares
-- ==============================================================================

-- DOCUMENTS
DROP POLICY IF EXISTS "documents_org_all" ON public.documents;
CREATE POLICY "documents_select_role" ON public.documents FOR SELECT TO authenticated USING (
  public.current_user_is_active() AND
  organization_id = public.current_user_organization_id() AND
  (
    public.current_user_role() IN ('admin', 'employee', 'auditor') OR
    (public.current_user_role() = 'client' AND EXISTS (SELECT 1 FROM public.cases c WHERE c.id = documents.case_id AND c.assigned_to = auth.uid()))
  )
);
CREATE POLICY "documents_insert_role" ON public.documents FOR INSERT TO authenticated WITH CHECK (
  public.current_user_is_active() AND
  organization_id = public.current_user_organization_id() AND
  public.current_user_role() IN ('admin', 'employee')
);
CREATE POLICY "documents_update_role" ON public.documents FOR UPDATE TO authenticated USING (
  public.current_user_is_active() AND
  organization_id = public.current_user_organization_id() AND
  public.current_user_role() IN ('admin', 'employee')
) WITH CHECK (
  public.current_user_is_active() AND
  organization_id = public.current_user_organization_id() AND
  public.current_user_role() IN ('admin', 'employee')
);
CREATE POLICY "documents_delete_role" ON public.documents FOR DELETE TO authenticated USING (
  public.current_user_is_active() AND
  organization_id = public.current_user_organization_id() AND
  public.current_user_role() IN ('admin', 'employee')
);

-- CHECKLISTS
DROP POLICY IF EXISTS "checklists_org_all" ON public.checklists;
CREATE POLICY "checklists_select_role" ON public.checklists FOR SELECT TO authenticated USING (
  public.current_user_is_active() AND
  organization_id = public.current_user_organization_id() AND
  (
    public.current_user_role() IN ('admin', 'employee', 'auditor') OR
    (public.current_user_role() = 'client' AND EXISTS (SELECT 1 FROM public.cases c WHERE c.id = checklists.case_id AND c.assigned_to = auth.uid()))
  )
);
CREATE POLICY "checklists_insert_role" ON public.checklists FOR INSERT TO authenticated WITH CHECK (
  public.current_user_is_active() AND
  organization_id = public.current_user_organization_id() AND
  public.current_user_role() IN ('admin', 'employee')
);
CREATE POLICY "checklists_update_role" ON public.checklists FOR UPDATE TO authenticated USING (
  public.current_user_is_active() AND
  organization_id = public.current_user_organization_id() AND
  public.current_user_role() IN ('admin', 'employee')
) WITH CHECK (
  public.current_user_is_active() AND
  organization_id = public.current_user_organization_id() AND
  public.current_user_role() IN ('admin', 'employee')
);
CREATE POLICY "checklists_delete_role" ON public.checklists FOR DELETE TO authenticated USING (
  public.current_user_is_active() AND
  organization_id = public.current_user_organization_id() AND
  public.current_user_role() IN ('admin', 'employee')
);

-- AUDIT_LOGS
DROP POLICY IF EXISTS "audit_logs_org_all" ON public.audit_logs;
CREATE POLICY "audit_logs_select_role" ON public.audit_logs FOR SELECT TO authenticated USING (
  public.current_user_is_active() AND
  organization_id = public.current_user_organization_id() AND
  public.current_user_role() IN ('admin', 'auditor')
);
-- Mutaciones en audit_logs solo permitidas mediante roles de servidor / service_role

-- REPORTS
DROP POLICY IF EXISTS "reports_org_all" ON public.reports;
CREATE POLICY "reports_select_role" ON public.reports FOR SELECT TO authenticated USING (
  public.current_user_is_active() AND
  organization_id = public.current_user_organization_id() AND
  public.current_user_role() IN ('admin', 'employee', 'auditor')
);
CREATE POLICY "reports_insert_role" ON public.reports FOR INSERT TO authenticated WITH CHECK (
  public.current_user_is_active() AND
  organization_id = public.current_user_organization_id() AND
  public.current_user_role() IN ('admin', 'employee')
);
CREATE POLICY "reports_update_role" ON public.reports FOR UPDATE TO authenticated USING (
  public.current_user_is_active() AND
  organization_id = public.current_user_organization_id() AND
  public.current_user_role() IN ('admin', 'employee')
) WITH CHECK (
  public.current_user_is_active() AND
  organization_id = public.current_user_organization_id() AND
  public.current_user_role() IN ('admin', 'employee')
);
CREATE POLICY "reports_delete_role" ON public.reports FOR DELETE TO authenticated USING (
  public.current_user_is_active() AND
  organization_id = public.current_user_organization_id() AND
  public.current_user_role() IN ('admin', 'employee')
);

-- CASE_EVENTS
DROP POLICY IF EXISTS "case_events_org_all" ON public.case_events;
CREATE POLICY "case_events_select_role" ON public.case_events FOR SELECT TO authenticated USING (
  public.current_user_is_active() AND
  organization_id = public.current_user_organization_id() AND
  (
    public.current_user_role() IN ('admin', 'employee', 'auditor') OR
    (public.current_user_role() = 'client' AND EXISTS (SELECT 1 FROM public.cases c WHERE c.id = case_events.case_id AND c.assigned_to = auth.uid()))
  )
);
CREATE POLICY "case_events_insert_role" ON public.case_events FOR INSERT TO authenticated WITH CHECK (
  public.current_user_is_active() AND
  organization_id = public.current_user_organization_id() AND
  public.current_user_role() IN ('admin', 'employee')
);
CREATE POLICY "case_events_update_role" ON public.case_events FOR UPDATE TO authenticated USING (
  public.current_user_is_active() AND
  organization_id = public.current_user_organization_id() AND
  public.current_user_role() IN ('admin', 'employee')
) WITH CHECK (
  public.current_user_is_active() AND
  organization_id = public.current_user_organization_id() AND
  public.current_user_role() IN ('admin', 'employee')
);
CREATE POLICY "case_events_delete_role" ON public.case_events FOR DELETE TO authenticated USING (
  public.current_user_is_active() AND
  organization_id = public.current_user_organization_id() AND
  public.current_user_role() IN ('admin', 'employee')
);

-- DOCUMENT_CHUNKS
DROP POLICY IF EXISTS "document_chunks_org_all" ON public.document_chunks;
CREATE POLICY "document_chunks_select_role" ON public.document_chunks FOR SELECT TO authenticated USING (
  public.current_user_is_active() AND
  organization_id = public.current_user_organization_id() AND
  public.current_user_role() IN ('admin', 'employee', 'auditor')
);
CREATE POLICY "document_chunks_insert_role" ON public.document_chunks FOR INSERT TO authenticated WITH CHECK (
  public.current_user_is_active() AND
  organization_id = public.current_user_organization_id() AND
  public.current_user_role() IN ('admin', 'employee')
);
CREATE POLICY "document_chunks_update_role" ON public.document_chunks FOR UPDATE TO authenticated USING (
  public.current_user_is_active() AND
  organization_id = public.current_user_organization_id() AND
  public.current_user_role() IN ('admin', 'employee')
) WITH CHECK (
  public.current_user_is_active() AND
  organization_id = public.current_user_organization_id() AND
  public.current_user_role() IN ('admin', 'employee')
);
CREATE POLICY "document_chunks_delete_role" ON public.document_chunks FOR DELETE TO authenticated USING (
  public.current_user_is_active() AND
  organization_id = public.current_user_organization_id() AND
  public.current_user_role() IN ('admin', 'employee')
);

-- ==============================================================================
-- P0-002: POLÍTICAS DE case_derivations (Reconstrucción y Seguridad)
-- ==============================================================================

ALTER TABLE public.case_derivations
ADD COLUMN IF NOT EXISTS from_organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS from_organization_name text,
ADD COLUMN IF NOT EXISTS case_title text,
ADD COLUMN IF NOT EXISTS to_email text,
ADD COLUMN IF NOT EXISTS to_organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS mensaje text,
ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS accepted_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE POLICY "case_derivations_select_role" ON public.case_derivations FOR SELECT TO authenticated USING (
  public.current_user_is_active() AND
  (
    organization_id = public.current_user_organization_id() OR
    from_organization_id = public.current_user_organization_id() OR
    to_organization_id = public.current_user_organization_id()
  )
);

CREATE POLICY "case_derivations_insert_role" ON public.case_derivations FOR INSERT TO authenticated WITH CHECK (
  public.current_user_is_active() AND
  public.current_user_role() IN ('admin', 'employee') AND
  (organization_id = public.current_user_organization_id() OR from_organization_id = public.current_user_organization_id())
);

CREATE POLICY "case_derivations_update_role" ON public.case_derivations FOR UPDATE TO authenticated USING (
  public.current_user_is_active() AND
  public.current_user_role() IN ('admin', 'employee') AND
  (organization_id = public.current_user_organization_id() OR from_organization_id = public.current_user_organization_id() OR to_organization_id = public.current_user_organization_id())
) WITH CHECK (
  public.current_user_is_active() AND
  public.current_user_role() IN ('admin', 'employee') AND
  (organization_id = public.current_user_organization_id() OR from_organization_id = public.current_user_organization_id() OR to_organization_id = public.current_user_organization_id())
);

CREATE POLICY "case_derivations_delete_role" ON public.case_derivations FOR DELETE TO authenticated USING (
  public.current_user_is_active() AND
  public.current_user_role() IN ('admin', 'employee') AND
  (organization_id = public.current_user_organization_id() OR from_organization_id = public.current_user_organization_id())
);

-- ==============================================================================
-- P0-005: PROTOCOLO NOTARIAL RESTRINGIDO A ESCRIBANÍA
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.protocolo_escrituras (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    case_id uuid REFERENCES public.cases(id) ON DELETE SET NULL,
    numero integer NOT NULL,
    anio integer NOT NULL,
    fecha_otorgamiento date NOT NULL,
    tipo_acto text,
    comparecientes text,
    objeto text,
    folio_desde text,
    folio_hasta text,
    observaciones text,
    created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.protocolo_escrituras ENABLE ROW LEVEL SECURITY;

CREATE POLICY "protocolo_select_role" ON public.protocolo_escrituras FOR SELECT TO authenticated USING (
  public.current_user_is_active() AND
  organization_id = public.current_user_organization_id() AND
  public.current_user_role() IN ('admin', 'employee', 'auditor')
);

CREATE POLICY "protocolo_insert_role" ON public.protocolo_escrituras FOR INSERT TO authenticated WITH CHECK (
  public.current_user_is_active() AND
  organization_id = public.current_user_organization_id() AND
  public.current_user_role() IN ('admin', 'employee')
);

CREATE POLICY "protocolo_update_role" ON public.protocolo_escrituras FOR UPDATE TO authenticated USING (
  public.current_user_is_active() AND
  organization_id = public.current_user_organization_id() AND
  public.current_user_role() IN ('admin', 'employee')
) WITH CHECK (
  public.current_user_is_active() AND
  organization_id = public.current_user_organization_id() AND
  public.current_user_role() IN ('admin', 'employee')
);

CREATE POLICY "protocolo_delete_role" ON public.protocolo_escrituras FOR DELETE TO authenticated USING (
  public.current_user_is_active() AND
  organization_id = public.current_user_organization_id() AND
  public.current_user_role() IN ('admin', 'employee')
);

COMMIT;
