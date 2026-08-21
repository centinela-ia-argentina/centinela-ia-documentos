import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AppShell } from '@/components/layout/AppShell';
import { createClient } from '@/lib/supabase/server';
import { getUserProfile } from '@/lib/auth/getUserProfile';
import { getDocumentTypeLabel } from '@/lib/industries/documentTypes';
import { formatFileSize } from '@/lib/format/fileSize';
import { getDocumentExpiryStatus, expiryStatusLabel, getExpiryBadgeStyles, getDaysUntilExpiry } from '@/lib/documents/expiry';
import { sensitivityLabel } from '@/lib/documents/sensitivity';
import { MetricCard } from '@/components/dashboard/MetricCard';
import { Banner } from '@/components/ui/Banner';
import { Badge } from '@/components/ui/Badge';
import { Reveal } from '@/components/ui/Reveal';
import { MotionButton } from '@/components/ui/MotionButton';
import { DocumentRowClient } from './DocumentRowClient';
import { analyzeDocument } from './actions';
import { AnalyzeButton } from './AnalyzeButton';
import type { DocumentRecord } from '@/types/document';
import { isUserRole, canArchiveDocument, canDeleteDocument } from '@/lib/permissions/roles';

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

function getAiStatus(count: number) {
  if (count <= 0) {
    return {
      label: 'Pendiente',
      countLabel: null,
    };
  }

  return {
    label: 'Analizado IA',
    countLabel: null,
  };
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

  const { data: documents } = await queryBuilder;

  const { data: aiOutputs } = await supabase
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

  const qs = normalizedTerm ? `&q=${encodeURIComponent(searchTerm)}` : '';

  const filters: {
    label: string;
    value: IaFilter;
    count: number;
    href: string;
  }[] = [
    {
      label: 'Todos',
      value: 'todos',
      count: totalDocuments,
      href: normalizedTerm ? `/documentos?q=${encodeURIComponent(searchTerm)}` : '/documentos',
    },
    {
      label: 'Pendientes IA',
      value: 'pendientes',
      count: pendingDocuments,
      href: `/documentos?ia=pendientes${qs}`,
    },
    {
      label: 'Analizados',
      value: 'analizados',
      count: analyzedDocuments,
      href: `/documentos?ia=analizados${qs}`,
    },
  ];

  return (
    <AppShell>
      <Reveal>
        <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-400/80">
              DOCUMENTOS
            </p>

            <h2 className="mt-2 font-display text-3xl font-semibold tracking-tight text-gradient">
              Bóveda documental
            </h2>

            <p className="mt-2 text-sm text-slate-400">
              Control operativo de documentos cargados, clasificación y estado de análisis IA.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Link
              href={estado === 'archivadas' ? '/documentos' : '/documentos?estado=archivadas'}
              className={`rounded-2xl border px-4 py-2 text-sm font-bold transition-all ${
                estado === 'archivadas' 
                  ? 'border-sky-400 bg-sky-400/10 text-sky-400' 
                  : 'border-white/10 bg-white/[0.025] text-slate-300 hover:bg-white/[0.05]'
              }`}
            >
              {estado === 'archivadas' ? 'Ver activas' : 'Ver archivadas'}
            </Link>
            <Link href="/documentos/subir">
              <MotionButton className="bg-gradient-to-r from-accent to-brandviolet text-white">
                ⬆ Subir documento
              </MotionButton>
            </Link>
          </div>
        </div>

        <div className="mb-6 grid gap-4 sm:grid-cols-3">
          <MetricCard index={0} label="Documentos totales" value={String(totalDocuments)} helper="Bóveda privada" />
          <MetricCard index={1} label="Pendientes de revisión" value={String(pendingDocuments)} helper="Sin análisis IA" />
          <MetricCard index={2} label="Con análisis IA" value={String(analyzedDocuments)} helper="Al menos un análisis" />
        </div>
      </Reveal>

      <form method="get" className="mb-6 flex gap-2">
        {activeFilter !== 'todos' ? (
          <input type="hidden" name="ia" value={activeFilter} />
        ) : null}
        <input
          type="search"
          name="q"
          defaultValue={searchTerm}
          placeholder="Buscar por nombre de archivo o tipo…"
          className="w-full max-w-md rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white placeholder:text-slate-500 outline-none focus:border-accent focus:ring-1 focus:ring-accent"
        />
        <MotionButton type="submit" className="bg-white/10 text-white hover:bg-white/20">
          Buscar
        </MotionButton>
      </form>

      <div className="mb-6 flex flex-wrap gap-3">
        {filters.map((filter) => {
          const isActive = activeFilter === filter.value;

          return (
            <Link
              key={filter.value}
              href={filter.href}
              className={`rounded-xl px-4 py-2 text-sm font-bold transition-all ${
                isActive
                  ? 'bg-gradient-to-r from-accent to-brandviolet text-white shadow-[0_4px_12px_rgba(34,211,238,0.2)]'
                  : 'border border-white/10 bg-white/[0.04] text-slate-400 hover:text-white hover:border-white/20'
              }`}
            >
              {filter.label} · {filter.count}
            </Link>
          );
        })}
      </div>

      {pendingDocuments > 0 ? (
        <div className="mb-6">
          <Banner
            variant="warning"
            title="Hay documentos pendientes de análisis IA."
            description="Revisá los pendientes y ejecutá el análisis IA para completar la cobertura documental."
            action={<Link href="/documentos?ia=pendientes" className="quick-action text-white">Ver pendientes IA</Link>}
          />
        </div>
      ) : (
        <div className="mb-6">
          <Banner
            variant="success"
            title="Cobertura IA completa."
            description="Todos los documentos cargados tienen al menos un análisis IA registrado."
          />
        </div>
      )}

      {expiringDocs > 0 || expiredDocs > 0 ? (
        <div className="mb-6">
          <Banner
            variant="warning"
            title="Alertas de vencimiento"
            description={`${expiringDocs > 0 ? `${expiringDocs} documento(s) por vencer` : ''}${expiringDocs > 0 && expiredDocs > 0 ? ' y ' : ''}${expiredDocs > 0 ? `${expiredDocs} documento(s) vencido(s)` : ''}.`}
          />
        </div>
      ) : null}

      <Reveal delay={0.1}>
        <div className="overflow-x-auto rounded-2xl border border-white/10 bg-white/[0.03]">
          <table className="w-full text-left text-sm">
            <thead className="bg-white/[0.04] text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            <tr>
              <th className="px-2 py-3">Archivo</th>
              <th className="px-2 py-3">Tipo</th>
              <th className="px-2 py-3">Sensibilidad</th>
              <th className="px-2 py-3">Estado IA</th>
              <th className="px-2 py-3 hidden md:table-cell">Vencimiento</th>
              <th className="px-2 py-3 hidden md:table-cell">Tamaño</th>
              <th className="px-2 py-3 text-right">Acción</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-200">
            {filteredRecords.map((item, index) => {
              const analysisCount = analysisCountByDocument.get(item.id) ?? 0;
              const aiStatus = getAiStatus(analysisCount);
              const isPending = analysisCount === 0;
              const isAnalyzable = ['application/pdf', 'image/jpeg', 'image/png'].includes(item.file_mime_type ?? '');

              const expiryStatus = getDocumentExpiryStatus(item.expires_at);
              const expiryBadge = getExpiryBadgeStyles(expiryStatus);
              let expiryText = expiryStatusLabel(expiryStatus);
              if (expiryStatus === 'por_vencer') {
                const days = getDaysUntilExpiry(item.expires_at);
                if (days !== null) {
                  expiryText = `Por vencer · ${days} días`;
                }
              }

              return (
                <DocumentRowClient
                  key={item.id}
                  index={index}
                  documentId={item.id}
                  fileName={item.file_name}
                  isArchived={item.archived_at != null}
                  canArchive={canArchive}
                  canDelete={canDelete}
                  documentTypeLabel={getDocumentTypeLabel(item.document_type)}
                  sensitivityLabel={sensitivityLabel(item.sensitivity_level)}
                  isDangerSensitivity={sensitivityLabel(item.sensitivity_level) === 'Crítico' || sensitivityLabel(item.sensitivity_level) === 'Alto'}
                  aiStatusLabel={aiStatus.label}
                  isPendingAi={isPending}
                  isAnalyzable={isAnalyzable}
                  expiryStatus={expiryStatus}
                  expiryText={expiryText}
                  fileSizeLabel={formatFileSize(item.file_size)}
                />
              );
            })}
          </tbody>
        </table>

        {filteredRecords.length === 0 ? (
          <div className="p-10 text-center">
            <p className="font-bold text-white">
              {searchTerm
                ? `No se encontraron documentos para «${searchTerm}».`
                : 'No hay documentos para este filtro.'}
            </p>

            <p className="mt-2 text-sm text-slate-400">
              Probá cambiando el filtro o subiendo un nuevo documento.
            </p>
          </div>
        ) : null}
        </div>
      </Reveal>
    </AppShell>
  );
}
