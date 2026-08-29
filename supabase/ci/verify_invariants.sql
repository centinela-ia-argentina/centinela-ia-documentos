-- supabase/ci/verify_invariants.sql

DO $$
DECLARE
  rec RECORD;
  t_name text;
  has_rls boolean;
  vuln_storage integer;
  vuln_using integer;
BEGIN
  RAISE NOTICE 'Verificando Invariantes Post-Rollback...';

  -- 1. Verificar RLS habilitado
  FOR t_name IN SELECT unnest(ARRAY['properties', 'clients', 'rental_contracts', 'rent_index_values', 'documents', 'case_derivations'])
  LOOP
    SELECT relrowsecurity INTO has_rls
    FROM pg_class
    WHERE relname = t_name AND relnamespace = 'public'::regnamespace;
    
    IF NOT has_rls THEN
      RAISE EXCEPTION 'RLS is disabled on table %', t_name;
    END IF;
  END LOOP;

  -- Para protocolo_escrituras (solo si existe)
  IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'protocolo_escrituras' AND relnamespace = 'public'::regnamespace) THEN
    SELECT relrowsecurity INTO has_rls
    FROM pg_class
    WHERE relname = 'protocolo_escrituras' AND relnamespace = 'public'::regnamespace;
    
    IF NOT has_rls THEN
      RAISE EXCEPTION 'RLS is disabled on table protocolo_escrituras';
    END IF;
  END IF;

  -- 2. No política Storage vulnerable con solo auth.uid() IS NOT NULL
  SELECT count(*) INTO vuln_storage
  FROM pg_policies
  WHERE schemaname = 'storage' AND tablename = 'objects'
    AND qual LIKE '%auth.uid() IS NOT NULL%'
    AND qual NOT LIKE '%organization_id%';
    
  IF vuln_storage > 0 THEN
    RAISE EXCEPTION 'Vulnerable storage policy with auth.uid() IS NOT NULL found!';
  END IF;

  -- 3. No USING (true) o WITH CHECK (true) genéricos en tablas auditadas
  SELECT count(*) INTO vuln_using
  FROM pg_policies
  WHERE schemaname = 'public'
    AND (qual = 'true' OR with_check = 'true' OR qual = '(true)' OR with_check = '(true)');

  IF vuln_using > 0 THEN
    RAISE EXCEPTION 'Permissive USING (true) or WITH CHECK (true) found in policies!';
  END IF;

  RAISE NOTICE '¡Invariantes verificadas con éxito!';
END $$;
