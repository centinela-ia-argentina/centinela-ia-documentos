-- Anulus AI - Etapa 1 de seguridad por roles y organizacion.
-- Ejecutar una vez en Supabase SQL Editor despues de desplegar el codigo.

begin;

create or replace function public.current_user_is_active()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid() and status = 'active'
  );
$$;

create or replace function public.protect_profile_security_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() = 'service_role' then
    return new;
  end if;

  if new.organization_id is distinct from old.organization_id then
    raise exception 'organization_id no puede modificarse';
  end if;

  if new.role is distinct from old.role then
    if old.id = auth.uid() then
      raise exception 'Un usuario no puede modificar su propio rol';
    end if;

    if not public.is_org_admin() then
      raise exception 'Solo un administrador puede modificar roles';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists protect_profile_security_fields on public.profiles;
create trigger protect_profile_security_fields
before update on public.profiles
for each row execute function public.protect_profile_security_fields();

drop policy if exists "profiles_select_own_org" on public.profiles;
drop policy if exists "profiles_update_self_or_admin" on public.profiles;
drop policy if exists "profiles_select_by_role" on public.profiles;
drop policy if exists "profiles_update_self_or_admin_guarded" on public.profiles;
create policy "profiles_select_by_role"
on public.profiles for select to authenticated
using (
  public.current_user_is_active()
  and organization_id = public.current_user_organization_id()
  and (public.current_user_role() <> 'client' or id = auth.uid())
);
create policy "profiles_update_self_or_admin_guarded"
on public.profiles for update to authenticated
using (
  public.current_user_is_active()
  and organization_id = public.current_user_organization_id()
  and (id = auth.uid() or public.is_org_admin())
)
with check (
  organization_id = public.current_user_organization_id()
  and (id = auth.uid() or public.is_org_admin())
);

drop policy if exists "cases_select_own_org" on public.cases;
drop policy if exists "cases_insert_own_org" on public.cases;
drop policy if exists "cases_update_own_org" on public.cases;
drop policy if exists "cases_select_by_role" on public.cases;
drop policy if exists "cases_insert_operator" on public.cases;
drop policy if exists "cases_update_operator" on public.cases;
create policy "cases_select_by_role"
on public.cases for select to authenticated
using (
  public.current_user_is_active()
  and organization_id = public.current_user_organization_id()
  and (public.current_user_role() <> 'client' or assigned_to = auth.uid())
);
create policy "cases_insert_operator"
on public.cases for insert to authenticated
with check (
  public.current_user_is_active()
  and organization_id = public.current_user_organization_id()
  and public.current_user_role() in ('admin', 'employee')
);
create policy "cases_update_operator"
on public.cases for update to authenticated
using (
  public.current_user_is_active()
  and organization_id = public.current_user_organization_id()
  and public.current_user_role() in ('admin', 'employee')
)
with check (
  organization_id = public.current_user_organization_id()
  and public.current_user_role() in ('admin', 'employee')
);

drop policy if exists "documents_select_own_org" on public.documents;
drop policy if exists "documents_insert_own_org" on public.documents;
drop policy if exists "documents_update_own_org" on public.documents;
drop policy if exists "documents_select_by_role" on public.documents;
drop policy if exists "documents_insert_operator" on public.documents;
drop policy if exists "documents_update_operator" on public.documents;
create policy "documents_select_by_role"
on public.documents for select to authenticated
using (
  public.current_user_is_active()
  and organization_id = public.current_user_organization_id()
  and (
    public.current_user_role() <> 'client'
    or uploaded_by = auth.uid()
    or exists (
      select 1 from public.cases c
      where c.id = documents.case_id
        and c.organization_id = public.current_user_organization_id()
        and c.assigned_to = auth.uid()
    )
  )
);
create policy "documents_insert_operator"
on public.documents for insert to authenticated
with check (
  public.current_user_is_active()
  and organization_id = public.current_user_organization_id()
  and public.current_user_role() in ('admin', 'employee')
);
create policy "documents_update_operator"
on public.documents for update to authenticated
using (
  public.current_user_is_active()
  and organization_id = public.current_user_organization_id()
  and public.current_user_role() in ('admin', 'employee')
)
with check (
  organization_id = public.current_user_organization_id()
  and public.current_user_role() in ('admin', 'employee')
);

