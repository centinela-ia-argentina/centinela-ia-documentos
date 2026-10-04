-- Anulus AI — Storage policies para bucket privado documents
-- Ejecutar después de schema.sql.
-- Ruta esperada: organization_id/case_id/document_id/file_name

create policy "documents_storage_select_own_org"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'documents'
  and split_part(name, '/', 1)::uuid = public.current_user_organization_id()
);

create policy "documents_storage_insert_own_org"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'documents'
  and split_part(name, '/', 1)::uuid = public.current_user_organization_id()
);

create policy "documents_storage_update_own_org"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'documents'
  and split_part(name, '/', 1)::uuid = public.current_user_organization_id()
)
with check (
  bucket_id = 'documents'
  and split_part(name, '/', 1)::uuid = public.current_user_organization_id()
);

create policy "documents_storage_delete_admin_own_org"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'documents'
  and split_part(name, '/', 1)::uuid = public.current_user_organization_id()
  and public.is_org_admin()
);
