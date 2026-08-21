-- ==============================================================================
-- MIGRATION: 20260818120000_juridico_commercial_ready_fase2
-- ==============================================================================

BEGIN;

-- ------------------------------------------------------------------------------
-- 1. PREFLIGHT CHECKS FOR CROSS-TENANT INTEGRITY
-- ------------------------------------------------------------------------------
DO $$
DECLARE
    bad_rows INTEGER;
BEGIN
    -- cases -> properties
    SELECT COUNT(*) INTO bad_rows FROM public.cases c JOIN public.properties p ON c.property_id = p.id WHERE c.organization_id != p.organization_id;
    IF bad_rows > 0 THEN RAISE EXCEPTION 'Preflight failed: % cases have properties from different organizations', bad_rows; END IF;

    -- documents -> cases
    SELECT COUNT(*) INTO bad_rows FROM public.documents d JOIN public.cases c ON d.case_id = c.id WHERE d.organization_id != c.organization_id;
    IF bad_rows > 0 THEN RAISE EXCEPTION 'Preflight failed: % documents belong to cases from different organizations', bad_rows; END IF;

    -- agenda_plazos -> cases
    SELECT COUNT(*) INTO bad_rows FROM public.agenda_plazos a JOIN public.cases c ON a.case_id = c.id WHERE a.organization_id != c.organization_id;
    IF bad_rows > 0 THEN RAISE EXCEPTION 'Preflight failed: % agenda_plazos belong to cases from different organizations', bad_rows; END IF;

    -- agent_messages -> cases
    SELECT COUNT(*) INTO bad_rows FROM public.agent_messages am JOIN public.cases c ON am.case_id = c.id WHERE am.organization_id != c.organization_id;
    IF bad_rows > 0 THEN RAISE EXCEPTION 'Preflight failed: % agent_messages belong to cases from different organizations', bad_rows; END IF;

    -- ai_outputs -> cases
    SELECT COUNT(*) INTO bad_rows FROM public.ai_outputs ao JOIN public.cases c ON ao.case_id = c.id WHERE ao.organization_id != c.organization_id;
    IF bad_rows > 0 THEN RAISE EXCEPTION 'Preflight failed: % ai_outputs belong to cases from different organizations', bad_rows; END IF;

    -- case_events -> cases
    SELECT COUNT(*) INTO bad_rows FROM public.case_events ce JOIN public.cases c ON ce.case_id = c.id WHERE ce.organization_id != c.organization_id;
    IF bad_rows > 0 THEN RAISE EXCEPTION 'Preflight failed: % case_events belong to cases from different organizations', bad_rows; END IF;

    -- reports -> cases
    SELECT COUNT(*) INTO bad_rows FROM public.reports r JOIN public.cases c ON r.case_id = c.id WHERE r.organization_id != c.organization_id;
    IF bad_rows > 0 THEN RAISE EXCEPTION 'Preflight failed: % reports belong to cases from different organizations', bad_rows; END IF;

    -- ai_outputs -> documents
    SELECT COUNT(*) INTO bad_rows FROM public.ai_outputs ao JOIN public.documents d ON ao.document_id = d.id WHERE ao.organization_id != d.organization_id;
    IF bad_rows > 0 THEN RAISE EXCEPTION 'Preflight failed: % ai_outputs belong to documents from different organizations', bad_rows; END IF;

    -- checklists -> cases
    SELECT COUNT(*) INTO bad_rows FROM public.checklists ch JOIN public.cases c ON ch.case_id = c.id WHERE ch.organization_id != c.organization_id;
    IF bad_rows > 0 THEN RAISE EXCEPTION 'Preflight failed: % checklists belong to cases from different organizations', bad_rows; END IF;

    -- checklist_items -> checklists
    SELECT COUNT(*) INTO bad_rows FROM public.checklist_items ci JOIN public.checklists ch ON ci.checklist_id = ch.id WHERE ci.organization_id != ch.organization_id;
    IF bad_rows > 0 THEN RAISE EXCEPTION 'Preflight failed: % checklist_items belong to checklists from different organizations', bad_rows; END IF;

    -- checklist_items -> documents
    SELECT COUNT(*) INTO bad_rows FROM public.checklist_items ci JOIN public.documents d ON ci.document_id = d.id WHERE ci.organization_id != d.organization_id;
    IF bad_rows > 0 THEN RAISE EXCEPTION 'Preflight failed: % checklist_items belong to documents from different organizations', bad_rows; END IF;
