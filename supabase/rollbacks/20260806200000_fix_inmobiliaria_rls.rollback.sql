-- EMERGENCY ROLLBACK
-- Advertencia: Esto reabre la brecha de roles para tablas maestras inmobiliarias.

begin;

-- 1. Restaurar funciones de contexto sin validación de status active
create or replace function public.current_user_organization_id()
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select organization_id from public.profiles where id = auth.uid() limit 1;
$$;

create or replace function public.current_user_role()
returns text
language sql
security definer
set search_path = public
stable
as $$
  select role from public.profiles where id = auth.uid() limit 1;
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
create policy "properties_select" on public.properties for select to public using (organization_id = public.current_user_organization_id());
create policy "properties_insert" on public.properties for insert to public with check (organization_id = public.current_user_organization_id());
create policy "properties_update" on public.properties for update to public using (organization_id = public.current_user_organization_id()) with check (organization_id = public.current_user_organization_id());
create policy "properties_delete" on public.properties for delete to public using (organization_id = public.current_user_organization_id());

create policy "clients_select" on public.clients for select to public using (organization_id = public.current_user_organization_id());
create policy "clients_insert" on public.clients for insert to public with check (organization_id = public.current_user_organization_id());
create policy "clients_update" on public.clients for update to public using (organization_id = public.current_user_organization_id()) with check (organization_id = public.current_user_organization_id());
create policy "clients_delete" on public.clients for delete to public using (organization_id = public.current_user_organization_id());

create policy "rental_select" on public.rental_contracts for select to public using (organization_id = public.current_user_organization_id());
create policy "rental_insert" on public.rental_contracts for insert to public with check (organization_id = public.current_user_organization_id());
create policy "rental_update" on public.rental_contracts for update to public using (organization_id = public.current_user_organization_id()) with check (organization_id = public.current_user_organization_id());
create policy "rental_delete" on public.rental_contracts for delete to public using (organization_id = public.current_user_organization_id());

create policy "rent_index_select" on public.rent_index_values for select to public using (organization_id = public.current_user_organization_id());
create policy "rent_index_insert" on public.rent_index_values for insert to public with check (organization_id = public.current_user_organization_id());
create policy "rent_index_update" on public.rent_index_values for update to public using (organization_id = public.current_user_organization_id()) with check (organization_id = public.current_user_organization_id());
create policy "rent_index_delete" on public.rent_index_values for delete to public using (organization_id = public.current_user_organization_id());

commit;
