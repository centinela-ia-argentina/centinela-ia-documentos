-- 1. Los dos triggers de inmutabilidad pasan a modo ALWAYS
alter table security_ledger enable always trigger trigger_abort_ledger_update_delete;
alter table security_ledger enable always trigger trigger_abort_ledger_truncate;

-- 2. Trigger BEFORE INSERT sobre security_ledger en modo ALWAYS para validar seq, prev_hash y entry_hash
create or replace function validate_ledger_insert()
returns trigger
language plpgsql
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_expected_seq bigint;
  v_expected_prev_hash bytea;
  v_expected_entry_hash bytea;
  v_entry jsonb;
  v_canonical text;
begin
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

  v_entry := jsonb_build_object(
    'org_id', NEW.org_id,
    'seq', NEW.seq,
    'occurred_at', to_char(NEW.occurred_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
    'actor_type', NEW.actor_type,
    'actor_id', NEW.actor_id,
    'action', NEW.action,
    'payload', NEW.payload
  );

  if NEW.object_type is not null then
    v_entry := jsonb_set(v_entry, '{object_type}', to_jsonb(NEW.object_type));
  else
    v_entry := jsonb_set(v_entry, '{object_type}', 'null'::jsonb);
  end if;

  if NEW.object_id is not null then
    v_entry := jsonb_set(v_entry, '{object_id}', to_jsonb(NEW.object_id));
  else
    v_entry := jsonb_set(v_entry, '{object_id}', 'null'::jsonb);
  end if;

  v_canonical := canonical_json(v_entry);
  v_expected_entry_hash := sha256(v_expected_prev_hash || convert_to(v_canonical, 'UTF8'));

  if NEW.entry_hash <> v_expected_entry_hash then
    raise exception 'Invalid entry_hash for seq %', NEW.seq;
  end if;

  return NEW;
end;
$$;

create trigger trigger_validate_ledger_insert
before insert on security_ledger
for each row
execute function validate_ledger_insert();

alter table security_ledger enable always trigger trigger_validate_ledger_insert;

revoke all on function validate_ledger_insert() from public, anon, authenticated;

-- 3. Revocar escritura directa del rol de servicio sobre la tabla
revoke insert, update, delete, truncate on security_ledger from service_role;

-- 6. Reemplazar validación de números de jsonb_has_float para validación estructural y seguro (+/- 9007199254740991)
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
  if val is null or val = 'null'::jsonb then
    return false;
  end if;

  if jsonb_typeof(val) = 'object' then
    for k, v in select * from jsonb_each(val) loop
      if jsonb_has_float(v) then
        return true;
      end if;
    end loop;
  elsif jsonb_typeof(val) = 'array' then
    for elem in select * from jsonb_array_elements(val) loop
      if jsonb_has_float(elem) then
        return true;
      end if;
    end loop;
  elsif jsonb_typeof(val) = 'number' then
    begin
      num := (val::text)::numeric;
      if num is null or num <> trunc(num) or num < -9007199254740991 or num > 9007199254740991 then
        return true;
      end if;
    exception when others then
      return true;
    end;
  end if;
  return false;
end;
$$;

-- 4. Revocar ejecución pública de las funciones auxiliares
revoke all on function canonical_json(jsonb) from public, anon, authenticated;
revoke all on function jsonb_has_float(jsonb) from public, anon, authenticated;
revoke all on function abort_ledger_modification() from public, anon, authenticated;

-- 5. Reemplazar hashtext por hashtextextended dentro de ledger_append
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
  v_entry jsonb;
begin
  if jsonb_has_float(p_payload) then
    raise exception 'Payload cannot contain floating point numbers';
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
  
  v_entry := jsonb_build_object(
    'org_id', p_org_id,
    'seq', v_seq,
    'occurred_at', to_char(v_timestamp at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
    'actor_type', p_actor_type,
    'actor_id', p_actor_id,
    'action', p_action,
    'payload', p_payload
  );

  if p_object_type is not null then
    v_entry := jsonb_set(v_entry, '{object_type}', to_jsonb(p_object_type));
  else
    v_entry := jsonb_set(v_entry, '{object_type}', 'null'::jsonb);
  end if;

  if p_object_id is not null then
    v_entry := jsonb_set(v_entry, '{object_id}', to_jsonb(p_object_id));
  else
    v_entry := jsonb_set(v_entry, '{object_id}', 'null'::jsonb);
  end if;

  v_canonical := canonical_json(v_entry);
  v_entry_hash := sha256(v_prev_hash || convert_to(v_canonical, 'UTF8'));

  insert into security_ledger (
    org_id, seq, occurred_at, actor_type, actor_id, action, object_type, object_id, payload, prev_hash, entry_hash
  ) values (
    p_org_id, v_seq, v_timestamp, p_actor_type, p_actor_id, p_action, p_object_type, p_object_id, p_payload, v_prev_hash, v_entry_hash
  );

  return query select v_seq, v_entry_hash;
end;
$$;

revoke all on function ledger_append(uuid, text, text, text, text, text, jsonb)
  from public, anon, authenticated;