drop policy if exists "ai_outputs_select_own_org" on public.ai_outputs;
drop policy if exists "ai_outputs_insert_own_org" on public.ai_outputs;
drop policy if exists "ai_outputs_select_by_role" on public.ai_outputs;
drop policy if exists "ai_outputs_insert_operator" on public.ai_outputs;
create policy "ai_outputs_select_by_role"
on public.ai_outputs for select to authenticated
using (
  public.current_user_is_active()
  and organization_id = public.current_user_organization_id()
  and (
    public.current_user_role() <> 'client'
    or exists (
      select 1 from public.documents d
      where d.id = ai_outputs.document_id
    )
  )
);
create policy "ai_outputs_insert_operator"
on public.ai_outputs for insert to authenticated
with check (
  public.current_user_is_active()
  and organization_id = public.current_user_organization_id()
  and public.current_user_role() in ('admin', 'employee')
);

drop policy if exists "audit_logs_select_own_org" on public.audit_logs;
drop policy if exists "audit_logs_insert_own_org" on public.audit_logs;
drop policy if exists "audit_logs_select_auditors" on public.audit_logs;
drop policy if exists "audit_logs_insert_own_identity" on public.audit_logs;
create policy "audit_logs_select_auditors"
on public.audit_logs for select to authenticated
using (
  public.current_user_is_active()
  and organization_id = public.current_user_organization_id()
  and public.current_user_role() in ('admin', 'auditor')
);
create policy "audit_logs_insert_own_identity"
on public.audit_logs for insert to authenticated
with check (
  public.current_user_is_active()
  and organization_id = public.current_user_organization_id()
  and user_id = auth.uid()
);

drop policy if exists "reports_select_own_org" on public.reports;
drop policy if exists "reports_insert_own_org" on public.reports;
drop policy if exists "reports_select_by_role" on public.reports;
drop policy if exists "reports_insert_operator" on public.reports;
create policy "reports_select_by_role"
on public.reports for select to authenticated
using (
  public.current_user_is_active()
  and organization_id = public.current_user_organization_id()
  and public.current_user_role() in ('admin', 'employee', 'auditor')
);
create policy "reports_insert_operator"
on public.reports for insert to authenticated
with check (
  public.current_user_is_active()
  and organization_id = public.current_user_organization_id()
  and public.current_user_role() in ('admin', 'employee')
);

drop policy if exists "checklists_select_own_org" on public.checklists;
drop policy if exists "checklists_insert_own_org" on public.checklists;
drop policy if exists "checklists_update_own_org" on public.checklists;
drop policy if exists "checklists_select_by_role" on public.checklists;
drop policy if exists "checklists_insert_operator" on public.checklists;
drop policy if exists "checklists_update_operator" on public.checklists;
create policy "checklists_select_by_role"
on public.checklists for select to authenticated
using (
  public.current_user_is_active()
  and organization_id = public.current_user_organization_id()
  and (
    public.current_user_role() <> 'client'
    or exists (
      select 1 from public.cases c
      where c.id = checklists.case_id and c.assigned_to = auth.uid()
    )
  )
);
create policy "checklists_insert_operator"
on public.checklists for insert to authenticated
with check (
  public.current_user_is_active()
  and organization_id = public.current_user_organization_id()
  and public.current_user_role() in ('admin', 'employee')
);
create policy "checklists_update_operator"
on public.checklists for update to authenticated
using (
  public.current_user_is_active()
  and organization_id = public.current_user_organization_id()
  and public.current_user_role() in ('admin', 'employee')
)
with check (
  organization_id = public.current_user_organization_id()
  and public.current_user_role() in ('admin', 'employee')
);

drop policy if exists "checklist_items_select_own_org" on public.checklist_items;
drop policy if exists "checklist_items_insert_own_org" on public.checklist_items;
drop policy if exists "checklist_items_update_own_org" on public.checklist_items;
drop policy if exists "checklist_items_select_by_role" on public.checklist_items;
drop policy if exists "checklist_items_insert_operator" on public.checklist_items;
drop policy if exists "checklist_items_update_operator" on public.checklist_items;
create policy "checklist_items_select_by_role"
on public.checklist_items for select to authenticated
using (
  public.current_user_is_active()
  and exists (
    select 1 from public.checklists c
    where c.id = checklist_items.checklist_id
  )
);
create policy "checklist_items_insert_operator"
on public.checklist_items for insert to authenticated
with check (
  public.current_user_is_active()
  and public.current_user_role() in ('admin', 'employee')
  and exists (
    select 1 from public.checklists c
    where c.id = checklist_items.checklist_id
  )
);
create policy "checklist_items_update_operator"
on public.checklist_items for update to authenticated
using (
  public.current_user_is_active()
  and public.current_user_role() in ('admin', 'employee')
  and exists (
    select 1 from public.checklists c
    where c.id = checklist_items.checklist_id
  )
)
with check (
  public.current_user_role() in ('admin', 'employee')
  and exists (
    select 1 from public.checklists c
    where c.id = checklist_items.checklist_id
  )
);

