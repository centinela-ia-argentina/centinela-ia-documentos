-- ==============================================================================
-- ROLLBACK: 20260818150000_explicit_grants
-- ==============================================================================

BEGIN;

-- This rollback restores the historical broad EXECUTE grants only so CI can
-- prove exact reversibility against the legacy baseline. It must never run as
-- a standalone production recovery action.
DO $$
BEGIN
  IF current_setting('centinela.is_ci', true) IS DISTINCT FROM 'true' THEN
    RAISE EXCEPTION 'Rollback bloqueado: centinela.is_ci debe ser true';
  END IF;
END $$;

-- Restore the historical baseline only inside the guarded CI transaction.
GRANT EXECUTE ON ALL ROUTINES IN SCHEMA public TO authenticated, service_role;

-- We don't restore execution for anon or public, keeping the baseline secure,
-- but we undo the strict granular restrictions for exact CI reversibility.

COMMIT;