END $$;


-- ------------------------------------------------------------------------------
-- 2. CROSS-TENANT INTEGRITY (FOREIGN KEYS)
-- ------------------------------------------------------------------------------

-- Ensure unique constraints exist for composite keys
ALTER TABLE public.organizations DROP CONSTRAINT IF EXISTS organizations_id_key;
ALTER TABLE public.organizations ADD CONSTRAINT organizations_id_key UNIQUE (id);

ALTER TABLE public.properties DROP CONSTRAINT IF EXISTS properties_id_org_key;
ALTER TABLE public.properties ADD CONSTRAINT properties_id_org_key UNIQUE (id, organization_id);

ALTER TABLE public.cases DROP CONSTRAINT IF EXISTS cases_id_org_key;
ALTER TABLE public.cases ADD CONSTRAINT cases_id_org_key UNIQUE (id, organization_id);

ALTER TABLE public.documents DROP CONSTRAINT IF EXISTS documents_id_org_key;
ALTER TABLE public.documents ADD CONSTRAINT documents_id_org_key UNIQUE (id, organization_id);

ALTER TABLE public.checklists DROP CONSTRAINT IF EXISTS checklists_id_org_key;
ALTER TABLE public.checklists ADD CONSTRAINT checklists_id_org_key UNIQUE (id, organization_id);


-- Apply composite FKs. Use ON DELETE CASCADE ONLY when logically coupled lifecycle.
ALTER TABLE public.cases DROP CONSTRAINT IF EXISTS cases_property_fk;
ALTER TABLE public.cases DROP CONSTRAINT IF EXISTS cases_property_id_fkey;
ALTER TABLE public.cases ADD CONSTRAINT cases_property_fk
FOREIGN KEY (property_id, organization_id) REFERENCES public.properties(id, organization_id) ON DELETE SET NULL (property_id);

ALTER TABLE public.documents DROP CONSTRAINT IF EXISTS doc_org_match_case;
ALTER TABLE public.documents DROP CONSTRAINT IF EXISTS documents_case_id_fkey;
ALTER TABLE public.documents ADD CONSTRAINT doc_org_match_case
FOREIGN KEY (case_id, organization_id) REFERENCES public.cases(id, organization_id) ON DELETE CASCADE;

ALTER TABLE public.agenda_plazos DROP CONSTRAINT IF EXISTS agenda_org_match_case;
ALTER TABLE public.agenda_plazos DROP CONSTRAINT IF EXISTS agenda_plazos_case_id_fkey;
ALTER TABLE public.agenda_plazos ADD CONSTRAINT agenda_org_match_case
FOREIGN KEY (case_id, organization_id) REFERENCES public.cases(id, organization_id) ON DELETE CASCADE;

ALTER TABLE public.agent_messages DROP CONSTRAINT IF EXISTS agent_org_match_case;
ALTER TABLE public.agent_messages DROP CONSTRAINT IF EXISTS agent_messages_case_id_fkey;
ALTER TABLE public.agent_messages ADD CONSTRAINT agent_org_match_case
FOREIGN KEY (case_id, organization_id) REFERENCES public.cases(id, organization_id) ON DELETE CASCADE;

ALTER TABLE public.ai_outputs DROP CONSTRAINT IF EXISTS ai_org_match_case;
ALTER TABLE public.ai_outputs DROP CONSTRAINT IF EXISTS ai_outputs_case_id_fkey;
ALTER TABLE public.ai_outputs ADD CONSTRAINT ai_org_match_case
FOREIGN KEY (case_id, organization_id) REFERENCES public.cases(id, organization_id) ON DELETE CASCADE;

