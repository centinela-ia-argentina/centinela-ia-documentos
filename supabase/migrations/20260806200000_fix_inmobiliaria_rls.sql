begin;

-- 1. Actualizar funciones de contexto para bloquear perfiles inactivos
create or replace function public.current_user_organization_id()
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select organization_id from public.profiles where id = auth.uid() and status = 'active' limit 1;
$$;

create or replace function public.current_user_role()
returns text
language sql
security definer
set search_path = public
stable
as $$
  select role from public.profiles where id = auth.uid() and status = 'active' limit 1;
$$;

-- 2. Eliminar explícitamente las políticas genéricas
drop policy if exists "properties_select" on public.properties;
drop policy if exists "properties_insert" on public.properties;
drop policy if exists "properties_update" on public.properties;
drop policy if exists "properties_delete" on public.properties;

drop policy if exists "clients_select" on public.clients;
drop policy if exists "clients_insert" on public.clients;
drop policy if exists "clients_update" on public.clients;
drop policy if exists "clients_delete" on public.clients;

drop policy if exists "rental_select" on public.rental_contracts;
drop policy if exists "rental_insert" on public.rental_contracts;
drop policy if exists "rental_update" on public.rental_contracts;
drop policy if exists "rental_delete" on public.rental_contracts;

drop policy if exists "rent_index_select" on public.rent_index_values;
drop policy if exists "rent_index_insert" on public.rent_index_values;
drop policy if exists "rent_index_update" on public.rent_index_values;
drop policy if exists "rent_index_delete" on public.rent_index_values;

-- 3. Crear políticas granulares por rol

-- PROPERTIES
create policy "properties_select_role" on public.properties for select to authenticated
using (
  organization_id = public.current_user_organization_id()
  and public.current_user_role() in ('admin', 'employee', 'auditor')
);

create policy "properties_insert_role" on public.properties for insert to authenticated
with check (
  organization_id = public.current_user_organization_id()
  and public.current_user_role() in ('admin', 'employee')
);

create policy "properties_update_role" on public.properties for update to authenticated
using (
  organization_id = public.current_user_organization_id()
  and public.current_user_role() in ('admin', 'employee')
)
with check (
  organization_id = public.current_user_organization_id()
  and public.current_user_role() in ('admin', 'employee')
);

create policy "properties_delete_role" on public.properties for delete to authenticated
using (
  organization_id = public.current_user_organization_id()
  and public.current_user_role() in ('admin', 'employee')
);

-- CLIENTS
create policy "clients_select_role" on public.clients for select to authenticated
using (
  organization_id = public.current_user_organization_id()
  and public.current_user_role() in ('admin', 'employee', 'auditor')
);

create policy "clients_insert_role" on public.clients for insert to authenticated
with check (
  organization_id = public.current_user_organization_id()
  and public.current_user_role() in ('admin', 'employee')
);

create policy "clients_update_role" on public.clients for update to authenticated
using (
  organization_id = public.current_user_organization_id()
  and public.current_user_role() in ('admin', 'employee')
)
with check (
  organization_id = public.current_user_organization_id()
  and public.current_user_role() in ('admin', 'employee')
);

create policy "clients_delete_role" on public.clients for delete to authenticated
using (
  organization_id = public.current_user_organization_id()
  and public.current_user_role() in ('admin', 'employee')
);

-- RENTAL_CONTRACTS
create policy "rental_contracts_select_role" on public.rental_contracts for select to authenticated
using (
  organization_id = public.current_user_organization_id()
  and public.current_user_role() in ('admin', 'employee', 'auditor')
);

create policy "rental_contracts_insert_role" on public.rental_contracts for insert to authenticated
with check (
  organization_id = public.current_user_organization_id()
  and public.current_user_role() in ('admin', 'employee')
);

create policy "rental_contracts_update_role" on public.rental_contracts for update to authenticated
using (
  organization_id = public.current_user_organization_id()
  and public.current_user_role() in ('admin', 'employee')
)
with check (
  organization_id = public.current_user_organization_id()
  and public.current_user_role() in ('admin', 'employee')
);

create policy "rental_contracts_delete_role" on public.rental_contracts for delete to authenticated
using (
  organization_id = public.current_user_organization_id()
  and public.current_user_role() in ('admin', 'employee')
);

-- RENT_INDEX_VALUES
create policy "rent_index_values_select_role" on public.rent_index_values for select to authenticated
using (
  organization_id = public.current_user_organization_id()
  and public.current_user_role() in ('admin', 'employee', 'auditor')
);

create policy "rent_index_values_insert_role" on public.rent_index_values for insert to authenticated
with check (
  organization_id = public.current_user_organization_id()
  and public.current_user_role() in ('admin', 'employee')
);

create policy "rent_index_values_update_role" on public.rent_index_values for update to authenticated
using (
  organization_id = public.current_user_organization_id()
  and public.current_user_role() in ('admin', 'employee')
)
with check (
  organization_id = public.current_user_organization_id()
  and public.current_user_role() in ('admin', 'employee')
);

create policy "rent_index_values_delete_role" on public.rent_index_values for delete to authenticated
using (
  organization_id = public.current_user_organization_id()
  and public.current_user_role() in ('admin', 'employee')
);

commit;
