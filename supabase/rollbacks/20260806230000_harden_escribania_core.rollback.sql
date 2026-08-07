-- 20260806230000_harden_escribania_core.rollback.sql
-- ADVERTENCIA: El rollback de la aplicación debe realizarse mediante deployment coordinado;
-- este rollback SQL no retira funciones requeridas por el código activo.

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
  if public.current_user_role() not in ('admin', 'employee', 'auditor') then return; end if;
  if public.current_user_organization_id() != match_org then return; end if;

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

-- El rollback debe mantener el contrato requerido por el código nuevo.
-- NO ELIMINAMOS enforce_derivations_mutation
-- NO ELIMINAMOS prevent_derivations_mutation()
-- NO ELIMINAMOS registrar_escritura_atomica()

commit;