ALTER TABLE public.ai_outputs DROP CONSTRAINT IF EXISTS ai_org_match_doc;
ALTER TABLE public.ai_outputs DROP CONSTRAINT IF EXISTS ai_outputs_document_id_fkey;
ALTER TABLE public.ai_outputs ADD CONSTRAINT ai_org_match_doc
FOREIGN KEY (document_id, organization_id) REFERENCES public.documents(id, organization_id) ON DELETE CASCADE;

ALTER TABLE public.checklists DROP CONSTRAINT IF EXISTS checklist_org_match_case;
ALTER TABLE public.checklists DROP CONSTRAINT IF EXISTS checklists_case_id_fkey;
ALTER TABLE public.checklists ADD CONSTRAINT checklist_org_match_case
FOREIGN KEY (case_id, organization_id) REFERENCES public.cases(id, organization_id) ON DELETE CASCADE;

ALTER TABLE public.checklist_items DROP CONSTRAINT IF EXISTS checklist_items_org_match_chk;
ALTER TABLE public.checklist_items DROP CONSTRAINT IF EXISTS checklist_items_checklist_id_fkey;
ALTER TABLE public.checklist_items ADD CONSTRAINT checklist_items_org_match_chk
FOREIGN KEY (checklist_id, organization_id) REFERENCES public.checklists(id, organization_id) ON DELETE CASCADE;

ALTER TABLE public.checklist_items DROP CONSTRAINT IF EXISTS checklist_items_org_match_doc;
ALTER TABLE public.checklist_items DROP CONSTRAINT IF EXISTS checklist_items_document_id_fkey;
ALTER TABLE public.checklist_items ADD CONSTRAINT checklist_items_org_match_doc
FOREIGN KEY (document_id, organization_id) REFERENCES public.documents(id, organization_id) ON DELETE SET NULL (document_id);

ALTER TABLE public.case_events DROP CONSTRAINT IF EXISTS case_events_case_fk;
ALTER TABLE public.case_events DROP CONSTRAINT IF EXISTS case_events_case_id_fkey;
ALTER TABLE public.case_events ADD CONSTRAINT case_events_case_fk
FOREIGN KEY (case_id, organization_id) REFERENCES public.cases(id, organization_id) ON DELETE CASCADE;

ALTER TABLE public.reports DROP CONSTRAINT IF EXISTS reports_case_fk;
ALTER TABLE public.reports DROP CONSTRAINT IF EXISTS reports_case_id_fkey;
ALTER TABLE public.reports ADD CONSTRAINT reports_case_fk
FOREIGN KEY (case_id, organization_id) REFERENCES public.cases(id, organization_id) ON DELETE CASCADE;


-- ------------------------------------------------------------------------------
-- 3. AGENDA ATÓMICA
-- ------------------------------------------------------------------------------
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='agenda_plazos' AND column_name='hora') THEN
        ALTER TABLE public.agenda_plazos ADD COLUMN hora time;
    END IF;
END $$;

CREATE OR REPLACE FUNCTION public.normalize_agenda_title(text) RETURNS text AS $$
    SELECT regexp_replace(lower(trim($1)), '\s+', ' ', 'g');
$$ LANGUAGE sql IMMUTABLE;

ALTER TABLE public.agenda_plazos DROP CONSTRAINT IF EXISTS agenda_plazos_unique_event;
DROP INDEX IF EXISTS agenda_plazos_unique_event_idx;

DO $$
DECLARE
    dups INTEGER;
BEGIN
    SELECT COUNT(*) INTO dups FROM (
        SELECT organization_id, COALESCE(case_id, '00000000-0000-0000-0000-000000000000'::uuid), fecha, categoria, public.normalize_agenda_title(titulo), COALESCE(hora, '00:00:00')
        FROM public.agenda_plazos
        GROUP BY 1, 2, 3, 4, 5, 6
        HAVING COUNT(*) > 1
    ) d;
    IF dups > 0 THEN
        RAISE EXCEPTION 'Cannot create unique index for agenda_plazos: % duplicate groups found', dups;
    END IF;
END $$;

