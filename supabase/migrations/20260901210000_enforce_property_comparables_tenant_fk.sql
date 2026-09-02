BEGIN;

DO $$
BEGIN
  -- 1. Check for historical cross-tenant rows
  IF EXISTS (
    SELECT 1
    FROM public.property_comparables pc
    JOIN public.properties p ON p.id = pc.property_id
    WHERE pc.property_id IS NOT NULL
      AND pc.organization_id IS DISTINCT FROM p.organization_id
  ) THEN
    RAISE EXCEPTION 'Abortando migración: existen filas en property_comparables con cross-tenant reference a properties';
  END IF;

  -- 2. Create UNIQUE constraint on properties if not exists
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'properties_organization_id_id_key'
      AND conrelid = 'public.properties'::regclass
  ) THEN
    ALTER TABLE public.properties
      ADD CONSTRAINT properties_organization_id_id_key UNIQUE (organization_id, id);
  END IF;

  -- 3. Add composite FK on property_comparables
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'property_comparables_organization_property_fkey'
      AND conrelid = 'public.property_comparables'::regclass
  ) THEN
    ALTER TABLE public.property_comparables
      ADD CONSTRAINT property_comparables_organization_property_fkey 
      FOREIGN KEY (organization_id, property_id) 
      REFERENCES public.properties (organization_id, id) 
      ON DELETE CASCADE;
  END IF;

END $$;

NOTIFY pgrst, 'reload schema';

COMMIT;
