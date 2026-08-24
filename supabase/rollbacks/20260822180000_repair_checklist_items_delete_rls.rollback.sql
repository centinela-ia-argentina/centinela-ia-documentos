BEGIN;

-- Eliminar unicamente la politica de delete que fue agregada
DROP POLICY IF EXISTS "checklist_items_delete_operator" ON public.checklist_items;

-- NOTA: El endurecimiento de los grants no se revierte a un estado inseguro.
-- Mantenemos REVOKE de anon y REVOKE de TRUNCATE/REFERENCES/TRIGGER a authenticated,
-- conservando los accesos limitados a SELECT, INSERT, UPDATE, DELETE para authenticated.
-- Las politicas SELECT/INSERT/UPDATE originales no se tocan.

NOTIFY pgrst, 'reload schema';

COMMIT;