CREATE UNIQUE INDEX agenda_plazos_unique_event_idx
ON public.agenda_plazos (
    organization_id,
    COALESCE(case_id, '00000000-0000-0000-0000-000000000000'::uuid),
    fecha,
    categoria,
    public.normalize_agenda_title(titulo),
    COALESCE(hora, '00:00:00')
);


-- ------------------------------------------------------------------------------
-- 4. RLS POLICIES
-- ------------------------------------------------------------------------------

-- 4.a AGENDA_PLAZOS
DROP POLICY IF EXISTS "agenda_select_policy" ON public.agenda_plazos;
DROP POLICY IF EXISTS "agenda_insert_policy" ON public.agenda_plazos;
DROP POLICY IF EXISTS "agenda_update_policy" ON public.agenda_plazos;
DROP POLICY IF EXISTS "agenda_delete_policy" ON public.agenda_plazos;
DROP POLICY IF EXISTS "Usuarios de la org pueden ver agenda_plazos" ON public.agenda_plazos;
DROP POLICY IF EXISTS "Usuarios de la org pueden insertar agenda_plazos" ON public.agenda_plazos;
DROP POLICY IF EXISTS "agenda_plazos_org_all" ON public.agenda_plazos;

CREATE POLICY "agenda_select_policy" ON public.agenda_plazos FOR SELECT USING (
    organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid() AND status = 'active' AND role IN ('admin', 'employee', 'auditor'))
);

CREATE POLICY "agenda_insert_policy" ON public.agenda_plazos FOR INSERT WITH CHECK (
    organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid() AND status = 'active' AND role IN ('admin', 'employee'))
    AND (case_id IS NULL OR EXISTS (SELECT 1 FROM public.cases WHERE id = case_id AND organization_id = agenda_plazos.organization_id))
);

CREATE POLICY "agenda_update_policy" ON public.agenda_plazos FOR UPDATE USING (
    organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid() AND status = 'active' AND role IN ('admin', 'employee'))
) WITH CHECK (
    organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid() AND status = 'active' AND role IN ('admin', 'employee'))
    AND (case_id IS NULL OR EXISTS (SELECT 1 FROM public.cases WHERE id = case_id AND organization_id = agenda_plazos.organization_id))
);

CREATE POLICY "agenda_delete_policy" ON public.agenda_plazos FOR DELETE USING (
    organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid() AND status = 'active' AND role IN ('admin', 'employee'))
);

-- 4.b AGENT_MESSAGES
DROP POLICY IF EXISTS "agent_messages_org_all" ON public.agent_messages;
DROP POLICY IF EXISTS "agent_messages_select_policy" ON public.agent_messages;
DROP POLICY IF EXISTS "agent_messages_insert_policy" ON public.agent_messages;
DROP POLICY IF EXISTS "agent_messages_delete_policy" ON public.agent_messages;

CREATE POLICY "agent_messages_select_policy" ON public.agent_messages FOR SELECT USING (
    organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid() AND status = 'active' AND role IN ('admin', 'employee', 'auditor'))
);

CREATE POLICY "agent_messages_insert_policy" ON public.agent_messages FOR INSERT WITH CHECK (
    organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid() AND status = 'active' AND role IN ('admin', 'employee'))
    AND EXISTS (SELECT 1 FROM public.cases WHERE id = case_id AND organization_id = agent_messages.organization_id)
);

CREATE POLICY "agent_messages_delete_policy" ON public.agent_messages FOR DELETE USING (
    organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid() AND status = 'active' AND role = 'admin')
);

-- 4.c AI_OUTPUTS
DROP POLICY IF EXISTS "ai_outputs_select_policy" ON public.ai_outputs;
DROP POLICY IF EXISTS "ai_outputs_insert_policy" ON public.ai_outputs;
DROP POLICY IF EXISTS "ai_outputs_delete_policy" ON public.ai_outputs;
DROP POLICY IF EXISTS "ai_outputs_org_all" ON public.ai_outputs;

CREATE POLICY "ai_outputs_select_policy" ON public.ai_outputs FOR SELECT USING (
    organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid() AND status = 'active' AND role IN ('admin', 'employee', 'auditor'))
);

