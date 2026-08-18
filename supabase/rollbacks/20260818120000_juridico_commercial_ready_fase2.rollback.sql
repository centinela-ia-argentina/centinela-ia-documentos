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

-- 3. Drop unique constraints and indexes
ALTER TABLE checklists DROP CONSTRAINT IF EXISTS checklist_org_match_case;
ALTER TABLE ai_outputs DROP CONSTRAINT IF EXISTS ai_org_match_doc;
ALTER TABLE ai_outputs DROP CONSTRAINT IF EXISTS ai_org_match_case;
ALTER TABLE agent_messages DROP CONSTRAINT IF EXISTS agent_org_match_case;
ALTER TABLE agenda_plazos DROP CONSTRAINT IF EXISTS agenda_org_match_case;
ALTER TABLE documents DROP CONSTRAINT IF EXISTS doc_org_match_case;
ALTER TABLE cases DROP CONSTRAINT IF EXISTS cases_id_org_key;

DROP INDEX IF EXISTS agenda_plazos_unique_event_idx;

-- 4. Re-create old indexes/columns if needed
-- (Since we did not DROP hora, we leave it or drop it, user said "Do not drop hora" in rollback? Wait.
-- User said: "Verificá expresamente que la migración principal no: - elimine la columna hora"
-- In rollback, usually we drop new columns. But maybe we keep it to not lose data. I will leave it).

-- 5. Restore GRANTS
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon;
GRANT TRUNCATE, TRIGGER, REFERENCES ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT EXECUTE ON FUNCTION platform_create_organization_with_admin_invitation TO public, anon, authenticated;

COMMIT;
