-- 20260806230000_harden_escribania_core.rollback.sql
begin;

-- Restore old cases and documents policies (if they were named like this before the migration)
-- NOTE: In a true rollback, we would recreate the exact legacy policies. For safety, we just drop the new ones.
drop policy if exists "cases_select_derived_role" on public.cases;
drop policy if exists "documents_select_derived_role" on public.documents;
drop policy if exists "documents_insert_derived_role" on public.documents;
drop policy if exists "documents_delete_admin" on public.documents;

create policy "documents_delete_own_org" on public.documents for delete to authenticated using (organization_id = public.current_user_organization_id());

-- Storage rollback
drop policy if exists "documents_storage_select_derived_role" on storage.objects;
drop policy if exists "documents_storage_insert_derived_role" on storage.objects;

-- Derivations rollback
drop policy if exists "derivations_select_origin" on public.case_derivations;
drop policy if exists "derivations_insert_origin" on public.case_derivations;
drop policy if exists "derivations_update_origin" on public.case_derivations;
drop policy if exists "derivations_select_dest" on public.case_derivations;
drop policy if exists "derivations_update_dest" on public.case_derivations;

-- Derivation Notes rollback
drop policy if exists "derivation_notes_select" on public.derivation_notes;
drop policy if exists "derivation_notes_insert" on public.derivation_notes;

-- Document Chunks rollback
drop policy if exists "document_chunks_select_role" on public.document_chunks;
drop policy if exists "document_chunks_insert_role" on public.document_chunks;
drop policy if exists "document_chunks_delete_role" on public.document_chunks;

-- Protocolo rollback
drop policy if exists "protocolo_select_role" on public.protocolo_escrituras;
drop policy if exists "protocolo_insert_role" on public.protocolo_escrituras;
drop policy if exists "protocolo_update_role" on public.protocolo_escrituras;
drop policy if exists "protocolo_delete_admin" on public.protocolo_escrituras;

-- Drop new functions
drop function if exists public.registrar_escritura_atomica;
drop function if exists public.can_read_derived_case;
drop function if exists public.can_contribute_derived_case;
drop function if exists public.current_user_is_active;

-- Revert match_document_chunks if needed (we leave it as is or recreate without the active checks)
-- The tables themselves (protocolo_escrituras, case_derivations, derivation_notes) are kept to prevent data loss.

commit;
