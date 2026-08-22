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

ALTER TABLE public.properties DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.rental_contracts DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.rent_index_values DISABLE ROW LEVEL SECURITY;

commit;
