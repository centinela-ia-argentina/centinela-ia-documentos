-- 1. Agregar versionado
alter table security_ledger add column canon_version smallint not null default 1;
alter table security_ledger alter column canon_version set default 2;

-- 2. Helper de strings canónicos
create or replace function canonical_json_string(str text)
returns text
language plpgsql
immutable
set search_path = pg_catalog, public, pg_temp
as $$
declare
  i integer;
  len integer;
  ch text;
  cp integer;
  res text := '"';
begin
  len := char_length(str);
  for i in 1..len loop
    ch := substring(str from i for 1);
    cp := ascii(ch);
    if cp = 34 then
      res := res || '\"';
    elsif cp = 92 then
      res := res || '\\';
    elsif cp = 8 then
      res := res || '\b';
    elsif cp = 12 then
      res := res || '\f';
    elsif cp = 10 then
      res := res || '\n';
    elsif cp = 13 then
      res := res || '\r';
    elsif cp = 9 then
      res := res || '\t';
    elsif cp < 32 then
      res := res || '\u00' || lpad(to_hex(cp), 2, '0');
    else
      res := res || ch;
    end if;
  end loop;
  return res || '"';
end;
$$;

-- 3. Reemplazar canonical_json (Serialización estricta RFC 8785 y reglas OT-2)
create or replace function canonical_json(payload jsonb)
returns text
language plpgsql
immutable
set search_path = pg_catalog, public, pg_temp
as $$
declare
  k text;
  v jsonb;
  num numeric;
  num_str text;
  i integer;
