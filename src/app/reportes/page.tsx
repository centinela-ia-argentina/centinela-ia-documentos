import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AppShell } from '@/components/layout/AppShell';
import { createClient } from '@/lib/supabase/server';
import { getUserProfile } from '@/lib/auth/getUserProfile';
import { normalizeIndustryType } from '@/lib/industries/documentTypes';
import { getCaseStatusLabel, isCaseActive, isCaseTypeCompatibleWithIndustry, caseStatusesByIndustry, TERMINAL_CASE_STATUSES } from '@/lib/industries/caseConfig';
import { getIndustryTerms, type IndustryTerms } from '@/lib/industries/uiLabels';
import { MotionCard } from '@/components/ui/MotionCard';
import { parseStrictPositiveInteger, type AuditLogRecordForReport } from './reportHelpers';
import { loadDocumentReportData, type DocumentRecordForReport } from './documentReportData';
import { DocumentReport } from './DocumentReport';
import {
  finalizeAuditRedirect,
  isAuditReportFilter,
  resolveAuditPageParam,
  type AuditReportFilter,
} from './auditReportContract';
import { fetchAuditCounts, buildAuditReportData } from './auditReportData';
import { AuditReportView } from './AuditReportView';
import type { AuditDocumentRecord } from './auditPresentation';

type ReportView = 'general' | 'gestion' | 'documentos' | 'auditoria';

interface ReportsPageProps {
  searchParams: Promise<{ vista?: string; tipo?: string; pagina?: string; page?: string }>;
}

interface CaseRecord {
  id: string;
  title: string;
  client_name?: string | null;
  case_type?: string | null;
  status?: string | null;
  created_at?: string | null;
  metadata?: Record<string, unknown> | null;
}

interface AiOutputRecordForReport {
  id: string;
  document_id?: string | null;
  output_type: string;
  model_name?: string | null;
  created_at?: string | null;
  result_json?: {
    resumen?: string;
    tipo_documental_detectado?: string;
    sensibilidad_detectada?: string;
    caracteres_extraidos?: number;
  } | null;
}
interface ProfileRecordForReport {
  id: string;
  full_name?: string | null;
  email?: string | null;
  role?: string | null;
}

function getPercentage(value: number, total: number) {
  if (total <= 0) return 0;
  return Math.round((value / total) * 100);
}

function isValidView(value?: string): value is ReportView {
  return value === 'general' || value === 'gestion' || value === 'documentos' || value === 'auditoria';
}

