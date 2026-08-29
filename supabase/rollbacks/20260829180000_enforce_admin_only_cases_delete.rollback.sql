-- EMERGENCY ROLLBACK
-- DO NOT RUN IN PRODUCTION WITHOUT EXPLICIT SECURITY APPROVAL.
-- This rollback restores the previous policy where active employees could delete cases.

BEGIN;

DROP POLICY IF EXISTS "cases_delete_policy" ON public.cases;

CREATE POLICY "cases_delete_policy" ON public.cases FOR DELETE USING (
    EXISTS (
        SELECT 1
        FROM public.profiles p
        WHERE p.id = auth.uid()
          AND p.status = 'active'
          AND p.role IN ('admin', 'employee')
          AND p.organization_id = cases.organization_id
    )
);

COMMIT;
