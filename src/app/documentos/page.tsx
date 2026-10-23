import { DocumentLibrary } from './DocumentLibrary';
import { redirect } from 'next/navigation';
import { AppShell } from '@/components/layout/AppShell';
import { createClient } from '@/lib/supabase/server';
import { getUserProfile } from '@/lib/auth/getUserProfile';
import { getDocumentTypeLabel } from '@/lib/industries/documentTypes';
import { formatFileSize } from '@/lib/format/fileSize';
import {
  getDocumentExpiryStatus,
  expiryStatusLabel,
  getDaysUntilExpiry,
} from '@/lib/documents/expiry';
import { sensitivityLabel } from '@/lib/documents/sensitivity';
import type { DocumentRecord } from '@/types/document';
import { isUserRole, canArchiveDocument, canDeleteDocument, canUploadDocument, canUseAi } from '@/lib/permissions/roles';

interface DocumentsPageProps {
  searchParams: Promise<{ ia?: string; q?: string; estado?: string }>;
}

type IaFilter = 'todos' | 'pendientes' | 'analizados';



function normalizeIaFilter(value?: string): IaFilter {
  if (value === 'pendientes' || value === 'analizados') {
    return value;
  }

  return 'todos';
}

export default async function DocumentsPage({
  searchParams,
}: DocumentsPageProps) {
  const query = await searchParams;
  const activeFilter = normalizeIaFilter(query.ia);
  const searchTerm = (query.q ?? '').trim();
  const normalizedTerm = searchTerm.toLowerCase();
  const estado = query.estado;

  const { user, profile } = await getUserProfile();

  if (!user) redirect('/login');
  if (!profile) redirect('/onboarding');

  const supabase = await createClient();

  const canArchive = isUserRole(profile.role) && canArchiveDocument(profile.role);
  const canDelete  = isUserRole(profile.role) && canDeleteDocument(profile.role);

  let queryBuilder = supabase
    .from('documents')
    .select('*')
    .eq('organization_id', profile.organization_id)
    .order('created_at', { ascending: false });

  if (estado === 'archivadas') {
    queryBuilder = queryBuilder.not('archived_at', 'is', null);
  } else {
    queryBuilder = queryBuilder.is('archived_at', null);
  }

  const { data: documents, error: documentsError } = await queryBuilder;

  const { data: aiOutputs, error: analysisError } = await supabase
    .from('ai_outputs')
    .select('document_id')
    .eq('organization_id', profile.organization_id)
    .eq('output_type', 'document_analysis');

  const analysisCountByDocument = new Map<string, number>();

  for (const item of aiOutputs ?? []) {
    const documentId = String(item.document_id || '');
    if (!documentId) continue;

    analysisCountByDocument.set(
      documentId,
      (analysisCountByDocument.get(documentId) ?? 0) + 1
    );
  }

  const records = (documents ?? []) as DocumentRecord[];

  let expiringDocs = 0;
  let expiredDocs = 0;

  for (const item of records) {
    const status = getDocumentExpiryStatus(item.expires_at);
    if (status === 'por_vencer') expiringDocs++;
    if (status === 'vencido') expiredDocs++;
  }

  const totalDocuments = records.length;

  const pendingDocuments = records.filter(
    (item) => (analysisCountByDocument.get(item.id) ?? 0) === 0
  ).length;

  const analyzedDocuments = records.filter(
    (item) => (analysisCountByDocument.get(item.id) ?? 0) > 0
  ).length;


  const filteredRecords = records.filter((item) => {
    const count = analysisCountByDocument.get(item.id) ?? 0;

    const matchesFilter =
      activeFilter === 'pendientes' ? count === 0 :
      activeFilter === 'analizados' ? count > 0 :
      true;

    const matchesTerm =
      !normalizedTerm ||
      (item.file_name ?? '').toLowerCase().includes(normalizedTerm) ||
      getDocumentTypeLabel(item.document_type).toLowerCase().includes(normalizedTerm);

    return matchesFilter && matchesTerm;
  });

  const isArchivedView = estado === 'archivadas';
  const stateParam = isArchivedView ? '&estado=archivadas' : '';
  const qs = normalizedTerm ? `&q=${encodeURIComponent(searchTerm)}` : '';

  const filters: {
    label: string;
    value: IaFilter;
    count: number;
    href: string;
  }[] = [
    {
      label: isArchivedView ? 'Todos archivados' : 'Todos activos',
      value: 'todos',
      count: totalDocuments,
      href: normalizedTerm
        ? `/documentos?q=${encodeURIComponent(searchTerm)}${stateParam}`
        : isArchivedView
        ? '/documentos?estado=archivadas'
        : '/documentos',
    },
    {
      label: isArchivedView ? 'Archivados pendientes' : 'Pendientes activos',
      value: 'pendientes',
      count: pendingDocuments,
      href: `/documentos?ia=pendientes${qs}${stateParam}`,
    },
    {
      label: isArchivedView ? 'Archivados analizados' : 'Activos analizados',
      value: 'analizados',
      count: analyzedDocuments,
      href: `/documentos?ia=analizados${qs}${stateParam}`,
    },
  ];

  const items = filteredRecords.map((item) => {
    const analysisCount = analysisCountByDocument.get(item.id) ?? 0;
    const expiryStatus = getDocumentExpiryStatus(item.expires_at);
    let expiryText = expiryStatusLabel(expiryStatus);
    if (expiryStatus === 'por_vencer') {
      const days = getDaysUntilExpiry(item.expires_at);
      if (days !== null) expiryText = `Por vencer · ${days} días`;
    }
    const mime = item.file_mime_type ?? '';
    const formatLabels: Record<string, string> = { 'application/pdf': 'PDF', 'image/jpeg': 'JPG', 'image/png': 'PNG', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'DOCX' };
    return { id: item.id, fileName: item.file_name, documentTypeLabel: getDocumentTypeLabel(item.document_type), sensitivityLabel: sensitivityLabel(item.sensitivity_level), isPendingAi: analysisCount === 0, isAnalyzable: ['application/pdf', 'image/jpeg', 'image/png'].includes(mime), expiryStatus, expiryText, fileSizeLabel: formatFileSize(item.file_size), formatLabel: formatLabels[mime] ?? 'Archivo', isArchived: item.archived_at != null };
  });
  const roleValid = isUserRole(profile.role);
  return <AppShell><DocumentLibrary key={`${isArchivedView}-${activeFilter}-${searchTerm}`} items={items} filters={filters} activeFilter={activeFilter} searchTerm={searchTerm} isArchivedView={isArchivedView} totalDocuments={totalDocuments} expiredDocs={expiredDocs} expiringDocs={expiringDocs} documentsFailed={Boolean(documentsError)} analysisFailed={Boolean(analysisError)} canUpload={roleValid && canUploadDocument(profile.role)} canAnalyze={roleValid && canUseAi(profile.role)} canArchive={canArchive} canDelete={canDelete} /></AppShell>;
}
