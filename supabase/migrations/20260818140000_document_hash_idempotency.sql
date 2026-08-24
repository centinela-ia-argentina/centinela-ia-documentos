-- ==============================================================================
-- MIGRATION: 20260818140000_document_hash_idempotency
-- ==============================================================================

BEGIN;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='documents' AND column_name='file_hash') THEN
        ALTER TABLE public.documents ADD COLUMN file_hash text;
    END IF;
END $$;

-- Remove the old name/size constraint if it exists
ALTER TABLE public.documents DROP CONSTRAINT IF EXISTS doc_unique_case_file;

-- Preflight checks for duplicates before creating unique indexes
DO $$
DECLARE
    dup_count integer;
BEGIN
    -- Check case_id IS NOT NULL duplicates
    SELECT count(*)
    INTO dup_count
    FROM (
        SELECT organization_id, case_id, file_hash
        FROM public.documents
        WHERE case_id IS NOT NULL AND file_hash IS NOT NULL
        GROUP BY organization_id, case_id, file_hash
        HAVING count(*) > 1
    ) dupes;

    IF dup_count > 0 THEN
        RAISE EXCEPTION 'Abortando migración: Se encontraron % registros duplicados (case_id IS NOT NULL) para el mismo file_hash.', dup_count;
    END IF;

    -- Check case_id IS NULL duplicates
    SELECT count(*)
    INTO dup_count
    FROM (
        SELECT organization_id, file_hash
        FROM public.documents
        WHERE case_id IS NULL AND file_hash IS NOT NULL
        GROUP BY organization_id, file_hash
        HAVING count(*) > 1
    ) dupes;

    IF dup_count > 0 THEN
        RAISE EXCEPTION 'Abortando migración: Se encontraron % registros duplicados (case_id IS NULL) para el mismo file_hash.', dup_count;
    END IF;
END $$;

-- Drop old constraint if any
ALTER TABLE public.documents DROP CONSTRAINT IF EXISTS doc_unique_content_case;

-- Create partial unique indexes
CREATE UNIQUE INDEX IF NOT EXISTS documents_unique_case_hash
ON public.documents (organization_id, case_id, file_hash)
WHERE case_id IS NOT NULL AND file_hash IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS documents_unique_general_hash
ON public.documents (organization_id, file_hash)
WHERE case_id IS NULL AND file_hash IS NOT NULL;

COMMIT;
