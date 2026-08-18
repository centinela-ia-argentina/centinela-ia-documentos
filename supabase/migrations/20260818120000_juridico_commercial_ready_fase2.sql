-- ==============================================================================
-- MIGRATION: 20260818120000_juridico_commercial_ready_fase2
-- ==============================================================================

BEGIN;

-- ------------------------------------------------------------------------------
-- 1. PREFLIGHT CHECKS FOR CROSS-TENANT INTEGRITY
-- ------------------------------------------------------------------------------
-- Check for existing inconsistencies before adding constraints.
-- If any query returns rows, the DO block will raise an exception and abort.

DO $$
DECLARE
    bad_rows INTEGER;
BEGIN
    -- cases -> properties (property must belong to the same organization)
    SELECT COUNT(*) INTO bad_rows
    FROM cases c
    JOIN properties p ON c.property_id = p.id
    WHERE c.organization_id != p.organization_id;
    IF bad_rows > 0 THEN RAISE EXCEPTION 'Preflight failed: % cases have properties from different organizations', bad_rows; END IF;

    -- documents -> cases
    SELECT COUNT(*) INTO bad_rows
    FROM documents d
    JOIN cases c ON d.case_id = c.id
    WHERE d.organization_id != c.organization_id;
    IF bad_rows > 0 THEN RAISE EXCEPTION 'Preflight failed: % documents belong to cases from different organizations', bad_rows; END IF;

    -- case_events -> cases
    -- (Assuming case_events has organization_id. If not, this check is skipped or adapted)
    
    -- agenda_plazos -> cases
    SELECT COUNT(*) INTO bad_rows
    FROM agenda_plazos a
    JOIN cases c ON a.case_id = c.id
    WHERE a.organization_id != c.organization_id;
    IF bad_rows > 0 THEN RAISE EXCEPTION 'Preflight failed: % agenda_plazos belong to cases from different organizations', bad_rows; END IF;

    -- agent_messages -> cases
    SELECT COUNT(*) INTO bad_rows
    FROM agent_messages am
    JOIN cases c ON am.case_id = c.id
    WHERE am.organization_id != c.organization_id;
    IF bad_rows > 0 THEN RAISE EXCEPTION 'Preflight failed: % agent_messages belong to cases from different organizations', bad_rows; END IF;

    -- ai_outputs -> cases
    SELECT COUNT(*) INTO bad_rows
    FROM ai_outputs ao
    JOIN cases c ON ao.case_id = c.id
    WHERE ao.organization_id != c.organization_id;
    IF bad_rows > 0 THEN RAISE EXCEPTION 'Preflight failed: % ai_outputs belong to cases from different organizations', bad_rows; END IF;

    -- ai_outputs -> documents
    SELECT COUNT(*) INTO bad_rows
    FROM ai_outputs ao
    JOIN documents d ON ao.document_id = d.id
    WHERE ao.organization_id != d.organization_id;
    IF bad_rows > 0 THEN RAISE EXCEPTION 'Preflight failed: % ai_outputs belong to documents from different organizations', bad_rows; END IF;

    -- checklists -> cases
    SELECT COUNT(*) INTO bad_rows
    FROM checklists ch
    JOIN cases c ON ch.case_id = c.id
    WHERE ch.organization_id != c.organization_id;
    IF bad_rows > 0 THEN RAISE EXCEPTION 'Preflight failed: % checklists belong to cases from different organizations', bad_rows; END IF;
    
    -- reports -> cases (If reports has case_id and organization_id)
    -- IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='reports' AND column_name='case_id') THEN
    --     EXECUTE 'SELECT COUNT(*) FROM reports r JOIN cases c ON r.case_id = c.id WHERE r.organization_id != c.organization_id' INTO bad_rows;
    --     IF bad_rows > 0 THEN RAISE EXCEPTION 'Preflight failed: % reports belong to cases from different organizations', bad_rows; END IF;
    -- END IF;
END $$;


-- ------------------------------------------------------------------------------
-- 2. CROSS-TENANT INTEGRITY (FOREIGN KEYS)
-- ------------------------------------------------------------------------------
-- Note on ON DELETE:
-- Historical behavior allows cascading when a case is deleted to delete its documents, agenda, etc.
-- However, we only use CASCADE where the child strictly depends on the case.

ALTER TABLE cases DROP CONSTRAINT IF EXISTS cases_id_org_key;
ALTER TABLE cases ADD CONSTRAINT cases_id_org_key UNIQUE (id, organization_id);

ALTER TABLE documents DROP CONSTRAINT IF EXISTS doc_org_match_case;
ALTER TABLE documents ADD CONSTRAINT doc_org_match_case 
FOREIGN KEY (case_id, organization_id) REFERENCES cases(id, organization_id) ON DELETE CASCADE;