CREATE POLICY "ai_outputs_insert_policy" ON public.ai_outputs FOR INSERT WITH CHECK (
    organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid() AND status = 'active' AND role IN ('admin', 'employee'))
    AND EXISTS (SELECT 1 FROM public.cases WHERE id = case_id AND organization_id = ai_outputs.organization_id)
);

CREATE POLICY "ai_outputs_delete_policy" ON public.ai_outputs FOR DELETE USING (
    organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid() AND status = 'active' AND role = 'admin')
);

-- 4.d CASES
DROP POLICY IF EXISTS "cases_org_all" ON public.cases;
DROP POLICY IF EXISTS "cases_select_policy" ON public.cases;
DROP POLICY IF EXISTS "cases_insert_policy" ON public.cases;
DROP POLICY IF EXISTS "cases_update_policy" ON public.cases;
DROP POLICY IF EXISTS "cases_delete_policy" ON public.cases;

CREATE POLICY "cases_select_policy" ON public.cases FOR SELECT USING (
    EXISTS (
        SELECT 1
        FROM public.profiles p
        WHERE p.id = auth.uid()
          AND p.status = 'active'
          AND p.organization_id = cases.organization_id
          AND (
              p.role IN ('admin', 'employee', 'auditor')
              OR (
                  p.role = 'client'
                  AND cases.assigned_to = auth.uid()
              )
          )
    )
);

CREATE POLICY "cases_insert_policy" ON public.cases FOR INSERT WITH CHECK (
    EXISTS (
        SELECT 1
        FROM public.profiles p
        WHERE p.id = auth.uid()
          AND p.status = 'active'
          AND p.role IN ('admin', 'employee')
          AND p.organization_id = cases.organization_id
    )
);

CREATE POLICY "cases_update_policy" ON public.cases FOR UPDATE USING (
    EXISTS (
        SELECT 1
        FROM public.profiles p
        WHERE p.id = auth.uid()
          AND p.status = 'active'
          AND p.role IN ('admin', 'employee')
          AND p.organization_id = cases.organization_id
    )
) WITH CHECK (
    EXISTS (
        SELECT 1
        FROM public.profiles p
        WHERE p.id = auth.uid()
          AND p.status = 'active'
          AND p.role IN ('admin', 'employee')
          AND p.organization_id = cases.organization_id
    )
);

CREATE POLICY "cases_delete_policy" ON public.cases FOR DELETE USING (
    EXISTS (
        SELECT 1
        FROM public.profiles p
        WHERE p.id = auth.uid()
          AND p.status = 'active'
          AND p.role IN ('admin', 'employee')
          AND p.organization_id = cases.organization_id
    )
);

