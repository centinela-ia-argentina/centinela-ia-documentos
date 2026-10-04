-- Anulus AI - Etapa 2: dueno de plataforma y alta aislada de clientes.
-- Ejecutar una vez en Supabase SQL Editor despues de desplegar el codigo.

begin;

create table if not exists public.platform_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.platform_admins enable row level security;
revoke all on table public.platform_admins from anon, authenticated;
grant select, insert, update, delete on table public.platform_admins to service_role;

do $$
declare
  owner_user_id uuid;
begin
  select id into owner_user_id
  from auth.users
  where lower(email) = 'tobiasexequielperez11@gmail.com'
  limit 1;

  if owner_user_id is null then
    raise exception 'No existe un usuario autenticado con el email del dueno de plataforma';
  end if;

  insert into public.platform_admins (user_id, email, active, updated_at)
  values (owner_user_id, 'tobiasexequielperez11@gmail.com', true, now())
  on conflict (user_id) do update
    set email = excluded.email,
        active = true,
        updated_at = now();
end;
$$;

create or replace function public.platform_create_organization_with_admin_invitation(
  organization_name text,
  administrator_email text,
  platform_owner_id uuid,
  invitation_token_value uuid,
  invitation_expires_at timestamptz
)
returns table (organization_id uuid, invitation_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  new_organization_id uuid;
  new_invitation_id uuid;
  normalized_email text;
begin
  if auth.role() <> 'service_role' then
    raise exception 'Operacion exclusiva del servidor';
  end if;

  if not exists (
    select 1
    from public.platform_admins
    where user_id = platform_owner_id and active = true
  ) then
    raise exception 'Dueno de plataforma no autorizado';
  end if;

  normalized_email := lower(trim(administrator_email));

  if nullif(trim(organization_name), '') is null then
    raise exception 'El nombre de la organizacion es obligatorio';
  end if;

  if normalized_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'Email de administrador invalido';
  end if;

  if exists (
    select 1 from public.profiles where lower(email) = normalized_email
  ) then
    raise exception 'El email ya pertenece a un usuario registrado';
  end if;

  if exists (
    select 1
    from public.user_invitations
    where lower(email) = normalized_email
      and status in ('pending', 'accepted')
  ) then
    raise exception 'El email ya tiene una invitacion vigente';
  end if;

  insert into public.organizations (name, plan)
  values (trim(organization_name), 'starter')
  returning id into new_organization_id;

  insert into public.user_invitations (
    organization_id,
    email,
    role,
    status,
    invitation_token,
    invited_by,
    expires_at,
    updated_at
  )
  values (
    new_organization_id,
    normalized_email,
    'admin',
    'pending',
    invitation_token_value,
    platform_owner_id,
    invitation_expires_at,
    now()
  )
  returning id into new_invitation_id;

  insert into public.audit_logs (
    organization_id,
    user_id,
    action,
    resource_type,
    resource_id,
    metadata
  )
  values (
    new_organization_id,
    null,
    'organization_created',
    'organization',
    new_organization_id,
    jsonb_build_object(
      'source', 'platform_owner_panel',
      'platform_owner_id', platform_owner_id,
      'administrator_email', normalized_email,
      'invitation_id', new_invitation_id
    )
  );

  return query select new_organization_id, new_invitation_id;
end;
$$;

revoke all on function public.platform_create_organization_with_admin_invitation(
  text, text, uuid, uuid, timestamptz
) from public, anon, authenticated;
grant execute on function public.platform_create_organization_with_admin_invitation(
  text, text, uuid, uuid, timestamptz
) to service_role;

commit;