begin
  if payload is null or jsonb_typeof(payload) = 'null' then
    return 'null';
  end if;

  if jsonb_typeof(payload) = 'boolean' then
    return payload::text;
  end if;

  if jsonb_typeof(payload) = 'string' then
    return canonical_json_string(payload #>> '{}');
  end if;

  if jsonb_typeof(payload) = 'number' then
    num_str := payload::text;
    if num_str !~ '^-?(0|[1-9][0-9]*)$' then
      raise exception 'Invalid number format in canonical JSON: %', num_str;
    end if;
    num := num_str::numeric;
    if num < -9007199254740991 or num > 9007199254740991 then
      raise exception 'Number out of safe integer range in canonical JSON: %', num_str;
    end if;
    return num_str;
  end if;

  if jsonb_typeof(payload) = 'array' then
    return '[' || coalesce((
      select string_agg(canonical_json(elem), ',' order by ord)
      from jsonb_array_elements(payload) with ordinality as t(elem, ord)
    ), '') || ']';
  end if;

  if jsonb_typeof(payload) = 'object' then
    -- Validar claves y ordenar
    for k, v in select * from jsonb_each(payload) loop
      for i in 1..char_length(k) loop
        if ascii(substring(k from i for 1)) >= 65536 then
          raise exception 'Key "%" contains character outside BMP (>= U+10000)', k;
        end if;
      end loop;
    end loop;

    return '{' || coalesce((
      select string_agg(canonical_json_string(key) || ':' || canonical_json(value), ',' order by convert_to(key, 'UTF8') asc)
      from jsonb_each(payload)
    ), '') || '}';
  end if;

  raise exception 'Unknown JSONB type';
end;
$$;

-- 4. Reemplazar jsonb_has_float manteniendo semántica original (verdadero = inválido)
create or replace function jsonb_has_float(val jsonb)
returns boolean
language plpgsql
immutable
set search_path = pg_catalog, public, pg_temp
as $$
declare
  k text;
  v jsonb;
  elem jsonb;
  num numeric;
begin
  if val is null or jsonb_typeof(val) = 'null' then
    return false;
  end if;

  if jsonb_typeof(val) = 'object' then
    for k, v in select * from jsonb_each(val) loop
      if jsonb_has_float(v) then return true; end if;
    end loop;
  elsif jsonb_typeof(val) = 'array' then
    for elem in select * from jsonb_array_elements(val) loop
      if jsonb_has_float(elem) then return true; end if;
    end loop;
  elsif jsonb_typeof(val) = 'number' then
    if (val::text) !~ '^-?(0|[1-9][0-9]*)$' then
      return true;
    end if;
    num := (val::text)::numeric;
    if num < -9007199254740991 or num > 9007199254740991 then
      return true;
    end if;
  end if;
  return false;
end;
$$;

-- 5. Helper para armar el sobre y serializarlo
create or replace function canonical_ledger_sobre(
  p_org_id uuid,
  p_seq bigint,
  p_occurred_at timestamptz,
  p_actor_type text,
  p_actor_id text,
  p_action text,
  p_object_type text,
  p_object_id text,
  p_payload jsonb
) returns text
language plpgsql
stable
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_entry jsonb;
begin
  v_entry := jsonb_build_object(
    'action', p_action,
    'actor_id', p_actor_id,
    'actor_type', p_actor_type,
    'object_id', p_object_id,
    'object_type', p_object_type,
    'occurred_at', to_char(p_occurred_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
    'org_id', lower(p_org_id::text),
    'payload', p_payload,
    'seq', p_seq
  );
  return canonical_json(v_entry);
end;
$$;

-- 6. Reemplazar validate_ledger_insert
create or replace function validate_ledger_insert()
returns trigger
language plpgsql
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_expected_seq bigint;
  v_expected_prev_hash bytea;
  v_expected_entry_hash bytea;
  v_canonical text;
begin
  if NEW.canon_version is null or NEW.canon_version <> 2 then
    raise exception 'Invalid canon_version: expected 2, received %', NEW.canon_version;
  end if;

  select sl.seq + 1, sl.entry_hash into v_expected_seq, v_expected_prev_hash
  from security_ledger sl
  where sl.org_id = NEW.org_id
  order by sl.seq desc
  limit 1;

  if not found then
    v_expected_seq := 1;
    v_expected_prev_hash := decode('0000000000000000000000000000000000000000000000000000000000000000', 'hex');
  end if;

  if NEW.seq <> v_expected_seq then
    raise exception 'Invalid seq: expected %, received %', v_expected_seq, NEW.seq;
  end if;

  if NEW.prev_hash <> v_expected_prev_hash then
    raise exception 'Invalid prev_hash for seq %', NEW.seq;
  end if;

  v_canonical := canonical_ledger_sobre(
    NEW.org_id, NEW.seq, NEW.occurred_at, NEW.actor_type, NEW.actor_id,
    NEW.action, NEW.object_type, NEW.object_id, NEW.payload
  );
  
  v_expected_entry_hash := sha256(v_expected_prev_hash || convert_to(v_canonical, 'UTF8'));

  if NEW.entry_hash <> v_expected_entry_hash then
    raise exception 'Invalid entry_hash for seq %', NEW.seq;
  end if;

  return NEW;
end;
$$;

-- 7. Reemplazar ledger_append
create or replace function ledger_append(
  p_org_id uuid,
  p_actor_type text,
  p_actor_id text,
  p_action text,
  p_object_type text,
  p_object_id text,
  p_payload jsonb
)
returns table(seq bigint, entry_hash bytea)
security definer
language plpgsql
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_seq bigint;
  v_prev_hash bytea;
  v_entry_hash bytea;
  v_lock_id bigint;
  v_canonical text;
  v_timestamp timestamptz;
begin
  if jsonb_has_float(p_payload) then
    raise exception 'Payload cannot contain floating point numbers or numbers out of bounds';
  end if;
  
  v_lock_id := hashtextextended(p_org_id::text, 0);
  perform pg_advisory_xact_lock(v_lock_id);

  select sl.seq, sl.entry_hash into v_seq, v_prev_hash
  from security_ledger sl
  where sl.org_id = p_org_id
  order by sl.seq desc
  limit 1;

  if not found then
    v_seq := 1;
    v_prev_hash := decode('0000000000000000000000000000000000000000000000000000000000000000', 'hex');
  else
    v_seq := v_seq + 1;
  end if;

  v_timestamp := now();
  
  v_canonical := canonical_ledger_sobre(
    p_org_id, v_seq, v_timestamp, p_actor_type, p_actor_id,
    p_action, p_object_type, p_object_id, p_payload
  );

  v_entry_hash := sha256(v_prev_hash || convert_to(v_canonical, 'UTF8'));

  insert into security_ledger (
    org_id, seq, occurred_at, actor_type, actor_id, action, object_type, object_id, payload, prev_hash, entry_hash, canon_version
  ) values (
    p_org_id, v_seq, v_timestamp, p_actor_type, p_actor_id, p_action, p_object_type, p_object_id, p_payload, v_prev_hash, v_entry_hash, 2
  );

  return query select v_seq, v_entry_hash;
end;
$$;

-- 8. Permisos
revoke all on function canonical_json_string(text) from public, anon, authenticated;
revoke all on function canonical_json(jsonb) from public, anon, authenticated;
revoke all on function jsonb_has_float(jsonb) from public, anon, authenticated;
revoke all on function canonical_ledger_sobre(uuid, bigint, timestamptz, text, text, text, text, text, jsonb) from public, anon, authenticated;
revoke all on function validate_ledger_insert() from public, anon, authenticated;
revoke all on function ledger_append(uuid, text, text, text, text, text, jsonb) from public, anon, authenticated;
