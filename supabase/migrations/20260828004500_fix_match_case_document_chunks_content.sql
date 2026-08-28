-- ==============================================================================
-- MIGRATION: 20260828004500_fix_match_case_document_chunks_content
-- ==============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.match_case_document_chunks(
    p_case_id uuid,
    p_query_embedding vector(768),
    p_match_threshold double precision DEFAULT 0.1,
    p_match_count integer DEFAULT 10
)
RETURNS TABLE (
    id uuid,
    document_id uuid,
    chunk_text text,
    similarity double precision
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_user_id uuid;
    v_org_id uuid;
    v_role text;
    v_case_exists boolean;
BEGIN
    -- 1. Get authenticated user
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    -- 2. Validate profile, get org and role
    SELECT organization_id, role INTO v_org_id, v_role
    FROM public.profiles
    WHERE profiles.id = v_user_id AND status = 'active';

    IF v_org_id IS NULL THEN
        RAISE EXCEPTION 'Active profile not found';
    END IF;

    -- 3. Restrict AI access to admin and employee
    IF v_role NOT IN ('admin', 'employee') THEN
        RAISE EXCEPTION 'Unauthorized role for AI features';
    END IF;

    -- 4. Validate case access
    SELECT EXISTS (
        SELECT 1 FROM public.cases
        WHERE cases.id = p_case_id AND cases.organization_id = v_org_id
    ) INTO v_case_exists;

    IF NOT v_case_exists THEN
        RAISE EXCEPTION 'Case not found or access denied';
    END IF;

    -- 5. Validate parameters
    IF p_match_count < 1 OR p_match_count > 100 THEN
        RAISE EXCEPTION 'Match count must be between 1 and 100';
    END IF;

    IF p_match_threshold < -1.0 OR p_match_threshold > 1.0 THEN
        RAISE EXCEPTION 'Match threshold must be between -1.0 and 1.0';
    END IF;

    -- 6. Perform the vector search
    RETURN QUERY
    SELECT
        dc.id,
        dc.document_id,
        dc.content AS chunk_text,
        1 - (dc.embedding <=> p_query_embedding) AS similarity
    FROM public.document_chunks dc
    JOIN public.documents d ON d.id = dc.document_id
    WHERE d.case_id = p_case_id
      AND d.organization_id = v_org_id
      AND dc.organization_id = v_org_id
      AND 1 - (dc.embedding <=> p_query_embedding) > p_match_threshold
    ORDER BY dc.embedding <=> p_query_embedding
    LIMIT p_match_count;
END;
$$;

-- Revoke default execute from public and anon
REVOKE EXECUTE ON FUNCTION public.match_case_document_chunks(uuid, vector, double precision, integer) FROM public;
REVOKE EXECUTE ON FUNCTION public.match_case_document_chunks(uuid, vector, double precision, integer) FROM anon;

-- Grant execute only to authenticated and service_role
GRANT EXECUTE ON FUNCTION public.match_case_document_chunks(uuid, vector, double precision, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.match_case_document_chunks(uuid, vector, double precision, integer) TO service_role;

NOTIFY pgrst, 'reload schema';

COMMIT;
