-- supabase/ci/verify_invariants.sql

DO $$
DECLARE
  rec RECORD;
  t_name text;
  has_rls boolean;
  vuln_using integer;
  bad_storage_count integer;
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

  -- 2. Debe fallar si existen las políticas vulnerables antiguas
  SELECT count(*) INTO bad_storage_count
  FROM pg_policies
  WHERE schemaname = 'storage' AND tablename = 'objects'
    AND policyname IN ('storage_select_policy', 'storage_insert_policy', 'storage_delete_policy');
    
  IF bad_storage_count > 0 THEN
    RAISE EXCEPTION 'Vulnerable storage policies still exist!';
  END IF;

  -- 3. No USING (true) o WITH CHECK (true) genéricos
  SELECT count(*) INTO vuln_using
  FROM pg_policies
  WHERE schemaname = 'public'
    AND (qual = 'true' OR with_check = 'true' OR qual = '(true)' OR with_check = '(true)');

  IF vuln_using > 0 THEN
    RAISE EXCEPTION 'Permissive USING (true) or WITH CHECK (true) found in policies!';
  END IF;

  -- 4. Políticas documents_ deben existir
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'documents_select') THEN
    RAISE EXCEPTION 'Missing documents_select';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'documents_insert') THEN
    RAISE EXCEPTION 'Missing documents_insert';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'documents_update') THEN
    RAISE EXCEPTION 'Missing documents_update';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'documents_delete') THEN
    RAISE EXCEPTION 'Missing documents_delete';
  END IF;

  -- 5. Validar reglas de documents_*
  -- INSERT, UPDATE, DELETE no deben permitir auditor ni client
  -- Deben validar organization y active
  FOR rec IN 
    SELECT policyname, roles, cmd, qual, with_check 
    FROM pg_policies 
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname LIKE 'documents_%'
  LOOP
    -- Verificar que no se limite a auth.uid() IS NOT NULL
    IF rec.qual NOT LIKE '%organization_id%' AND (rec.with_check IS NULL OR rec.with_check NOT LIKE '%organization_id%') THEN
      RAISE EXCEPTION 'Policy % does not check organization_id!', rec.policyname;
    END IF;
    
    -- Validar roles (auditor o client) en mutaciones
    IF rec.cmd IN ('INSERT', 'UPDATE', 'DELETE') THEN
      IF rec.qual LIKE '%auditor%' OR (rec.with_check IS NOT NULL AND rec.with_check LIKE '%auditor%') THEN
        RAISE EXCEPTION 'Policy % allows auditor in mutation!', rec.policyname;
      END IF;
      IF rec.qual LIKE '%client%' OR (rec.with_check IS NOT NULL AND rec.with_check LIKE '%client%') THEN
        RAISE EXCEPTION 'Policy % allows client in mutation!', rec.policyname;
      END IF;
    END IF;
    
    -- Validar activo
    IF rec.qual NOT LIKE '%active%' AND (rec.with_check IS NULL OR rec.with_check NOT LIKE '%active%') THEN
      RAISE EXCEPTION 'Policy % does not check active status!', rec.policyname;
    END IF;
  END LOOP;

  RAISE NOTICE '¡Invariantes verificadas con éxito!';
END $$;

