BEGIN;

DROP POLICY IF EXISTS "cases_delete_policy" ON public.cases;

CREATE POLICY "cases_delete_policy"
ON public.cases
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.status = 'active'
      AND p.role = 'admin'
      AND p.organization_id = cases.organization_id
  )
);

COMMIT;
