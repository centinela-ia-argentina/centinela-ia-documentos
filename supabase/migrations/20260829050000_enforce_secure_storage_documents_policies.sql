BEGIN;

-- 1. Eliminar políticas vulnerables antiguas (storage_*)
DROP POLICY IF EXISTS "storage_select_policy" ON storage.objects;
DROP POLICY IF EXISTS "storage_insert_policy" ON storage.objects;
DROP POLICY IF EXISTS "storage_delete_policy" ON storage.objects;

-- 2. Eliminar policies target para recreación limpia
DROP POLICY IF EXISTS "documents_select" ON storage.objects;
DROP POLICY IF EXISTS "documents_insert" ON storage.objects;
DROP POLICY IF EXISTS "documents_update" ON storage.objects;
DROP POLICY IF EXISTS "documents_delete" ON storage.objects;

-- 3. Recrear policies canónicas seguras
CREATE POLICY "documents_select" ON storage.objects FOR SELECT TO public USING (
    bucket_id = 'documents'::text 
    AND auth.uid() IS NOT NULL 
    AND split_part(name, '/'::text, 1) = (
        SELECT profiles.organization_id::text AS organization_id
        FROM public.profiles
        WHERE profiles.id = auth.uid() 
        AND profiles.status = 'active'::text 
        AND profiles.role = ANY (ARRAY['admin'::text, 'employee'::text, 'auditor'::text])
    )
);

CREATE POLICY "documents_insert" ON storage.objects FOR INSERT TO public WITH CHECK (
    bucket_id = 'documents'::text 
    AND auth.uid() IS NOT NULL 
    AND split_part(name, '/'::text, 1) = (
        SELECT profiles.organization_id::text AS organization_id
        FROM public.profiles
        WHERE profiles.id = auth.uid() 
        AND profiles.status = 'active'::text 
        AND profiles.role = ANY (ARRAY['admin'::text, 'employee'::text])
    )
);

CREATE POLICY "documents_update" ON storage.objects FOR UPDATE TO public USING (
    bucket_id = 'documents'::text 
    AND auth.uid() IS NOT NULL 
    AND split_part(name, '/'::text, 1) = (
        SELECT profiles.organization_id::text AS organization_id
        FROM public.profiles
        WHERE profiles.id = auth.uid() 
        AND profiles.status = 'active'::text 
        AND profiles.role = ANY (ARRAY['admin'::text, 'employee'::text])
    )
);

CREATE POLICY "documents_delete" ON storage.objects FOR DELETE TO public USING (
    bucket_id = 'documents'::text 
    AND auth.uid() IS NOT NULL 
    AND split_part(name, '/'::text, 1) = (
        SELECT profiles.organization_id::text AS organization_id
        FROM public.profiles
        WHERE profiles.id = auth.uid() 
        AND profiles.status = 'active'::text 
        AND profiles.role = 'admin'::text
    )
);

COMMIT;
