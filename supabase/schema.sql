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
