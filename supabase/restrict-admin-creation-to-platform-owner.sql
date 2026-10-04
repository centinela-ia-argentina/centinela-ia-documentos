-- Anulus AI - Solo platform_owner puede crear nuevos Administradores.
-- Ejecutar una vez en Supabase SQL Editor despues de desplegar el codigo.

begin;

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

    if new.role = 'admin' then
      raise exception 'Solo el dueno de plataforma puede crear Administradores';
    end if;
  end if;

  return new;
end;
$$;

drop policy if exists "user_invitations_insert_admin_own_org"
on public.user_invitations;
create policy "user_invitations_insert_admin_own_org"
on public.user_invitations for insert to authenticated
with check (
  public.current_user_is_active()
  and public.is_org_admin()
  and organization_id = public.current_user_organization_id()
  and invited_by = auth.uid()
  and role in ('employee', 'auditor', 'client')
);

drop policy if exists "user_invitations_update_admin_own_org"
on public.user_invitations;
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
  and role in ('employee', 'auditor', 'client')
);

commit;
