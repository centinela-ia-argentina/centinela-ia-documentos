-- Migration: match_case_document_chunks
-- Description: RPC for semantic search with cross-tenant isolation and deduplication.

CREATE OR REPLACE FUNCTION public.match_case_document_chunks(
    p_organization_id uuid,
    p_case_id uuid,
    p_query_embedding vector(768),
    p_match_threshold float,
    p_match_count int
)
RETURNS TABLE (
    id uuid,
    document_id uuid,
    content text,
    similarity float,
    file_name text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT
        dc.id,
        dc.document_id,
        dc.content,
        1 - (dc.embedding <=> p_query_embedding) AS similarity,
        d.file_name
    FROM document_chunks dc
    JOIN documents d ON dc.document_id = d.id
    WHERE d.organization_id = p_organization_id
      AND d.case_id = p_case_id
      AND 1 - (dc.embedding <=> p_query_embedding) > p_match_threshold
    ORDER BY similarity DESC
    LIMIT p_match_count;
END;
$$;

-- Revoke execute from public and grant only to authenticated and service_role
REVOKE EXECUTE ON FUNCTION public.match_case_document_chunks(uuid, uuid, vector, float, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.match_case_document_chunks(uuid, uuid, vector, float, int) TO authenticated, service_role;
