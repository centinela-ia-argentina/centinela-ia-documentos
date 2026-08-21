-- ==============================================================================
-- ROLLBACK: 20260818150000_explicit_grants
-- ==============================================================================

BEGIN;

-- Restore generic execution privileges for all routines in schema public
GRANT EXECUTE ON ALL ROUTINES IN SCHEMA public TO authenticated, service_role;

-- We don't restore execution for anon or public, keeping the baseline secure, 
-- but we undo the strict granular restrictions.

COMMIT;
