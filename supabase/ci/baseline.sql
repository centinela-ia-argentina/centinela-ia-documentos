-- Centinela IA Documentos V1 — SQL base MVP
create extension if not exists pgcrypto;

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  industry text,
  industry_type text not null default 'general' check (industry_type in ('general', 'legal', 'escribania', 'gestoria', 'inmobiliaria', 'empresa', 'contable', 'drogueria', 'farma', 'industria', 'compliance', 'seguridad_documental')),
  city text,
  province text,
  plan text not null default 'starter',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  full_name text not null,
  email text not null,
  role text not null default 'employee' check (role in ('admin', 'employee', 'client', 'auditor')),
  status text not null default 'active' check (status in ('active', 'inactive', 'invited')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_login_at timestamptz
);

create table if not exists public.cases (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  title text not null,
  client_name text,
  case_type text default 'general',
  status text not null default 'Activo' check (status in ('Activo', 'En trámite', 'Con observaciones', 'Archivado', 'new', 'in_review', 'incomplete', 'waiting_client', 'complete', 'completed', 'archived')),
  metadata jsonb not null default '{}'::jsonb,
  assigned_to uuid references public.profiles(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  case_id uuid references public.cases(id) on delete set null,
  file_name text not null,
  file_path text not null,
  file_mime_type text,
  file_size bigint,
  document_type text,
  sensitivity_level text not null default 'medium' check (sensitivity_level in ('low', 'medium', 'high', 'critical')),
  uploaded_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ai_outputs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  case_id uuid references public.cases(id) on delete cascade,
  document_id uuid references public.documents(id) on delete cascade,
  output_type text not null check (output_type in ('summary', 'classification', 'checklist_analysis', 'assistant_answer', 'risk_note')),
  content jsonb not null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.checklists (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  case_id uuid not null references public.cases(id) on delete cascade,
  name text not null,
  template_type text default 'general',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.checklist_items (
  id uuid primary key default gen_random_uuid(),
  checklist_id uuid not null references public.checklists(id) on delete cascade,
  title text not null,
  status text not null default 'pending' check (status in ('pending', 'received', 'reviewed', 'rejected', 'not_required')),
  document_id uuid references public.documents(id) on delete set null,
  notes text,
  due_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete set null,
  action text not null,
  resource_type text,
  resource_id uuid,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  case_id uuid references public.cases(id) on delete set null,
  report_type text not null,
  title text not null,
  content jsonb,
  pdf_path text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.checklist_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  template_type text not null,
  items jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_profiles_organization_id on public.profiles(organization_id);
create index if not exists idx_cases_organization_id on public.cases(organization_id);
create index if not exists idx_documents_organization_id on public.documents(organization_id);
create index if not exists idx_documents_case_id on public.documents(case_id);
create index if not exists idx_audit_logs_organization_id on public.audit_logs(organization_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

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

create or replace function public.is_org_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin' and status = 'active'
  );
$$;

create or replace function public.create_organization_with_admin(
  org_name text,
  org_industry text,
  org_city text,
  org_province text,
  admin_full_name text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_org_id uuid;
  user_email text;
begin
  if auth.uid() is null then
    raise exception 'Usuario no autenticado';
  end if;

  if exists (select 1 from public.profiles where id = auth.uid()) then
    raise exception 'El usuario ya tiene una organización asociada';
  end if;

  user_email := coalesce(auth.jwt() ->> 'email', 'sin-email');

  insert into public.organizations (name, industry, city, province)
  values (org_name, org_industry, org_city, org_province)
  returning id into new_org_id;

  insert into public.profiles (id, organization_id, full_name, email, role, status)
  values (auth.uid(), new_org_id, admin_full_name, user_email, 'admin', 'active');

  insert into public.audit_logs (organization_id, user_id, action, resource_type, resource_id, metadata)
  values (new_org_id, auth.uid(), 'organization_created', 'organization', new_org_id, jsonb_build_object('source', 'onboarding'));

  return new_org_id;
end;
$$;

grant execute on function public.create_organization_with_admin(text, text, text, text, text) to authenticated;

alter table public.organizations enable row level security;
alter table public.profiles enable row level security;
alter table public.cases enable row level security;
alter table public.documents enable row level security;
alter table public.ai_outputs enable row level security;
alter table public.checklists enable row level security;
alter table public.checklist_items enable row level security;
alter table public.audit_logs enable row level security;
alter table public.reports enable row level security;
alter table public.checklist_templates enable row level security;

create policy "organizations_select_own" on public.organizations for select to authenticated using (id = public.current_user_organization_id());
create policy "organizations_update_admin_own" on public.organizations for update to authenticated using (id = public.current_user_organization_id() and public.is_org_admin()) with check (id = public.current_user_organization_id() and public.is_org_admin());

create policy "profiles_select_own_org" on public.profiles for select to authenticated using (organization_id = public.current_user_organization_id());
create policy "profiles_update_self_or_admin" on public.profiles for update to authenticated using (organization_id = public.current_user_organization_id() and (id = auth.uid() or public.is_org_admin())) with check (organization_id = public.current_user_organization_id() and (id = auth.uid() or public.is_org_admin()));

create policy "cases_select_own_org" on public.cases for select to authenticated using (organization_id = public.current_user_organization_id());
create policy "cases_insert_own_org" on public.cases for insert to authenticated with check (organization_id = public.current_user_organization_id());
create policy "cases_update_own_org" on public.cases for update to authenticated using (organization_id = public.current_user_organization_id()) with check (organization_id = public.current_user_organization_id());

create policy "documents_select_own_org" on public.documents for select to authenticated using (organization_id = public.current_user_organization_id());
create policy "documents_insert_own_org" on public.documents for insert to authenticated with check (organization_id = public.current_user_organization_id());
create policy "documents_update_own_org" on public.documents for update to authenticated using (organization_id = public.current_user_organization_id()) with check (organization_id = public.current_user_organization_id());

create policy "ai_outputs_select_own_org" on public.ai_outputs for select to authenticated using (organization_id = public.current_user_organization_id());
create policy "ai_outputs_insert_own_org" on public.ai_outputs for insert to authenticated with check (organization_id = public.current_user_organization_id());

create policy "audit_logs_select_own_org" on public.audit_logs for select to authenticated using (organization_id = public.current_user_organization_id());
create policy "audit_logs_insert_own_org" on public.audit_logs for insert to authenticated with check (organization_id = public.current_user_organization_id());

create policy "reports_select_own_org" on public.reports for select to authenticated using (organization_id = public.current_user_organization_id());
create policy "reports_insert_own_org" on public.reports for insert to authenticated with check (organization_id = public.current_user_organization_id());

create policy "checklists_select_own_org" on public.checklists for select to authenticated using (organization_id = public.current_user_organization_id());
create policy "checklists_insert_own_org" on public.checklists for insert to authenticated with check (organization_id = public.current_user_organization_id());
create policy "checklists_update_own_org" on public.checklists for update to authenticated using (organization_id = public.current_user_organization_id()) with check (organization_id = public.current_user_organization_id());

create policy "checklist_items_select_own_org" on public.checklist_items for select to authenticated using (exists (select 1 from public.checklists c where c.id = checklist_items.checklist_id and c.organization_id = public.current_user_organization_id()));
create policy "checklist_items_insert_own_org" on public.checklist_items for insert to authenticated with check (exists (select 1 from public.checklists c where c.id = checklist_items.checklist_id and c.organization_id = public.current_user_organization_id()));
create policy "checklist_items_update_own_org" on public.checklist_items for update to authenticated using (exists (select 1 from public.checklists c where c.id = checklist_items.checklist_id and c.organization_id = public.current_user_organization_id())) with check (exists (select 1 from public.checklists c where c.id = checklist_items.checklist_id and c.organization_id = public.current_user_organization_id()));

create policy "checklist_templates_select_authenticated" on public.checklist_templates for select to authenticated using (true);

insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
on conflict (id) do nothing;

insert into public.checklist_templates (name, template_type, items)
values (
  'Compraventa de inmueble - base',
  'real_estate_purchase',
  '["DNI comprador", "DNI vendedor", "Constancia CUIT/CUIL", "Título de propiedad", "Libre deuda", "Boleto de compraventa", "Comprobantes", "Autorizaciones"]'::jsonb
)
on conflict do nothing;

alter table public.properties enable row level security;
alter table public.clients enable row level security;
alter table public.rental_contracts enable row level security;
alter table public.rent_index_values enable row level security;

create policy "properties_select_role" on public.properties for select to authenticated using (organization_id = public.current_user_organization_id() and public.current_user_role() in ('admin', 'employee', 'auditor'));
create policy "properties_insert_role" on public.properties for insert to authenticated with check (organization_id = public.current_user_organization_id() and public.current_user_role() in ('admin', 'employee'));
create policy "properties_update_role" on public.properties for update to authenticated using (organization_id = public.current_user_organization_id() and public.current_user_role() in ('admin', 'employee')) with check (organization_id = public.current_user_organization_id() and public.current_user_role() in ('admin', 'employee'));
create policy "properties_delete_role" on public.properties for delete to authenticated using (organization_id = public.current_user_organization_id() and public.current_user_role() in ('admin', 'employee'));

create policy "clients_select_role" on public.clients for select to authenticated using (organization_id = public.current_user_organization_id() and public.current_user_role() in ('admin', 'employee', 'auditor'));
create policy "clients_insert_role" on public.clients for insert to authenticated with check (organization_id = public.current_user_organization_id() and public.current_user_role() in ('admin', 'employee'));
create policy "clients_update_role" on public.clients for update to authenticated using (organization_id = public.current_user_organization_id() and public.current_user_role() in ('admin', 'employee')) with check (organization_id = public.current_user_organization_id() and public.current_user_role() in ('admin', 'employee'));
create policy "clients_delete_role" on public.clients for delete to authenticated using (organization_id = public.current_user_organization_id() and public.current_user_role() in ('admin', 'employee'));

create policy "rental_contracts_select_role" on public.rental_contracts for select to authenticated using (organization_id = public.current_user_organization_id() and public.current_user_role() in ('admin', 'employee', 'auditor'));
create policy "rental_contracts_insert_role" on public.rental_contracts for insert to authenticated with check (organization_id = public.current_user_organization_id() and public.current_user_role() in ('admin', 'employee'));
create policy "rental_contracts_update_role" on public.rental_contracts for update to authenticated using (organization_id = public.current_user_organization_id() and public.current_user_role() in ('admin', 'employee')) with check (organization_id = public.current_user_organization_id() and public.current_user_role() in ('admin', 'employee'));
create policy "rental_contracts_delete_role" on public.rental_contracts for delete to authenticated using (organization_id = public.current_user_organization_id() and public.current_user_role() in ('admin', 'employee'));

create policy "rent_index_values_select_role" on public.rent_index_values for select to authenticated using (organization_id = public.current_user_organization_id() and public.current_user_role() in ('admin', 'employee', 'auditor'));
create policy "rent_index_values_insert_role" on public.rent_index_values for insert to authenticated with check (organization_id = public.current_user_organization_id() and public.current_user_role() in ('admin', 'employee'));
create policy "rent_index_values_update_role" on public.rent_index_values for update to authenticated using (organization_id = public.current_user_organization_id() and public.current_user_role() in ('admin', 'employee')) with check (organization_id = public.current_user_organization_id() and public.current_user_role() in ('admin', 'employee'));
create policy "rent_index_values_delete_role" on public.rent_index_values for delete to authenticated using (organization_id = public.current_user_organization_id() and public.current_user_role() in ('admin', 'employee'));
-- Centinela IA - Fase 0: rubro documental por organizacion.
-- Ejecutar una vez en Supabase SQL Editor.

begin;

alter table public.organizations
  add column if not exists industry_type text not null default 'general';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'organizations_industry_type_check'
      and conrelid = 'public.organizations'::regclass
  ) then
    alter table public.organizations
      add constraint organizations_industry_type_check
      check (
        industry_type in (
          'general',
          'legal',
          'escribania',
          'gestoria',
          'inmobiliaria',
          'empresa',
          'contable',
          'drogueria',
          'farma',
          'industria',
          'compliance',
          'seguridad_documental'
        )
      );
  end if;
end $$;

-- Deja una organizacion de prueba en rubro legal si encuentra una demo/legal.
-- Si no encuentra ninguna, no modifica datos.
with legal_pilot as (
  select id
  from public.organizations
  where lower(name) like '%demo%'
     or lower(name) like '%legal%'
     or lower(name) like '%jurid%'
  order by created_at asc
  limit 1
)
update public.organizations
set industry_type = 'legal'
where id in (select id from legal_pilot);

commit;
-- Centinela IA - Fase 1 B.1: estados value/label de expedientes.
-- Ejecutar una vez en Supabase SQL Editor.

-- Paso 0: diagnostico antes de normalizar.
select distinct status
from public.cases
order by status;

begin;

alter table public.cases
  alter column status set default 'active';

-- Normalizacion de datos que pudieron guardarse como labels visibles.
update public.cases
set status = 'active'
where status = 'Activo';

update public.cases
set status = 'archived'
where status = 'Archivado';

update public.cases
set status = 'in_review'
where status in ('En tramite', 'En trámite')
   or status like 'En tr%mite';

commit;

-- Verificacion posterior: deberian quedar codigos, no labels.
select distinct status
from public.cases
order by status;
-- Centinela IA - Fase 1 C: refuerzo RLS para checklist_items.
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
-- Centinela IA - Fase 1: campos y estados del expediente por rubro.
-- Ejecutar una vez en Supabase SQL Editor.

begin;

alter table public.cases
  add column if not exists metadata jsonb not null default '{}'::jsonb;

update public.cases
set metadata = '{}'::jsonb
where metadata is null;

alter table public.cases
  alter column metadata set default '{}'::jsonb,
  alter column metadata set not null;

alter table public.cases
  alter column status set default 'Activo';

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'cases_status_check'
      and conrelid = 'public.cases'::regclass
  ) then
    alter table public.cases drop constraint cases_status_check;
  end if;
end $$;

alter table public.cases
  add constraint cases_status_check
  check (
    status in (
      'Activo',
      'En trámite',
      'Con observaciones',
      'Archivado',
      'new',
      'in_review',
      'incomplete',
      'waiting_client',
      'complete',
      'completed',
      'archived'
    )
  );

commit;
-- Migration: case_events table
-- Description: Creates the case_events table for timeline tracking

CREATE TABLE IF NOT EXISTS public.case_events (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  case_id uuid NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  event_date date NOT NULL,
  event_type text NOT NULL,
  title text NOT NULL,
  description text,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_case_events_case_id ON public.case_events(case_id);
CREATE INDEX IF NOT EXISTS idx_case_events_organization_id ON public.case_events(organization_id);
CREATE INDEX IF NOT EXISTS idx_case_events_event_date ON public.case_events(event_date);

ALTER TABLE public.case_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view case events in their organization"
  ON public.case_events
  FOR SELECT
  USING (
    organization_id = (SELECT organization_id FROM public.profiles WHERE profiles.id = auth.uid())
    AND EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.status = 'active')
  );

CREATE POLICY "Users can insert case events in their organization"
  ON public.case_events
  FOR INSERT
  WITH CHECK (
    organization_id = (SELECT organization_id FROM public.profiles WHERE profiles.id = auth.uid())
    AND EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.status = 'active' AND profiles.role IN ('admin', 'employee', 'auditor'))
  );

CREATE POLICY "Users can update case events in their organization"
  ON public.case_events
  FOR UPDATE
  USING (
    organization_id = (SELECT organization_id FROM public.profiles WHERE profiles.id = auth.uid())
    AND EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.status = 'active' AND profiles.role IN ('admin', 'employee', 'auditor'))
  );

CREATE POLICY "Users can delete case events in their organization"
  ON public.case_events
  FOR DELETE
  USING (
    organization_id = (SELECT organization_id FROM public.profiles WHERE profiles.id = auth.uid())
    AND EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.status = 'active' AND profiles.role IN ('admin', 'employee', 'auditor'))
  );
-- Centinela IA - Etapa 2: dueno de plataforma y alta aislada de clientes.
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
-- Centinela IA - Solo platform_owner puede crear nuevos Administradores.
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
-- Centinela IA - Etapa 1 de seguridad por roles y organizacion.
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
-- Centinela IA — Storage policies para bucket privado documents
-- Ejecutar después de schema.sql.
-- Ruta esperada: organization_id/case_id/document_id/file_name

create policy "documents_storage_select_own_org"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'documents'
  and split_part(name, '/', 1)::uuid = public.current_user_organization_id()
);

create policy "documents_storage_insert_own_org"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'documents'
  and split_part(name, '/', 1)::uuid = public.current_user_organization_id()
);

create policy "documents_storage_update_own_org"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'documents'
  and split_part(name, '/', 1)::uuid = public.current_user_organization_id()
)
with check (
  bucket_id = 'documents'
  and split_part(name, '/', 1)::uuid = public.current_user_organization_id()
);

create policy "documents_storage_delete_admin_own_org"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'documents'
  and split_part(name, '/', 1)::uuid = public.current_user_organization_id()
  and public.is_org_admin()
);
