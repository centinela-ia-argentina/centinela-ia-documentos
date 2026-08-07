-- 20260806230000_harden_escribania_core.rollback.sql
-- ADVERTENCIA: Este rollback revertirá algunas defensas colaborativas, pero NO reabrirá 
-- las vulnerabilidades P0 intencionalmente. Mantiene RLS y acceso restrictivo básico.

begin;

-- Restore match_document_chunks to older live definition, keeping organization check
drop function if exists public.match_document_chunks(vector, uuid, integer);
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
  if public.current_user_organization_id() != match_org then return; end if;
  if public.current_user_role() not in ('admin', 'employee', 'auditor') then return; end if;

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

revoke execute on function public.match_document_chunks(vector, uuid, integer) from public, anon;
grant execute on function public.match_document_chunks(vector, uuid, integer) to authenticated;

-- Drop new policies and triggers safely
drop trigger if exists enforce_derivations_mutation on public.case_derivations;
drop function if exists public.prevent_derivations_mutation();
drop function if exists public.registrar_escritura_atomica;

-- Prohibido usar USING(true) o GRANT ALL a public/anon. 
-- El sistema permanece protegido con RLS, perfiles activos y aislamiento de organización.
-- No reabrimos vulnerabilidades.

commit;
