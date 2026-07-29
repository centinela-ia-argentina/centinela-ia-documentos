-- A3. TABLA DE CLAVES PUBLICAS
create table public.ledger_signing_key (
  key_id      text primary key,
  algo        text not null default 'ed25519' check (algo = 'ed25519'),
  public_pem  text not null check (public_pem like '-----BEGIN PUBLIC KEY-----%'),
  active_from timestamptz not null default now(),
  revoked_at  timestamptz,
  check (revoked_at is null or revoked_at >= active_from)
);

-- A2. TABLA DE PUNTOS DE CONTROL
-- Nota: La continuidad de secuencias (seq_from igual a seq_to anterior + 1)
-- se valida en checkpoint_append (A6), no mediante restriccion de tabla.
create table public.ledger_checkpoint (
  id            bigserial primary key,
  org_id        uuid not null,
  seq_from      bigint not null check (seq_from >= 1),
  seq_to        bigint not null,
  canon_version smallint not null check (canon_version >= 1),
  head_hash     bytea not null check (octet_length(head_hash) = 32),
  algo          text not null default 'ed25519' check (algo = 'ed25519'),
  key_id        text not null,
  signature     bytea not null check (octet_length(signature) = 64),
  signed_at     timestamptz not null,
  created_at    timestamptz not null default now(),
  unique (org_id, seq_to),
  check (seq_to >= seq_from),
  foreign key (org_id, seq_to) references public.security_ledger (org_id, seq) on delete restrict on update restrict,
  foreign key (key_id) references public.ledger_signing_key (key_id) on delete restrict on update restrict
);

create index idx_checkpoint_org on public.ledger_checkpoint (org_id, seq_to desc);


-- A4. INMUTABILIDAD DE LAS DOS TABLAS NUEVAS

-- Revocar permisos directos
revoke all on public.ledger_checkpoint, public.ledger_signing_key from public, anon, authenticated, service_role;

-- Habilitar RLS (sin politicas permisivas)
alter table public.ledger_checkpoint enable row level security;
alter table public.ledger_signing_key enable row level security;

-- Inmutabilidad para ledger_checkpoint (falla en UPDATE, DELETE, TRUNCATE)
create or replace function public.abort_ledger_checkpoint_mutation()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
begin
  raise exception 'ledger_checkpoint es inmutable: no se admiten mutaciones (%)', TG_OP;
  return null;
end;
$$;

revoke execute on function public.abort_ledger_checkpoint_mutation() from public, anon, authenticated;

create trigger trg_abort_ledger_checkpoint_mutation_stmt
  before update or delete or truncate
  on public.ledger_checkpoint
  for each statement
  execute function public.abort_ledger_checkpoint_mutation();

alter table public.ledger_checkpoint enable always trigger trg_abort_ledger_checkpoint_mutation_stmt;


-- Inmutabilidad parcial para ledger_signing_key (falla en TRUNCATE, DELETE, y en UPDATE restringe a revoked_at)
create or replace function public.restrict_ledger_signing_key_mutation()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
begin
  if TG_OP = 'TRUNCATE' then
    raise exception 'TRUNCATE of ledger_signing_key is strictly prohibited';
  end if;

  if TG_OP = 'DELETE' then
    raise exception 'ledger_signing_key: operacion no permitida (DELETE)';
  end if;

  if TG_OP = 'UPDATE' then
    if OLD.revoked_at is not null then
      raise exception 'ledger_signing_key: no se puede alterar una clave ya revocada';
    end if;
    if NEW.key_id is distinct from OLD.key_id or
       NEW.algo is distinct from OLD.algo or
       NEW.public_pem is distinct from OLD.public_pem or
       NEW.active_from is distinct from OLD.active_from then
      raise exception 'ledger_signing_key: solo se admite modificar la columna revoked_at';
    end if;
    return NEW;
  end if;
  
  return null;
end;
$$;

revoke execute on function public.restrict_ledger_signing_key_mutation() from public, anon, authenticated;

-- Disparador para UPDATE y DELETE (nivel fila)
create trigger trg_restrict_ledger_signing_key_mutation_row
  before update or delete
  on public.ledger_signing_key
  for each row
  execute function public.restrict_ledger_signing_key_mutation();

alter table public.ledger_signing_key enable always trigger trg_restrict_ledger_signing_key_mutation_row;

