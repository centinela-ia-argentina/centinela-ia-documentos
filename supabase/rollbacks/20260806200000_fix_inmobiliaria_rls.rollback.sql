-- EMERGENCY ROLLBACK
-- Advertencia: Esto reabre la brecha de roles para tablas maestras inmobiliarias.

begin;

-- 1. Restaurar funciones de contexto sin validación de status active
CREATE OR REPLACE FUNCTION public.current_user_organization_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT organization_id FROM public.profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$;

-- 2. Eliminar políticas granulares por rol
drop policy if exists "properties_select_role" on public.properties;
drop policy if exists "properties_insert_role" on public.properties;
drop policy if exists "properties_update_role" on public.properties;
drop policy if exists "properties_delete_role" on public.properties;

drop policy if exists "clients_select_role" on public.clients;
drop policy if exists "clients_insert_role" on public.clients;
drop policy if exists "clients_update_role" on public.clients;
drop policy if exists "clients_delete_role" on public.clients;

drop policy if exists "rental_contracts_select_role" on public.rental_contracts;
drop policy if exists "rental_contracts_insert_role" on public.rental_contracts;
drop policy if exists "rental_contracts_update_role" on public.rental_contracts;
drop policy if exists "rental_contracts_delete_role" on public.rental_contracts;

drop policy if exists "rent_index_values_select_role" on public.rent_index_values;
drop policy if exists "rent_index_values_insert_role" on public.rent_index_values;
drop policy if exists "rent_index_values_update_role" on public.rent_index_values;
drop policy if exists "rent_index_values_delete_role" on public.rent_index_values;

-- 3. Restaurar las 16 políticas genéricas previas
-- 3. Restaurar las 16 políticas genéricas previas
DROP POLICY IF EXISTS "properties_select" ON public.properties;
DROP POLICY IF EXISTS "properties_insert" ON public.properties;
DROP POLICY IF EXISTS "properties_update" ON public.properties;
DROP POLICY IF EXISTS "properties_delete" ON public.properties;

DROP POLICY IF EXISTS "clients_select" ON public.clients;
DROP POLICY IF EXISTS "clients_insert" ON public.clients;
DROP POLICY IF EXISTS "clients_update" ON public.clients;
DROP POLICY IF EXISTS "clients_delete" ON public.clients;

DROP POLICY IF EXISTS "rental_select" ON public.rental_contracts;
DROP POLICY IF EXISTS "rental_insert" ON public.rental_contracts;
DROP POLICY IF EXISTS "rental_update" ON public.rental_contracts;
DROP POLICY IF EXISTS "rental_delete" ON public.rental_contracts;

DROP POLICY IF EXISTS "rent_index_select" ON public.rent_index_values;
DROP POLICY IF EXISTS "rent_index_insert" ON public.rent_index_values;
DROP POLICY IF EXISTS "rent_index_update" ON public.rent_index_values;
DROP POLICY IF EXISTS "rent_index_delete" ON public.rent_index_values;

-- En lugar de deshabilitar RLS, recreamos políticas amplias seguras (aislamiento org)
CREATE POLICY "properties_select" ON public.properties FOR SELECT USING (organization_id = public.current_user_organization_id());
CREATE POLICY "properties_insert" ON public.properties FOR INSERT WITH CHECK (organization_id = public.current_user_organization_id());
CREATE POLICY "properties_update" ON public.properties FOR UPDATE USING (organization_id = public.current_user_organization_id()) WITH CHECK (organization_id = public.current_user_organization_id());
CREATE POLICY "properties_delete" ON public.properties FOR DELETE USING (organization_id = public.current_user_organization_id());

CREATE POLICY "clients_select" ON public.clients FOR SELECT USING (organization_id = public.current_user_organization_id());
CREATE POLICY "clients_insert" ON public.clients FOR INSERT WITH CHECK (organization_id = public.current_user_organization_id());
CREATE POLICY "clients_update" ON public.clients FOR UPDATE USING (organization_id = public.current_user_organization_id()) WITH CHECK (organization_id = public.current_user_organization_id());
CREATE POLICY "clients_delete" ON public.clients FOR DELETE USING (organization_id = public.current_user_organization_id());

CREATE POLICY "rental_select" ON public.rental_contracts FOR SELECT USING (organization_id = public.current_user_organization_id());
CREATE POLICY "rental_insert" ON public.rental_contracts FOR INSERT WITH CHECK (organization_id = public.current_user_organization_id());
CREATE POLICY "rental_update" ON public.rental_contracts FOR UPDATE USING (organization_id = public.current_user_organization_id()) WITH CHECK (organization_id = public.current_user_organization_id());
CREATE POLICY "rental_delete" ON public.rental_contracts FOR DELETE USING (organization_id = public.current_user_organization_id());

CREATE POLICY "rent_index_select" ON public.rent_index_values FOR SELECT USING (organization_id = public.current_user_organization_id());
CREATE POLICY "rent_index_insert" ON public.rent_index_values FOR INSERT WITH CHECK (organization_id = public.current_user_organization_id());
CREATE POLICY "rent_index_update" ON public.rent_index_values FOR UPDATE USING (organization_id = public.current_user_organization_id()) WITH CHECK (organization_id = public.current_user_organization_id());
CREATE POLICY "rent_index_delete" ON public.rent_index_values FOR DELETE USING (organization_id = public.current_user_organization_id());

commit;
