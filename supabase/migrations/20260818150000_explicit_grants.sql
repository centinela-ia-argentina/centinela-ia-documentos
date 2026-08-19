-- ==============================================================================
-- MIGRATION: 20260818150000_explicit_grants
-- ==============================================================================

BEGIN;

-- 1. REVOKE DANGEROUS GRANTS
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
REVOKE TRUNCATE, TRIGGER, REFERENCES ON ALL TABLES IN SCHEMA public FROM authenticated;
REVOKE EXECUTE ON ALL ROUTINES IN SCHEMA public FROM public;
REVOKE EXECUTE ON ALL ROUTINES IN SCHEMA public FROM anon;
REVOKE EXECUTE ON ALL ROUTINES IN SCHEMA public FROM authenticated;

-- 2. EXPLICIT GRANTS FOR AUDITED FUNCTIONS
DO $$
BEGIN
  IF to_regprocedure('public.match_case_document_chunks(uuid, vector, double precision, integer)') IS NULL THEN RAISE EXCEPTION 'Function match_case_document_chunks not found'; END IF;
  IF to_regprocedure('public.registrar_escritura_atomica(jsonb)') IS NULL THEN RAISE EXCEPTION 'Function registrar_escritura_atomica not found'; END IF;
  IF to_regprocedure('public.platform_create_organization_with_admin_invitation(text, text, text, text, text)') IS NULL THEN RAISE EXCEPTION 'Function platform_create_organization_with_admin_invitation not found'; END IF;
  IF to_regprocedure('public.current_user_organization_id()') IS NULL THEN RAISE EXCEPTION 'Function current_user_organization_id not found'; END IF;
  IF to_regprocedure('public.current_user_role()') IS NULL THEN RAISE EXCEPTION 'Function current_user_role not found'; END IF;
  IF to_regprocedure('public.set_updated_at()') IS NULL THEN RAISE EXCEPTION 'Function set_updated_at not found'; END IF;
  IF to_regprocedure('public.protect_profile_security_fields()') IS NULL THEN RAISE EXCEPTION 'Function protect_profile_security_fields not found'; END IF;
  IF to_regprocedure('public.prevent_derivations_mutation()') IS NULL THEN RAISE EXCEPTION 'Function prevent_derivations_mutation not found'; END IF;
END $$;

GRANT EXECUTE ON FUNCTION public.match_case_document_chunks(uuid, vector, double precision, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.registrar_escritura_atomica(jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.platform_create_organization_with_admin_invitation(text, text, text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.current_user_organization_id() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.current_user_role() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.set_updated_at() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.protect_profile_security_fields() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.prevent_derivations_mutation() TO authenticated, service_role;

COMMIT;
