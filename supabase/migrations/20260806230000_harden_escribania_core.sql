-- 20260806230000_harden_escribania_core.sql
begin;

-- 1. ESTRUCTURAS NOTARIALES (IaC)
create table if not exists public.protocolo_escrituras (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  numero integer not null,
  anio integer not null,
  fecha_otorgamiento date,
  tipo_acto text,
  comparecientes text,
  objeto text,
  folio_desde text,
  folio_hasta text,
  observaciones text,
  case_id uuid references public.cases(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

do $$ 
declare
  v_exists boolean;
begin
  select exists (
    select 1
    from pg_constraint c
    join pg_namespace n on n.oid = c.connamespace
    join pg_class t on t.oid = c.conrelid
    where n.nspname = 'public' 
      and t.relname = 'protocolo_escrituras'
      and c.contype = 'u'
      and array(
        select attname from pg_attribute 
        where attrelid = c.conrelid and attnum = any(c.conkey)
      ) @> array['organization_id'::name, 'anio'::name, 'numero'::name]
      and array['organization_id'::name, 'anio'::name, 'numero'::name] @> array(
        select attname from pg_attribute 
        where attrelid = c.conrelid and attnum = any(c.conkey)
      )
  ) into v_exists;

  if not v_exists then
    alter table public.protocolo_escrituras add constraint protocolo_escrituras_organization_id_anio_numero_key unique (organization_id, anio, numero);
  end if;
end $$;

create table if not exists public.case_derivations (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  from_organization_id uuid not null references public.organizations(id) on delete cascade,
  from_organization_name text,
  case_title text,
  mensaje text,
  to_email text not null,
  to_organization_id uuid references public.organizations(id) on delete set null,
  status text not null default 'pendiente' check (status in ('pendiente', 'aceptada', 'rechazada', 'revocada')),
  created_by uuid references auth.users(id) on delete set null,
  accepted_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists case_derivations_activa_unica on public.case_derivations (case_id, lower(to_email)) where status in ('pendiente', 'aceptada');

create table if not exists public.derivation_notes (
  id uuid primary key default gen_random_uuid(),
  derivation_id uuid not null references public.case_derivations(id) on delete cascade,
  case_id uuid not null references public.cases(id) on delete cascade,
  author_organization_id uuid not null references public.organizations(id) on delete cascade,
  author_user_id uuid references auth.users(id) on delete set null,
  author_name text,
  author_org_name text,
  body text not null,
  created_at timestamptz not null default now()
);

-- Asegurar RLS en todas
alter table public.protocolo_escrituras enable row level security;
alter table public.case_derivations enable row level security;
alter table public.derivation_notes enable row level security;
alter table public.document_chunks enable row level security;

-- 2. LIMPIEZA DE PRIVILEGIOS
revoke all on public.protocolo_escrituras from public, anon, authenticated;
revoke all on public.case_derivations from public, anon, authenticated;
revoke all on public.derivation_notes from public, anon, authenticated;
revoke all on public.document_chunks from public, anon, authenticated;

grant select, insert, update, delete on public.protocolo_escrituras to authenticated;
grant select, insert, update, delete on public.case_derivations to authenticated;
grant select, insert, update, delete on public.derivation_notes to authenticated;
grant select, insert, update, delete on public.document_chunks to authenticated;

-- 3. FUNCIONES DE CONTEXTO Y VALIDACIÓN
create or replace function public.current_user_is_active()
returns boolean
language sql security definer set search_path = public stable
as $$
  select exists(select 1 from public.profiles where id = auth.uid() and status = 'active');
$$;

create or replace function public.can_read_derived_case(target_case_id uuid)
returns boolean
language sql security definer set search_path = public stable
as $$
  select exists(
    select 1 from public.case_derivations d
    where d.case_id = target_case_id
      and d.status = 'aceptada'
      and d.to_organization_id = (select organization_id from public.profiles where id = auth.uid() and status = 'active' limit 1)
      and (select role from public.profiles where id = auth.uid() and status = 'active' limit 1) in ('admin', 'employee', 'auditor')
  );
$$;

create or replace function public.can_contribute_derived_case(target_case_id uuid)
returns boolean
language sql security definer set search_path = public stable
as $$
  select exists(
    select 1 from public.case_derivations d
    where d.case_id = target_case_id
      and d.status = 'aceptada'
      and d.to_organization_id = (select organization_id from public.profiles where id = auth.uid() and status = 'active' limit 1)
      and (select role from public.profiles where id = auth.uid() and status = 'active' limit 1) in ('admin', 'employee')
  );
$$;

create or replace function public.is_valid_derived_storage_path(p_path text)
returns boolean
language sql security definer set search_path = public stable
as $$
  select
    array_length(string_to_array(p_path, '/'), 1) = 4
    and (string_to_array(p_path, '/'))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    and (string_to_array(p_path, '/'))[2] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    and (string_to_array(p_path, '/'))[3] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
$$;

-- INMUTABILIDAD CASE_DERIVATIONS
create or replace function public.prevent_derivations_mutation()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_org_id uuid;
  v_role text;
  v_is_active boolean;
  v_is_origin boolean;
  v_is_dest boolean;
  v_user_email text;
begin
  select 
    (status = 'active'), organization_id, role, email 
  into 
    v_is_active, v_org_id, v_role, v_user_email
  from public.profiles where id = auth.uid() limit 1;

  if not coalesce(v_is_active, false) then
    raise exception 'Perfil inactivo';
  end if;

  if old.id is distinct from new.id then raise exception 'Cannot modify id'; end if;
  if old.case_id is distinct from new.case_id then raise exception 'Cannot modify case_id'; end if;
  if old.from_organization_id is distinct from new.from_organization_id then raise exception 'Cannot modify from_organization_id'; end if;
  if old.created_by is distinct from new.created_by then raise exception 'Cannot modify created_by'; end if;
  if old.created_at is distinct from new.created_at then raise exception 'Cannot modify created_at'; end if;
  if old.to_email is distinct from new.to_email then raise exception 'Cannot modify to_email'; end if;

  v_is_origin := (old.from_organization_id = v_org_id);
  v_is_dest := (old.to_organization_id = v_org_id or lower(old.to_email) = lower(v_user_email));

  if v_is_dest and v_role in ('admin', 'employee') then
    if old.status = 'pendiente' and new.status = 'aceptada' then
      if new.to_organization_id is distinct from v_org_id then raise exception 'Invalid to_organization_id'; end if;
      if new.accepted_by is distinct from auth.uid() then raise exception 'Invalid accepted_by'; end if;
      return new;
    end if;
    if old.status = 'pendiente' and new.status = 'rechazada' then
      if new.accepted_by is distinct from auth.uid() then raise exception 'Invalid accepted_by'; end if;
      if new.to_organization_id is distinct from old.to_organization_id then raise exception 'Cannot modify to_organization_id'; end if;
      return new;
    end if;
  end if;

  if v_is_origin and v_role in ('admin', 'employee') then
    if old.status in ('pendiente', 'aceptada') and new.status = 'revocada' then
      if new.to_organization_id is distinct from old.to_organization_id then raise exception 'Cannot modify to_organization_id'; end if;
      if new.accepted_by is distinct from old.accepted_by then raise exception 'Cannot modify accepted_by'; end if;
      return new;
    end if;
  end if;

  if old.status = new.status then
    if old.to_organization_id is distinct from new.to_organization_id then raise exception 'Cannot modify to_organization_id without status change'; end if;
    if old.accepted_by is distinct from new.accepted_by then raise exception 'Cannot modify accepted_by without status change'; end if;
    return new;
  end if;

  raise exception 'Invalid transition or unauthorized';
end;
$$;

drop trigger if exists enforce_derivations_mutation on public.case_derivations;
create trigger enforce_derivations_mutation
before update on public.case_derivations
for each row execute function public.prevent_derivations_mutation();


-- 4. RLS DE CASE_DERIVATIONS
drop policy if exists "derivaciones destino select" on public.case_derivations;
drop policy if exists "derivaciones destino update" on public.case_derivations;
drop policy if exists "derivaciones origen insert" on public.case_derivations;
drop policy if exists "derivaciones origen select" on public.case_derivations;
drop policy if exists "derivaciones origen update" on public.case_derivations;
drop policy if exists "derivations_select_origin" on public.case_derivations;
drop policy if exists "derivations_insert_origin" on public.case_derivations;
drop policy if exists "derivations_update_origin" on public.case_derivations;
drop policy if exists "derivations_select_dest" on public.case_derivations;
drop policy if exists "derivations_update_dest" on public.case_derivations;

create policy "derivations_select_origin" on public.case_derivations for select to authenticated
using (public.current_user_is_active() and from_organization_id = public.current_user_organization_id() and public.current_user_role() in ('admin', 'employee', 'auditor'));

create policy "derivations_insert_origin" on public.case_derivations for insert to authenticated
with check (
  public.current_user_is_active() 
  and public.current_user_role() in ('admin', 'employee')
  and from_organization_id = public.current_user_organization_id()
  and created_by = auth.uid()
  and status = 'pendiente'
  and to_organization_id is null
  and accepted_by is null
  and exists (
    select 1
    from public.cases c
    where c.id = case_derivations.case_id
      and c.organization_id = public.current_user_organization_id()
  )
);

create policy "derivations_update_origin" on public.case_derivations for update to authenticated
using (public.current_user_is_active() and from_organization_id = public.current_user_organization_id() and public.current_user_role() in ('admin', 'employee'))
with check (
  from_organization_id = public.current_user_organization_id()
);

create policy "derivations_select_dest" on public.case_derivations for select to authenticated
using (
  public.current_user_is_active()
  and public.current_user_role() in ('admin', 'employee', 'auditor')
  and (to_organization_id = public.current_user_organization_id() or lower(to_email) = lower((select email from auth.users where id = auth.uid() limit 1)))
);

create policy "derivations_update_dest" on public.case_derivations for update to authenticated
using (
  public.current_user_is_active()
  and public.current_user_role() in ('admin', 'employee')
  and (to_organization_id = public.current_user_organization_id() or lower(to_email) = lower((select email from auth.users where id = auth.uid() limit 1)))
)
with check (
  (to_organization_id = public.current_user_organization_id() or lower(to_email) = lower((select email from auth.users where id = auth.uid() limit 1)))
);

-- 5. RLS DE DERIVATION_NOTES
drop policy if exists "notes_select_legacy" on public.derivation_notes;
drop policy if exists "notes_insert_legacy" on public.derivation_notes;
drop policy if exists "notes_update_legacy" on public.derivation_notes;
drop policy if exists "derivation_notes_insert_dest" on public.derivation_notes;
drop policy if exists "derivation_notes_select_dest" on public.derivation_notes;
drop policy if exists "derivation_notes_select_origin" on public.derivation_notes;
drop policy if exists "derivation_notes_select" on public.derivation_notes;
drop policy if exists "derivation_notes_insert" on public.derivation_notes;

create policy "derivation_notes_select" on public.derivation_notes for select to authenticated
using (
  public.current_user_is_active() and public.current_user_role() in ('admin', 'employee', 'auditor') and
  (
    (author_organization_id = public.current_user_organization_id())
    or public.can_read_derived_case(case_id)
    or exists (select 1 from public.case_derivations d where d.id = derivation_id and d.from_organization_id = public.current_user_organization_id())
  )
);

create policy "derivation_notes_insert" on public.derivation_notes for insert to authenticated
with check (
  public.current_user_is_active() and public.current_user_role() in ('admin', 'employee') and
  author_organization_id = public.current_user_organization_id() and
  author_user_id = auth.uid() and
  exists (select 1 from public.case_derivations d where d.id = derivation_id and d.case_id = derivation_notes.case_id) and
  (
    exists (select 1 from public.case_derivations d where d.id = derivation_id and d.from_organization_id = public.current_user_organization_id())
    or public.can_contribute_derived_case(case_id)
  )
);

-- 6. CASOS Y DOCUMENTOS DERIVADOS
drop policy if exists "cases_select_derived" on public.cases;
drop policy if exists "documents_select_derived" on public.documents;
drop policy if exists "documents_insert_derived" on public.documents;
drop policy if exists "cases_select_derived_role" on public.cases;
drop policy if exists "documents_select_derived_role" on public.documents;
drop policy if exists "documents_insert_derived_role" on public.documents;

create policy "cases_select_derived_role" on public.cases for select to authenticated
using (
  public.can_read_derived_case(id)
);

create policy "documents_select_derived_role" on public.documents for select to authenticated
using (
  public.can_read_derived_case(case_id)
);

create policy "documents_insert_derived_role" on public.documents for insert to authenticated
with check (
  public.can_contribute_derived_case(case_id)
  and organization_id = (select organization_id from public.cases c where c.id = case_id limit 1)
  and contributed_by_organization_id = public.current_user_organization_id()
  and uploaded_by = auth.uid()
);

-- 7. STORAGE DERIVADO
drop policy if exists "documents_storage_insert_derived" on storage.objects;
drop policy if exists "documents_storage_select_derived" on storage.objects;
drop policy if exists "documents_storage_select_derived_role" on storage.objects;
drop policy if exists "documents_storage_insert_derived_role" on storage.objects;

create policy "documents_storage_select_derived_role" on storage.objects for select to authenticated
using (
  bucket_id = 'documents'
  and public.is_valid_derived_storage_path(name)
  and public.can_read_derived_case((string_to_array(name, '/'))[2]::uuid)
);

create policy "documents_storage_insert_derived_role" on storage.objects for insert to authenticated
with check (
  bucket_id = 'documents'
  and public.is_valid_derived_storage_path(name)
  and (string_to_array(name, '/'))[1]::uuid = (select organization_id from public.cases c where c.id = (string_to_array(name, '/'))[2]::uuid limit 1)
  and public.can_contribute_derived_case((string_to_array(name, '/'))[2]::uuid)
);

-- 8. DOCUMENTS DELETE
drop policy if exists "documents_delete_own_org" on public.documents;
drop policy if exists "documents_delete_admin" on public.documents;

create policy "documents_delete_admin" on public.documents for delete to authenticated
using (
  public.current_user_is_active()
  and organization_id = public.current_user_organization_id()
  and public.current_user_role() = 'admin'
);

-- 9. DOCUMENT_CHUNKS Y RAG
drop policy if exists "document_chunks_select_org" on public.document_chunks;
drop policy if exists "document_chunks_insert_org" on public.document_chunks;
drop policy if exists "document_chunks_delete_org" on public.document_chunks;
drop policy if exists "document_chunks_delete_own_org" on public.document_chunks;
drop policy if exists "document_chunks_select_role" on public.document_chunks;
drop policy if exists "document_chunks_insert_role" on public.document_chunks;
drop policy if exists "document_chunks_delete_role" on public.document_chunks;

create policy "document_chunks_select_role" on public.document_chunks for select to authenticated
using (
  public.current_user_is_active() 
  and organization_id = public.current_user_organization_id()
  and public.current_user_role() in ('admin', 'employee', 'auditor')
);

create policy "document_chunks_insert_role" on public.document_chunks for insert to authenticated
with check (
  public.current_user_is_active() 
  and organization_id = public.current_user_organization_id()
  and public.current_user_role() in ('admin', 'employee')
);

create policy "document_chunks_delete_role" on public.document_chunks for delete to authenticated
using (
  public.current_user_is_active() 
  and organization_id = public.current_user_organization_id()
  and public.current_user_role() in ('admin', 'employee')
);

-- DROP de la firma bigint incorrecta y cualquier otra que exista
drop function if exists public.match_document_chunks(vector, uuid, integer);
drop function if exists public.match_document_chunks(vector, uuid, bigint);

create or replace function public.match_document_chunks(
  query_embedding vector(768),
  match_org uuid,
  match_count integer default 10
) returns table (
  id uuid,
  document_id uuid,
  content text,
  similarity float
)
language plpgsql security invoker set search_path = public
as $$
begin
  if not public.current_user_is_active() then return; end if;
  if public.current_user_role() not in ('admin', 'employee', 'auditor') then return; end if;
  if public.current_user_organization_id() != match_org then return; end if;
  if match_count > 100 then match_count := 100; end if;
  if query_embedding is null then return; end if;

  return query
  select
    dc.id,
    dc.document_id,
    dc.content,
    1 - (dc.embedding <=> query_embedding) as similarity
  from public.document_chunks dc
  where dc.organization_id = match_org
  order by dc.embedding <=> query_embedding
  limit match_count;
end;
$$;

revoke execute on function public.match_document_chunks(vector, uuid, integer) from public, anon, authenticated;
grant execute on function public.match_document_chunks(vector, uuid, integer) to authenticated;

-- 10. PROTOCOLO RLS
drop policy if exists "protocolo_org_select" on public.protocolo_escrituras;
drop policy if exists "protocolo_org_insert" on public.protocolo_escrituras;
drop policy if exists "protocolo_org_update" on public.protocolo_escrituras;
drop policy if exists "protocolo_org_delete" on public.protocolo_escrituras;
drop policy if exists "protocolo_select_role" on public.protocolo_escrituras;
drop policy if exists "protocolo_insert_role" on public.protocolo_escrituras;
drop policy if exists "protocolo_update_role" on public.protocolo_escrituras;
drop policy if exists "protocolo_delete_admin" on public.protocolo_escrituras;

create policy "protocolo_select_role" on public.protocolo_escrituras for select to authenticated
using (public.current_user_is_active() and organization_id = public.current_user_organization_id() and public.current_user_role() in ('admin', 'employee', 'auditor'));

create policy "protocolo_insert_role" on public.protocolo_escrituras for insert to authenticated
with check (public.current_user_is_active() and organization_id = public.current_user_organization_id() and public.current_user_role() in ('admin', 'employee'));

create policy "protocolo_update_role" on public.protocolo_escrituras for update to authenticated
using (public.current_user_is_active() and organization_id = public.current_user_organization_id() and public.current_user_role() in ('admin', 'employee'))
with check (organization_id = public.current_user_organization_id());

create policy "protocolo_delete_admin" on public.protocolo_escrituras for delete to authenticated
using (public.current_user_is_active() and organization_id = public.current_user_organization_id() and public.current_user_role() = 'admin');

-- 11. NUMERACIÓN ATÓMICA
drop function if exists public.registrar_escritura_atomica;
create or replace function public.registrar_escritura_atomica(
  p_anio integer,
  p_fecha date,
  p_tipo_acto text,
  p_comparecientes text,
  p_objeto text,
  p_folio_desde text,
  p_folio_hasta text,
  p_observaciones text,
  p_case_id uuid
) returns integer
language plpgsql security definer set search_path = public
as $$
declare
  v_org_id uuid;
  v_role text;
  v_numero integer;
  v_case_org uuid;
begin
  if not public.current_user_is_active() then
    raise exception 'Perfil inactivo';
  end if;

  v_org_id := public.current_user_organization_id();
  v_role := public.current_user_role();

  if v_role not in ('admin', 'employee') then
    raise exception 'Sin permisos para registrar escrituras';
  end if;

  if p_fecha is null then
    raise exception 'Fecha requerida';
  end if;

  if extract(year from p_fecha) != p_anio then
    raise exception 'Incoherencia entre p_anio y el año de p_fecha';
  end if;

  if p_case_id is not null then
    select organization_id into v_case_org from public.cases where id = p_case_id;
    if v_case_org != v_org_id then
      raise exception 'Case_id no pertenece a la organización';
    end if;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_org_id::text || ':' || p_anio::text, 0));

  select coalesce(max(numero), 0) + 1 into v_numero
  from public.protocolo_escrituras
  where organization_id = v_org_id and anio = p_anio;

  insert into public.protocolo_escrituras (
    organization_id, numero, anio, fecha_otorgamiento,
    tipo_acto, comparecientes, objeto, folio_desde, folio_hasta,
    observaciones, case_id, created_by
  ) values (
    v_org_id, v_numero, p_anio, p_fecha,
    p_tipo_acto, p_comparecientes, p_objeto, p_folio_desde, p_folio_hasta,
    p_observaciones, p_case_id, auth.uid()
  );

  return v_numero;
end;
$$;

revoke execute on function public.registrar_escritura_atomica from public, anon, authenticated;
grant execute on function public.registrar_escritura_atomica to authenticated;

commit;
