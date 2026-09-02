BEGIN;

DO $$
BEGIN
  IF current_setting('centinela.is_ci', true) = 'true' THEN
    ALTER TABLE public.property_comparables
      DROP CONSTRAINT IF EXISTS property_comparables_organization_property_fkey;

    ALTER TABLE public.properties
      DROP CONSTRAINT IF EXISTS properties_organization_id_id_key;
  ELSE
    RAISE EXCEPTION 'Rollback bloqueado: centinela.is_ci debe ser true';
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';

COMMIT;
