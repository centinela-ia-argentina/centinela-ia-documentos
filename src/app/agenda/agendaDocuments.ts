import type { AgendaEvento } from './AgendaClient';

export interface AgendaDocumentRecord {
  id: string;
  file_name?: string | null;
  expires_at: string | Date | null;
  case_id?: string | null;
}

export function filterAgendaDocuments(
  documents: AgendaDocumentRecord[],
  compatibleCaseIds: Set<string>
): AgendaEvento[] {
  const eventos: AgendaEvento[] = [];
  for (const doc of documents) {
    if (!doc.expires_at) continue;
    // Si el documento está asociado a un caso, solo incluir si el caso es compatible con la vertical activa
    if (doc.case_id && !compatibleCaseIds.has(doc.case_id)) continue;
    // Documentos sin case_id (a nivel organización) se incluyen si pertenecen a profile.organization_id (garantizado por el query)
    eventos.push({
      id: `doc-${doc.id}`,
      fecha: String(doc.expires_at).slice(0, 10),
      titulo: doc.file_name ?? 'Documento',
      tipo: 'documento',
      href: `/documentos/${doc.id}`,
    });
  }
  return eventos;
}
