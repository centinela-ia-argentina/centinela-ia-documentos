BEGIN;

-- 1. Normalizar grants de public.checklist_items
-- Revocar todos los privilegios a anon (por seguridad)
REVOKE ALL PRIVILEGES ON TABLE public.checklist_items FROM anon;

-- Revocar privilegios excesivos a authenticated
REVOKE TRUNCATE, REFERENCES, TRIGGER ON TABLE public.checklist_items FROM authenticated;

-- Asegurar los permisos DML correctos para authenticated
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.checklist_items TO authenticated;

-- 2. Crear la politica de DELETE
DROP POLICY IF EXISTS "checklist_items_delete_operator" ON public.checklist_items;

CREATE POLICY "checklist_items_delete_operator"
  ON public.checklist_items
  FOR DELETE
  TO authenticated
  USING (
    public.current_user_is_active()
    AND public.current_user_role() IN ('admin', 'employee')
    AND organization_id = public.current_user_organization_id()
    AND EXISTS (
      SELECT 1
      FROM public.checklists c
      WHERE c.id = checklist_items.checklist_id
        AND c.organization_id = public.current_user_organization_id()
    )
  );

COMMENT ON POLICY "checklist_items_delete_operator" ON public.checklist_items IS 'added_by_checklist_delete_rls_repair';

NOTIFY pgrst, 'reload schema';

COMMIT;