ALTER TABLE agenda_plazos DROP CONSTRAINT IF EXISTS agenda_org_match_case;
ALTER TABLE agenda_plazos ADD CONSTRAINT agenda_org_match_case 
FOREIGN KEY (case_id, organization_id) REFERENCES cases(id, organization_id) ON DELETE CASCADE;

ALTER TABLE agent_messages DROP CONSTRAINT IF EXISTS agent_org_match_case;
ALTER TABLE agent_messages ADD CONSTRAINT agent_org_match_case 
FOREIGN KEY (case_id, organization_id) REFERENCES cases(id, organization_id) ON DELETE CASCADE;

ALTER TABLE ai_outputs DROP CONSTRAINT IF EXISTS ai_org_match_case;
ALTER TABLE ai_outputs ADD CONSTRAINT ai_org_match_case 
FOREIGN KEY (case_id, organization_id) REFERENCES cases(id, organization_id) ON DELETE CASCADE;

ALTER TABLE ai_outputs DROP CONSTRAINT IF EXISTS ai_org_match_doc;
-- Some ai_outputs might not have documents, so document_id can be null.
-- We must ensure the FK allows nulls (which Postgres does by default for composite FKs if any column is null, 
-- under MATCH SIMPLE, but to be strict MATCH FULL or just standard simple matching works).
ALTER TABLE ai_outputs ADD CONSTRAINT ai_org_match_doc 
FOREIGN KEY (document_id, organization_id) REFERENCES documents(id, organization_id) ON DELETE CASCADE;

ALTER TABLE checklists DROP CONSTRAINT IF EXISTS checklist_org_match_case;
ALTER TABLE checklists ADD CONSTRAINT checklist_org_match_case 
FOREIGN KEY (case_id, organization_id) REFERENCES cases(id, organization_id) ON DELETE CASCADE;


-- ------------------------------------------------------------------------------
-- 3. AGENDA ATÓMICA
-- ------------------------------------------------------------------------------
-- Agrega columna hora si no existe
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='agenda_plazos' AND column_name='hora') THEN
        ALTER TABLE agenda_plazos ADD COLUMN hora time;
    END IF;
END $$;

-- Crear una función para normalizar títulos (trim, lowercase, remover múltiples espacios)
CREATE OR REPLACE FUNCTION normalize_agenda_title(text) RETURNS text AS $$
    -- Normalize NFC is handled by PostgreSQL natively if collation allows, 
    -- but replacing multiple spaces and trimming:
    SELECT regexp_replace(lower(trim($1)), '\s+', ' ', 'g');
$$ LANGUAGE sql IMMUTABLE;

-- Drop old unique constraints
ALTER TABLE agenda_plazos DROP CONSTRAINT IF EXISTS agenda_plazos_unique_event;
DROP INDEX IF EXISTS agenda_plazos_unique_event_idx;
DROP INDEX IF EXISTS agenda_plazos_org_fecha_titulo_idx;

-- Ensure no duplicates exist before creating index
DO $$
DECLARE
    dups INTEGER;
BEGIN
    SELECT COUNT(*) INTO dups FROM (
        SELECT organization_id, COALESCE(case_id, '00000000-0000-0000-0000-000000000000'::uuid), fecha, categoria, normalize_agenda_title(titulo), COALESCE(hora, '00:00:00')
        FROM agenda_plazos
        GROUP BY 1, 2, 3, 4, 5, 6
        HAVING COUNT(*) > 1
    ) d;
    IF dups > 0 THEN 
        RAISE EXCEPTION 'Cannot create unique index for agenda_plazos: % duplicate groups found', dups; 
    END IF;
END $$;

CREATE UNIQUE INDEX agenda_plazos_unique_event_idx 
ON agenda_plazos (
    organization_id, 
    COALESCE(case_id, '00000000-0000-0000-0000-000000000000'::uuid), 
    fecha, 
    categoria, 
    normalize_agenda_title(titulo), 
    COALESCE(hora, '00:00:00')
);


-- ------------------------------------------------------------------------------
-- 4. RLS POLICIES
-- ------------------------------------------------------------------------------

-- 4.a AGENDA_PLAZOS
DROP POLICY IF EXISTS "Usuarios de la org pueden ver agenda_plazos" ON agenda_plazos;
DROP POLICY IF EXISTS "Usuarios de la org pueden insertar agenda_plazos" ON agenda_plazos;
DROP POLICY IF EXISTS "agenda_plazos_org_all" ON agenda_plazos;

-- SELECT
CREATE POLICY "agenda_select_policy" ON agenda_plazos FOR SELECT USING (
    organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid() AND status = 'active' AND role IN ('admin', 'employee', 'auditor'))
);