-- Disparador para TRUNCATE (nivel sentencia)
create trigger trg_restrict_ledger_signing_key_mutation_stmt
  before truncate
  on public.ledger_signing_key
  for each statement
  execute function public.restrict_ledger_signing_key_mutation();

alter table public.ledger_signing_key enable always trigger trg_restrict_ledger_signing_key_mutation_stmt;


-- Agregado 1: VIA DE ESCRITURA PARA ledger_signing_key
create or replace function public.signing_key_register(
  p_key_id text,
  p_algo text,
  p_public_pem text
) returns void
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
begin
  insert into public.ledger_signing_key (key_id, algo, public_pem)
  values (p_key_id, p_algo, p_public_pem);
end;
$$;


-- A6. PARTE 1.1: VIA DE ESCRITURA PARA ledger_checkpoint
create or replace function public.checkpoint_append(
  p_org_id uuid,
  p_seq_from bigint,
  p_seq_to bigint,
  p_canon_version smallint,
  p_head_hash bytea,
  p_algo text,
  p_key_id text,
  p_signature bytea,
  p_signed_at timestamptz
) returns bigint
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_lock_id bigint;
  v_last_seq_to bigint;
  v_expected_seq_from bigint;
  v_actual_count bigint;
  v_new_id bigint;
begin
  -- a) Bloqueo consultivo por organizacion
  v_lock_id := hashtextextended(p_org_id::text, 0);
  perform pg_advisory_xact_lock(v_lock_id);

  -- b) Verifica que p_key_id exista en ledger_signing_key y su revoked_at sea null
  if not exists (
    select 1 from public.ledger_signing_key 
    where key_id = p_key_id and revoked_at is null
  ) then
    raise exception 'Clave publica % no existe o esta revocada', p_key_id;
  end if;

  -- c) Verifica que exista fila en security_ledger con (org_id, seq) = (p_org_id, p_seq_to), canon_version = 2 y entry_hash = p_head_hash
  if not exists (
    select 1 from public.security_ledger
    where org_id = p_org_id 
      and seq = p_seq_to 
      and canon_version = 2 
      and entry_hash = p_head_hash
  ) then
    raise exception 'No coincide head_hash o no existe entry en security_ledger (org: %, seq: %)', p_org_id, p_seq_to;
  end if;

  -- d) CONTINUIDAD
  select max(seq_to) into v_last_seq_to
  from public.ledger_checkpoint
  where org_id = p_org_id;

  if v_last_seq_to is null then
    -- Si no existe ninguno, p_seq_from debe ser exactamente el menor seq de security_ledger con canon_version = 2
    select min(seq) into v_expected_seq_from
    from public.security_ledger
    where org_id = p_org_id and canon_version = 2;

    if v_expected_seq_from is null then
       raise exception 'No hay filas en security_ledger con canon_version = 2 para la organizacion %', p_org_id;
    end if;
  else
    v_expected_seq_from := v_last_seq_to + 1;
  end if;

  if p_seq_from <> v_expected_seq_from then
    raise exception 'Falla de continuidad. Esperado seq_from: %, recibido: %', v_expected_seq_from, p_seq_from;
  end if;

  -- e) COBERTURA SIN HUECOS
  select count(*) into v_actual_count
  from public.security_ledger
  where org_id = p_org_id 
    and seq between p_seq_from and p_seq_to 
    and canon_version = 2;

  if v_actual_count <> (p_seq_to - p_seq_from + 1) then
    raise exception 'Huecos en security_ledger en el rango % - % (esperado %, recibido %)', p_seq_from, p_seq_to, (p_seq_to - p_seq_from + 1), v_actual_count;
  end if;

  -- f) Inserta la fila
  insert into public.ledger_checkpoint (
    org_id, seq_from, seq_to, canon_version, head_hash, algo, key_id, signature, signed_at
  ) values (
    p_org_id, p_seq_from, p_seq_to, p_canon_version, p_head_hash, p_algo, p_key_id, p_signature, p_signed_at
  ) returning id into v_new_id;

  return v_new_id;
end;
$$;

-- A6. PARTE 1.2: PERMISOS
revoke all on function public.checkpoint_append(uuid, bigint, bigint, smallint, bytea, text, text, bytea, timestamptz) from public, anon, authenticated;
revoke all on function public.signing_key_register(text, text, text) from public, anon, authenticated;
grant execute on function public.checkpoint_append(uuid, bigint, bigint, smallint, bytea, text, text, bytea, timestamptz) to service_role;
grant execute on function public.signing_key_register(text, text, text) to service_role;
