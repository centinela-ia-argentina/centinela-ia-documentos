-- Anulus AI - Fase 1 C: refuerzo RLS para checklist_items.
-- Ejecutar una vez en Supabase SQL Editor si las politicas actuales no verifican
-- organization_id al seleccionar, insertar o actualizar items de checklist.

begin;

drop policy if exists "checklist_items_select_own_org" on public.checklist_items;
drop policy if exists "checklist_items_insert_own_org" on public.checklist_items;
drop policy if exists "checklist_items_update_own_org" on public.checklist_items;
drop policy if exists "checklist_items_select_by_role" on public.checklist_items;
drop policy if exists "checklist_items_insert_operator" on public.checklist_items;
drop policy if exists "checklist_items_update_operator" on public.checklist_items;

create policy "checklist_items_select_by_role"
on public.checklist_items
for select
to authenticated
using (
  public.current_user_is_active()
  and exists (
    select 1
    from public.checklists c
    left join public.cases ca on ca.id = c.case_id
    where c.id = checklist_items.checklist_id
      and c.organization_id = public.current_user_organization_id()
      and (
        public.current_user_role() <> 'client'
        or ca.assigned_to = auth.uid()
      )
  )
);

create policy "checklist_items_insert_operator"
on public.checklist_items
for insert
to authenticated
with check (
  public.current_user_is_active()
  and public.current_user_role() in ('admin', 'employee')
  and exists (
    select 1
    from public.checklists c
    where c.id = checklist_items.checklist_id
      and c.organization_id = public.current_user_organization_id()
  )
);

create policy "checklist_items_update_operator"
on public.checklist_items
for update
to authenticated
using (
  public.current_user_is_active()
  and public.current_user_role() in ('admin', 'employee')
  and exists (
    select 1
    from public.checklists c
    where c.id = checklist_items.checklist_id
      and c.organization_id = public.current_user_organization_id()
  )
)
with check (
  public.current_user_is_active()
  and public.current_user_role() in ('admin', 'employee')
  and exists (
    select 1
    from public.checklists c
    where c.id = checklist_items.checklist_id
      and c.organization_id = public.current_user_organization_id()
  )
);

commit;