-- ------------------------------------------------------------------------------
-- 5. STORAGE POLICIES
-- ------------------------------------------------------------------------------
-- Recreate documents bucket policies strictly
-- First, ensure the documents bucket exists
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'documents',
  'documents',
  false,
  52428800, -- 50MiB
  ARRAY['application/pdf', 'image/jpeg', 'image/png', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']
) ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = 52428800,
  allowed_mime_types = ARRAY['application/pdf', 'image/jpeg', 'image/png', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'];

DROP POLICY IF EXISTS "storage_select_policy" ON storage.objects;
DROP POLICY IF EXISTS "storage_insert_policy" ON storage.objects;
DROP POLICY IF EXISTS "storage_delete_policy" ON storage.objects;

DROP POLICY IF EXISTS "documents_select" ON storage.objects;
DROP POLICY IF EXISTS "documents_insert" ON storage.objects;
DROP POLICY IF EXISTS "documents_update" ON storage.objects;
DROP POLICY IF EXISTS "documents_delete" ON storage.objects;

-- SELECT: admin, employee, auditor can read if they belong to the org matching the first folder path.
CREATE POLICY "documents_select" ON storage.objects FOR SELECT USING (
    bucket_id = 'documents'
    AND (auth.uid() IS NOT NULL)
    AND (split_part(name, '/', 1) = (SELECT organization_id::text FROM public.profiles WHERE id = auth.uid() AND status = 'active' AND role IN ('admin', 'employee', 'auditor')))
);

-- INSERT: admin, employee can write to their org folder
CREATE POLICY "documents_insert" ON storage.objects FOR INSERT WITH CHECK (
    bucket_id = 'documents'
    AND (auth.uid() IS NOT NULL)
    AND (split_part(name, '/', 1) = (SELECT organization_id::text FROM public.profiles WHERE id = auth.uid() AND status = 'active' AND role IN ('admin', 'employee')))
);

-- UPDATE: same as insert
CREATE POLICY "documents_update" ON storage.objects FOR UPDATE USING (
    bucket_id = 'documents'
    AND (auth.uid() IS NOT NULL)
    AND (split_part(name, '/', 1) = (SELECT organization_id::text FROM public.profiles WHERE id = auth.uid() AND status = 'active' AND role IN ('admin', 'employee')))
);

-- DELETE: admin only can delete
CREATE POLICY "documents_delete" ON storage.objects FOR DELETE USING (
    bucket_id = 'documents'
    AND (auth.uid() IS NOT NULL)
    AND (split_part(name, '/', 1) = (SELECT organization_id::text FROM public.profiles WHERE id = auth.uid() AND status = 'active' AND role = 'admin'))
);


-- ------------------------------------------------------------------------------
-- 6. GRANTS (Strict & Explicit)
-- ------------------------------------------------------------------------------
-- 1. REVOKE DANGEROUS GRANTS
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
REVOKE TRUNCATE, TRIGGER, REFERENCES ON ALL TABLES IN SCHEMA public FROM authenticated;
REVOKE EXECUTE ON ALL ROUTINES IN SCHEMA public FROM public;
REVOKE EXECUTE ON ALL ROUTINES IN SCHEMA public FROM anon;
REVOKE EXECUTE ON ALL ROUTINES IN SCHEMA public FROM authenticated;

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated, service_role;
GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA public TO authenticated, service_role;

-- 2. EXPLICIT GRANTS FOR AUDITED FUNCTIONS
DO $$
BEGIN
  IF to_regprocedure('public.match_case_document_chunks(uuid, vector, double precision, integer)') IS NULL THEN RAISE EXCEPTION 'Function match_case_document_chunks not found'; END IF;
  IF to_regprocedure('public.platform_create_organization_with_admin_invitation(text, text, uuid, uuid, timestamptz)') IS NULL THEN RAISE EXCEPTION 'Function platform_create_organization_with_admin_invitation not found'; END IF;
  IF to_regprocedure('public.current_user_organization_id()') IS NULL THEN RAISE EXCEPTION 'Function current_user_organization_id not found'; END IF;
  IF to_regprocedure('public.current_user_role()') IS NULL THEN RAISE EXCEPTION 'Function current_user_role not found'; END IF;
  IF to_regprocedure('public.current_user_is_active()') IS NULL THEN RAISE EXCEPTION 'Function current_user_is_active not found'; END IF;
  IF to_regprocedure('public.is_org_admin()') IS NULL THEN RAISE EXCEPTION 'Function is_org_admin not found'; END IF;
  IF to_regprocedure('public.set_updated_at()') IS NULL THEN RAISE EXCEPTION 'Function set_updated_at not found'; END IF;
  IF to_regprocedure('public.protect_profile_security_fields()') IS NULL THEN RAISE EXCEPTION 'Function protect_profile_security_fields not found'; END IF;
  IF to_regprocedure('public.normalize_agenda_title(text)') IS NULL THEN RAISE EXCEPTION 'Function normalize_agenda_title not found'; END IF;
END $$;

GRANT EXECUTE ON FUNCTION public.match_case_document_chunks(uuid, vector, double precision, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.platform_create_organization_with_admin_invitation(text, text, uuid, uuid, timestamptz) TO service_role;
GRANT EXECUTE ON FUNCTION public.current_user_organization_id() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.current_user_role() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.current_user_is_active() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_org_admin() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.set_updated_at() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.protect_profile_security_fields() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.normalize_agenda_title(text) TO authenticated, service_role;

COMMIT;
