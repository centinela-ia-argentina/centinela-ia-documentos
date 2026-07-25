create extension if not exists pgcrypto;

create table security_ledger (
  id          bigserial primary key,
  org_id      uuid not null,
  seq         bigint not null,
  occurred_at timestamptz not null default now(),
  actor_type  text not null check (actor_type in ('human','agent','system')),
  actor_id    text not null,
  action      text not null,
  object_type text,
  object_id   text,
  payload     jsonb not null default '{}'::jsonb,
  prev_hash   bytea not null,
  entry_hash  bytea not null,
  unique (org_id, seq)
);

create index idx_ledger_org_time
  on security_ledger (org_id, occurred_at desc);

revoke update, delete, truncate on security_ledger from public, authenticated, anon;

create or replace function abort_ledger_modification()
returns trigger
language plpgsql
as $$
begin
  raise exception 'Modification of security_ledger is strictly prohibited.';
end;
$$;

create trigger trigger_abort_ledger_update_delete
before update or delete on security_ledger
for each row
execute function abort_ledger_modification();

create trigger trigger_abort_ledger_truncate
before truncate on security_ledger
for each statement
execute function abort_ledger_modification();

create or replace function canonical_json(payload jsonb)
returns text
language plpgsql
immutable
as $$
begin
  -- Casting jsonb to text in PostgreSQL natively orders keys.
  -- This fulfills the requirement for a key-ordered serialization.
  return payload::text;
end;
$$;

create or replace function jsonb_has_float(val jsonb)
returns boolean
language plpgsql immutable
as $$
declare
  k text;
  v jsonb;
  elem jsonb;
begin
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
    if (val::text) ~ '\.' then
      return true;
    end if;
  end if;
  return false;
end;
$$;

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
  
  v_lock_id := hashtext(p_org_id::text);
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
  
  -- Build the entry to be hashed. We ensure object_type and object_id are conditionally included or handled as null
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
  v_entry_hash := digest(v_prev_hash || convert_to(v_canonical, 'UTF8'), 'sha256');

  insert into security_ledger (
    org_id, seq, occurred_at, actor_type, actor_id, action, object_type, object_id, payload, prev_hash, entry_hash
  ) values (
    p_org_id, v_seq, v_timestamp, p_actor_type, p_actor_id, p_action, p_object_type, p_object_id, p_payload, v_prev_hash, v_entry_hash
  );

  return query select v_seq, v_entry_hash;
end;
$$;