export default async function ReportsPage({ searchParams }: ReportsPageProps) {
  const query = await searchParams;
  const activeView: ReportView = isValidView(query.vista) ? query.vista : 'general';
  const activeAuditFilter: AuditReportFilter = isAuditReportFilter(query.tipo)
    ? query.tipo
    : 'todos';

const { user, profile } = await getUserProfile();

if (!user) redirect("/login");
if (!profile) redirect("/onboarding");


if (
  activeView === "auditoria" &&
  profile.role !== "admin" &&
  profile.role !== "auditor"
) {
  redirect("/acceso-denegado");
}
  const supabase = await createClient();

  const { data: organization } = await supabase
    .from('organizations')
    .select('industry_type')
    .eq('id', profile.organization_id)
    .maybeSingle();
  const industry = normalizeIndustryType(organization?.industry_type);
  const terms = getIndustryTerms(industry);
  const isFem = terms.expedientePlural.toLowerCase() === 'operaciones';

  let cases: CaseRecord[] = [];
  let documents: DocumentRecordForReport[] = [];
  let aiOutputs: AiOutputRecordForReport[] = [];

  const PAGE_SIZE = 50;
  let currentPage = 1;

  let documentReport: Awaited<ReturnType<typeof loadDocumentReportData>> | null = null;
  let auditCounts: Awaited<ReturnType<typeof fetchAuditCounts>>['counts'] | null = null;
  let auditReport: Awaited<ReturnType<typeof buildAuditReportData>> | null = null;

  if (activeView === 'general') {
    const [casesResult, documentsResult, aiOutputsResult] = await Promise.all([
      supabase
        .from('cases')
        .select('id, status, case_type')
        .eq('organization_id', profile.organization_id)
        .order('created_at', { ascending: false }),
      supabase
        .from('documents')
        .select('id, expires_at, sensitivity_level')
        .eq('organization_id', profile.organization_id)
        .order('created_at', { ascending: false }),
      supabase
        .from('ai_outputs')
        .select('document_id, result_json')
        .eq('organization_id', profile.organization_id)
        .eq('output_type', 'document_analysis')
        .order('created_at', { ascending: false })
    ]);

    cases = (casesResult.data ?? []) as CaseRecord[];
    documents = (documentsResult.data ?? []) as DocumentRecordForReport[];
    aiOutputs = (aiOutputsResult.data ?? []) as AiOutputRecordForReport[];
  } else if (activeView === 'gestion') {
    const casesResult = await supabase
      .from('cases')
      .select('id, status, case_type')
      .eq('organization_id', profile.organization_id)
      .order('created_at', { ascending: false });

    cases = (casesResult.data ?? []) as CaseRecord[];
  } else if (activeView === 'documentos') {
    documentReport = await loadDocumentReportData(supabase, profile.organization_id);
  } else if (activeView === 'auditoria') {
    const countsResult = await fetchAuditCounts(supabase, profile.organization_id);
    auditCounts = countsResult.counts;

    const totalForFilter = auditCounts[activeAuditFilter];
    const totalValue = totalForFilter.ok ? totalForFilter.value : 0;

    const resolution = finalizeAuditRedirect(
      resolveAuditPageParam(query.pagina ?? query.page, totalValue),
      activeAuditFilter
    );

    if (resolution.action === 'redirect') {
      redirect(resolution.redirectTo);
      return null as any;
    }

    currentPage = resolution.page;
    auditReport = await buildAuditReportData(
      supabase,
      profile.organization_id,
      activeAuditFilter,
      currentPage,
      countsResult
    );
  }

  cases = cases.filter((item) =>
    isCaseTypeCompatibleWithIndustry(item.case_type, industry)
  );

  const documentsById = new Map(documents.map((document) => [document.id, document as AuditDocumentRecord]));
  const casesById = new Map(cases.map((caseItem) => [caseItem.id, caseItem]));
  const auditProfilesById = new Map(
    (auditReport?.profiles.ok ? auditReport.profiles.value : []).map((profileItem) => [profileItem.id, profileItem])
  );

  const analysisCountByDocument = new Map<string, number>();
  for (const item of aiOutputs) {
    const documentId = String(item.document_id || '');
    if (!documentId) continue;
    analysisCountByDocument.set(documentId, (analysisCountByDocument.get(documentId) ?? 0) + 1);
  }

  const totalCases = cases.length;
  const activeCases = cases.filter((item) => isCaseActive(item.status)).length;
  const terminalCases = cases.filter((item) => TERMINAL_CASE_STATUSES.includes(item.status ?? '')).length;

  const totalDocuments = documents.length;

  const analyzedDocuments = documents.filter(
    (item) => (analysisCountByDocument.get(item.id) ?? 0) > 0
  ).length;

  const coverage = getPercentage(analyzedDocuments, totalDocuments);

  const metrics = [
    {
      label: `${terms.expedientePlural} totales`,
      value: totalCases,
      helper: `Incluye ${isFem ? 'activas' : 'activos'} y ${isFem ? 'archivadas' : 'archivados'}`,
    },
    {
      label: `${terms.expedientePlural} ${isFem ? 'activas' : 'activos'}`,
      value: activeCases,
      helper: 'En proceso o preparación',
    },
    {
      label: 'Documentos totales',
      value: totalDocuments,
      helper: 'Incluye documentos activos y archivados',
    },
    {
      label: 'Cobertura IA',
      value: `${coverage}%`,
      helper: `${analyzedDocuments}/${totalDocuments} analizados`,
    },
  ];

  const views: Array<{ label: string; value: ReportView; href: string }> = [
    { label: 'General', value: 'general', href: '/reportes' },
    { label: terms.expedientePlural, value: 'gestion', href: '/reportes?vista=gestion' },
    { label: 'Documentos e IA', value: 'documentos', href: '/reportes?vista=documentos' },
    { label: 'Auditoría', value: 'auditoria', href: '/reportes?vista=auditoria' },
  ];

  const auditFilters: Array<{
    label: string;
    value: AuditReportFilter;
    href: string;
    count: { ok: boolean; value?: number };
  }> = [
    {
      label: 'Todos',
      value: 'todos',
      href: '/reportes?vista=auditoria',
      count: auditCounts?.todos ?? { ok: false },
    },
    {
      label: 'Documentos',
      value: 'documentos',
      href: '/reportes?vista=auditoria&tipo=documentos',
      count: auditCounts?.documentos ?? { ok: false },
    },
    {
      label: 'IA',
      value: 'ia',
      href: '/reportes?vista=auditoria&tipo=ia',
      count: auditCounts?.ia ?? { ok: false },
    },
    {
      label: terms.expedientePlural,
      value: 'expedientes',
      href: '/reportes?vista=auditoria&tipo=expedientes',
      count: auditCounts?.expedientes ?? { ok: false },
    },
    {
      label: 'Invitaciones',
      value: 'invitaciones',
      href: '/reportes?vista=auditoria&tipo=invitaciones',
      count: auditCounts?.invitaciones ?? { ok: false },
    },
  ];

  const caseStatuses = caseStatusesByIndustry[industry] || caseStatusesByIndustry.general;
  const casesByStatus = new Map<string, number>();
  cases.forEach((c) => {
    const s = c.status || 'new';
    casesByStatus.set(s, (casesByStatus.get(s) || 0) + 1);
  });

  return (
    <AppShell>
      <div className="mb-8 flex flex-col justify-between gap-4 xl:flex-row xl:items-end">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-400">
            Reportes
          </p>

          <h2 className="mt-2 text-3xl font-bold text-white">
            Reporte operativo del sistema
          </h2>

          <p className="mt-2 text-sm text-slate-300">
            {terms.reportesSubtitulo}
          </p>
        </div>
      </div>

      <div className="mb-6 flex flex-wrap gap-3">
        {views.map((view) => (
          <Link
            key={view.value}
            href={view.href}
            className={`rounded-xl px-4 py-2 text-sm font-bold transition-all hover:scale-[1.03] active:scale-[0.97] ${
              activeView === view.value
                ? 'bg-cyan-600 text-white shadow-lg shadow-cyan-500/20'
                : 'border border-white/10 bg-white/[0.04] text-slate-200 hover:border-cyan-400/40 hover:text-cyan-200'
            }`}
          >
            {view.label}
          </Link>
        ))}
      </div>

      {activeView === 'general' ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {metrics.map((metric, index) => (
            <MotionCard
              key={metric.label}
              index={index}
              className="p-5"
            >
              <p className="text-sm font-semibold text-slate-400">{metric.label}</p>

              <p className="mt-2 text-3xl font-bold text-white">{metric.value}</p>

              <p className="mt-3 text-xs text-slate-500">{metric.helper}</p>
            </MotionCard>
          ))}
        </div>
      ) : null}

      {activeView === 'gestion' ? (
        <div className="mt-8">
          <MotionCard index={5} className="p-6">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-400">
              Estado actual
            </p>
            <h3 className="mt-2 text-2xl font-bold text-white">
              Estado de {isFem ? 'las ' : 'los '} {terms.expedientePlural.toLowerCase()}
            </h3>
            <p className="mt-2 text-sm text-slate-300">
              Distribución actual por etapa de gestión.
            </p>

            <div className="mt-6 mb-6 grid gap-4 sm:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
                <p className="text-sm font-semibold text-slate-400">Total</p>
                <p className="mt-2 text-3xl font-bold text-white">{totalCases}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
                <p className="text-sm font-semibold text-slate-400">{isFem ? 'Activas' : 'Activos'}</p>
                <p className="mt-2 text-3xl font-bold text-emerald-400">{activeCases}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
                <p className="text-sm font-semibold text-slate-400">{getCaseStatusLabel('archived', industry)}</p>
                <p className="mt-2 text-3xl font-bold text-slate-400">{terminalCases}</p>
              </div>
            </div>

            {totalCases > 0 ? (
              <div className="mt-6 space-y-4">
                {caseStatuses.map((s) => {
                  const count = casesByStatus.get(s.value) || 0;
                  const percentage = getPercentage(count, totalCases);
                  return (
                    <div key={s.value} className="rounded-2xl bg-white/[0.04] p-4">
                      <div className="mb-2 flex justify-between text-sm">
                        <span className="font-semibold text-slate-300">{s.label}</span>
                        <span className="font-bold text-white">
                          {count} · {percentage}%
                        </span>
                      </div>
                      <div className="h-3 overflow-hidden rounded-full bg-slate-800">
                        <div
                          className="h-full rounded-full bg-cyan-500"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
                {(() => {
                  const officialStatuses = new Set(caseStatuses.map(s => s.value));
                  let otherCount = 0;
                  casesByStatus.forEach((count, status) => {
                    if (!officialStatuses.has(status)) {
                      otherCount += count;
                    }
                  });

                  if (otherCount > 0) {
                    const percentage = getPercentage(otherCount, totalCases);
                    return (
                      <div key="otros" className="rounded-2xl bg-white/[0.04] p-4">
                        <div className="mb-2 flex justify-between text-sm">
                          <span className="font-semibold text-slate-300">Otros estados históricos</span>
                          <span className="font-bold text-white">
                            {otherCount} · {percentage}%
                          </span>
                        </div>
                        <div className="h-3 overflow-hidden rounded-full bg-slate-800">
                          <div
                            className="h-full rounded-full bg-slate-500"
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                    );
                  }
                  return null;
                })()}
              </div>
            ) : (
              <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.02] p-6 text-center text-sm text-slate-500">
                No hay {terms.expedientePlural.toLowerCase()} registrados en el sistema.
              </div>
            )}
          </MotionCard>
        </div>
      ) : null}

      {activeView === 'documentos' && documentReport ? (
        <div className="mt-8">
          <DocumentReport data={documentReport} terms={terms} />
        </div>
      ) : null}



      {activeView === 'auditoria' && auditReport ? (
        <div className="mt-8">
          <AuditReportView
            data={auditReport}
            activeFilter={activeAuditFilter}
            filters={auditFilters}
            terms={terms}
            documentsById={documentsById}
            casesById={casesById}
            profilesById={auditProfilesById}
            prevHref={
              auditReport.page > 1
                ? `/reportes?vista=auditoria&tipo=${activeAuditFilter}&pagina=${auditReport.page - 1}`
                : null
            }
            nextHref={
              auditReport.page < auditReport.totalPages
                ? `/reportes?vista=auditoria&tipo=${activeAuditFilter}&pagina=${auditReport.page + 1}`
                : null
            }
          />
        </div>
      ) : null}

    </AppShell>
  );
}