-- INSERT / UPDATE / DELETE
CREATE POLICY "agenda_insert_policy" ON agenda_plazos FOR INSERT WITH CHECK (
    organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid() AND status = 'active' AND role IN ('admin', 'employee'))
    AND (case_id IS NULL OR EXISTS (SELECT 1 FROM cases WHERE id = case_id AND organization_id = agenda_plazos.organization_id))
);

CREATE POLICY "agenda_update_policy" ON agenda_plazos FOR UPDATE USING (
    organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid() AND status = 'active' AND role IN ('admin', 'employee'))
) WITH CHECK (
    organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid() AND status = 'active' AND role IN ('admin', 'employee'))
    AND (case_id IS NULL OR EXISTS (SELECT 1 FROM cases WHERE id = case_id AND organization_id = agenda_plazos.organization_id))
);

CREATE POLICY "agenda_delete_policy" ON agenda_plazos FOR DELETE USING (
    organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid() AND status = 'active' AND role IN ('admin', 'employee'))
);

-- 4.b AGENT_MESSAGES
DROP POLICY IF EXISTS "agent_messages_select" ON agent_messages;
DROP POLICY IF EXISTS "agent_messages_insert" ON agent_messages;
DROP POLICY IF EXISTS "agent_messages_delete" ON agent_messages;
-- Delete any generic policies
DROP POLICY IF EXISTS "Usuarios de la org pueden ver agent_messages" ON agent_messages;
DROP POLICY IF EXISTS "Usuarios de la org pueden insertar agent_messages" ON agent_messages;

CREATE POLICY "agent_messages_select_policy" ON agent_messages FOR SELECT USING (
    organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid() AND status = 'active' AND role IN ('admin', 'employee'))
    AND EXISTS (SELECT 1 FROM cases WHERE id = case_id AND organization_id = agent_messages.organization_id)
);

CREATE POLICY "agent_messages_insert_policy" ON agent_messages FOR INSERT WITH CHECK (
    organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid() AND status = 'active' AND role IN ('admin', 'employee'))
    AND EXISTS (SELECT 1 FROM cases WHERE id = case_id AND organization_id = agent_messages.organization_id)
);

CREATE POLICY "agent_messages_delete_policy" ON agent_messages FOR DELETE USING (
    organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid() AND status = 'active' AND role IN ('admin', 'employee'))
    AND EXISTS (SELECT 1 FROM cases WHERE id = case_id AND organization_id = agent_messages.organization_id)
);

-- 4.c AI_OUTPUTS
DROP POLICY IF EXISTS "ai_outputs_delete" ON ai_outputs;
DROP POLICY IF EXISTS "Usuarios de la org pueden insertar ai_outputs" ON ai_outputs;

-- DELETE: solo admin activo
CREATE POLICY "ai_outputs_delete_policy" ON ai_outputs FOR DELETE USING (
    organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid() AND status = 'active' AND role = 'admin')
);

-- INSERT: admin/employee activos, case y document de la misma org
CREATE POLICY "ai_outputs_insert_policy" ON ai_outputs FOR INSERT WITH CHECK (
    organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid() AND status = 'active' AND role IN ('admin', 'employee'))
    AND (case_id IS NULL OR EXISTS (SELECT 1 FROM cases WHERE id = case_id AND organization_id = ai_outputs.organization_id))
    AND (document_id IS NULL OR EXISTS (SELECT 1 FROM documents WHERE id = document_id AND organization_id = ai_outputs.organization_id))
);


-- ------------------------------------------------------------------------------
-- 5. GRANTS
-- ------------------------------------------------------------------------------
-- Revoke anon access where unnecessary, restrict authenticated.
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
REVOKE TRUNCATE, TRIGGER, REFERENCES ON ALL TABLES IN SCHEMA public FROM authenticated;

-- Avoid executing functions for anon
-- REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM anon; -- Too broad?
-- Let's revoke specific ones
REVOKE EXECUTE ON FUNCTION platform_create_organization_with_admin_invitation FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION platform_create_organization_with_admin_invitation TO service_role;

-- ------------------------------------------------------------------------------
-- 6. TRIGGERS
-- ------------------------------------------------------------------------------
-- (Assuming protect_profile_security_fields and enforce_derivations_mutation are already there, we just don't touch them).
-- (set_updated_at only where updated_at exists)


-- ------------------------------------------------------------------------------
-- 7. STORAGE POLICIES
-- ------------------------------------------------------------------------------
-- Updates to storage buckets
UPDATE storage.buckets SET file_size_limit = 52428800, public = false, allowed_mime_types = ARRAY['application/pdf','image/jpeg','image/png','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'] WHERE id = 'documents';
UPDATE storage.buckets SET file_size_limit = 5242880, public = true, allowed_mime_types = ARRAY['image/png','image/jpeg','image/webp','image/svg+xml'] WHERE id = 'branding';

COMMIT;
