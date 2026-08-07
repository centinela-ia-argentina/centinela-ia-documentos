-- 20260806230000_harden_escribania_core.rollback.sql
-- ADVERTENCIA: Este rollback revertirá las defensas colaborativas, el aislamiento
-- del protocolo, y la protección RAG, exponiendo el sistema a fugas y cruce de datos.

begin;

-- Restore match_document_chunks to older live definition (without active checks)
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
grant execute on function public.match_document_chunks(vector, uuid, integer) to authenticated, anon, public;

-- Drop new policies and triggers
drop trigger if exists enforce_derivations_mutation on public.case_derivations;
drop function if exists public.prevent_derivations_mutation();
drop function if exists public.is_valid_derived_storage_path;
drop function if exists public.can_read_derived_case;
drop function if exists public.can_contribute_derived_case;
drop function if exists public.registrar_escritura_atomica;

-- We are not dropping current_user_is_active() as it is transverse.

-- Drop new secure policies
drop policy if exists "derivations_select_origin" on public.case_derivations;
drop policy if exists "derivations_insert_origin" on public.case_derivations;
drop policy if exists "derivations_update_origin" on public.case_derivations;
drop policy if exists "derivations_select_dest" on public.case_derivations;
drop policy if exists "derivations_update_dest" on public.case_derivations;

drop policy if exists "derivation_notes_select" on public.derivation_notes;
drop policy if exists "derivation_notes_insert" on public.derivation_notes;

drop policy if exists "cases_select_derived_role" on public.cases;
drop policy if exists "documents_select_derived_role" on public.documents;
drop policy if exists "documents_insert_derived_role" on public.documents;
drop policy if exists "documents_storage_select_derived_role" on storage.objects;
drop policy if exists "documents_storage_insert_derived_role" on storage.objects;

drop policy if exists "documents_delete_admin" on public.documents;

drop policy if exists "document_chunks_select_role" on public.document_chunks;
drop policy if exists "document_chunks_insert_role" on public.document_chunks;
drop policy if exists "document_chunks_delete_role" on public.document_chunks;

drop policy if exists "protocolo_select_role" on public.protocolo_escrituras;
drop policy if exists "protocolo_insert_role" on public.protocolo_escrituras;
drop policy if exists "protocolo_update_role" on public.protocolo_escrituras;
drop policy if exists "protocolo_delete_admin" on public.protocolo_escrituras;

-- Recreate old lax policies to ensure access is not lost (though they are insecure)
create policy "derivaciones destino select" on public.case_derivations for select using (true);
create policy "derivaciones destino update" on public.case_derivations for update using (true);
create policy "derivaciones origen insert" on public.case_derivations for insert with check (true);
create policy "derivaciones origen select" on public.case_derivations for select using (true);
create policy "derivaciones origen update" on public.case_derivations for update using (true);

create policy "notes_select_legacy" on public.derivation_notes for select using (true);
create policy "notes_insert_legacy" on public.derivation_notes for insert with check (true);
create policy "notes_update_legacy" on public.derivation_notes for update using (true);
create policy "derivation_notes_insert_dest" on public.derivation_notes for insert with check (true);
create policy "derivation_notes_select_dest" on public.derivation_notes for select using (true);
create policy "derivation_notes_select_origin" on public.derivation_notes for select using (true);

create policy "cases_select_derived" on public.cases for select using (true);
create policy "documents_select_derived" on public.documents for select using (true);
create policy "documents_insert_derived" on public.documents for insert with check (true);

create policy "documents_storage_insert_derived" on storage.objects for insert with check (true);
create policy "documents_storage_select_derived" on storage.objects for select using (true);

create policy "documents_delete_own_org" on public.documents for delete using (true);

create policy "document_chunks_select_org" on public.document_chunks for select using (true);
create policy "document_chunks_insert_org" on public.document_chunks for insert with check (true);
create policy "document_chunks_delete_org" on public.document_chunks for delete using (true);
create policy "document_chunks_delete_own_org" on public.document_chunks for delete using (true);

create policy "protocolo_org_select" on public.protocolo_escrituras for select using (true);
create policy "protocolo_org_insert" on public.protocolo_escrituras for insert with check (true);
create policy "protocolo_org_update" on public.protocolo_escrituras for update using (true);
create policy "protocolo_org_delete" on public.protocolo_escrituras for delete using (true);

-- Grant privileges back to public and anon
grant all on public.protocolo_escrituras to public, anon;
grant all on public.case_derivations to public, anon;
grant all on public.derivation_notes to public, anon;
grant all on public.document_chunks to public, anon;

commit;