alter table public.user_invitations enable row level security;
do $$
declare
  existing_policy record;
begin
  for existing_policy in
    select policyname
    from pg_policies
    where schemaname = 'public' and tablename = 'user_invitations'
  loop
    execute format(
      'drop policy if exists %I on public.user_invitations',
      existing_policy.policyname
    );
  end loop;
end;
$$;
create policy "user_invitations_select_admin_own_org"
on public.user_invitations for select to authenticated
using (
  public.current_user_is_active()
  and public.is_org_admin()
  and organization_id = public.current_user_organization_id()
);
create policy "user_invitations_insert_admin_own_org"
on public.user_invitations for insert to authenticated
with check (
  public.current_user_is_active()
  and public.is_org_admin()
  and organization_id = public.current_user_organization_id()
  and invited_by = auth.uid()
);
create policy "user_invitations_update_admin_own_org"
on public.user_invitations for update to authenticated
using (
  public.current_user_is_active()
  and public.is_org_admin()
  and organization_id = public.current_user_organization_id()
)
with check (
  public.is_org_admin()
  and organization_id = public.current_user_organization_id()
);
create policy "user_invitations_delete_admin_own_org"
on public.user_invitations for delete to authenticated
using (
  public.current_user_is_active()
  and public.is_org_admin()
  and organization_id = public.current_user_organization_id()
);

-- Las vistas de invitaciones deben respetar el RLS del usuario que consulta.
do $$
begin
  if exists (
    select 1 from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'invitation_operational_metrics'
      and c.relkind = 'v'
  ) then
    execute 'alter view public.invitation_operational_metrics set (security_invoker = true)';
  end if;

  if exists (
    select 1 from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'invitation_operational_report'
      and c.relkind = 'v'
  ) then
    execute 'alter view public.invitation_operational_report set (security_invoker = true)';
  end if;
end;
$$;

drop policy if exists "documents_storage_select_own_org" on storage.objects;
drop policy if exists "documents_storage_insert_own_org" on storage.objects;
drop policy if exists "documents_storage_update_own_org" on storage.objects;
drop policy if exists "documents_storage_delete_admin_own_org" on storage.objects;
drop policy if exists "documents_storage_select_by_role" on storage.objects;
drop policy if exists "documents_storage_insert_operator" on storage.objects;
drop policy if exists "documents_storage_update_operator" on storage.objects;
create policy "documents_storage_select_by_role"
on storage.objects for select to authenticated
using (
  bucket_id = 'documents'
  and public.current_user_is_active()
  and split_part(name, '/', 1)::uuid = public.current_user_organization_id()
  and (
    public.current_user_role() <> 'client'
    or exists (
      select 1 from public.documents d
      where d.file_path = name
    )
  )
);
create policy "documents_storage_insert_operator"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'documents'
  and public.current_user_is_active()
  and split_part(name, '/', 1)::uuid = public.current_user_organization_id()
  and public.current_user_role() in ('admin', 'employee')
);
create policy "documents_storage_update_operator"
on storage.objects for update to authenticated
using (
  bucket_id = 'documents'
  and public.current_user_is_active()
  and split_part(name, '/', 1)::uuid = public.current_user_organization_id()
  and public.current_user_role() in ('admin', 'employee')
)
with check (
  bucket_id = 'documents'
  and split_part(name, '/', 1)::uuid = public.current_user_organization_id()
  and public.current_user_role() in ('admin', 'employee')
);
create policy "documents_storage_delete_admin_own_org"
on storage.objects for delete to authenticated
using (
  bucket_id = 'documents'
  and public.current_user_is_active()
  and split_part(name, '/', 1)::uuid = public.current_user_organization_id()
  and public.is_org_admin()
);

commit;
