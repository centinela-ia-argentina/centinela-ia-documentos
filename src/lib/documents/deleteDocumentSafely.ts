import type { createClient } from '@/lib/supabase/server';

type Client = Awaited<ReturnType<typeof createClient>>;
type Input = { documentId: string; organizationId: string; caseId?: string };
export type DocumentDeletionResult =
  | { status: 'deleted'; fileName: string }
  | { status: 'failed' | 'partial'; stage: string };

/** Storage and Postgres are not one transaction. Stop on the first failure;
 * never report success after a partial cleanup. Retain the document row until
 * all cleanup steps succeed so an authorized operator can inspect/retry it. */
export async function deleteDocumentSafely(client: Client, input: Input): Promise<DocumentDeletionResult> {
  let changed = false;
  let stage = 'lookup';
  const failed = (): DocumentDeletionResult => ({ status: changed ? 'partial' : 'failed', stage });
  try {
    let query = client.from('documents').select('id, file_path, file_name')
      .eq('id', input.documentId).eq('organization_id', input.organizationId);
    if (input.caseId) query = query.eq('case_id', input.caseId);
    const { data: document, error: lookupError } = await query.maybeSingle();
    if (lookupError || !document) return failed();

    stage = 'storage';
    changed = true; // A failed provider response does not guarantee the object is unchanged.
    const { error: storageError } = await client.storage.from('documents').remove([document.file_path]);
    if (storageError) return failed();

    stage = 'chunks';
    const { error: chunksError } = await client.from('document_chunks').delete()
      .eq('document_id', input.documentId).eq('organization_id', input.organizationId);
    if (chunksError) return failed();

    stage = 'analysis';
    const { error: analysisError } = await client.from('ai_outputs').delete()
      .eq('document_id', input.documentId).eq('organization_id', input.organizationId);
    if (analysisError) return failed();

    stage = 'checklist';
    const { error: checklistError } = await client.from('checklist_items')
      .update({ document_id: null, status: 'pending', match_source: null })
      .eq('document_id', input.documentId).eq('organization_id', input.organizationId);
    if (checklistError) return failed();

    stage = 'document';
    let deletion = client.from('documents').delete()
      .eq('id', input.documentId).eq('organization_id', input.organizationId);
    if (input.caseId) deletion = deletion.eq('case_id', input.caseId);
    const { data: deleted, error: deleteError } = await deletion.select('id');
    if (deleteError || deleted?.length !== 1) return failed();
    return { status: 'deleted', fileName: document.file_name };
  } catch {
    // Do not include storage paths, file contents or provider messages in UI.
    return failed();
  }
}
