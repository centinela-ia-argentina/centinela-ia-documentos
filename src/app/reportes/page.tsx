import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AppShell } from '@/components/layout/AppShell';
import { createClient } from '@/lib/supabase/server';
import { getUserProfile } from '@/lib/auth/getUserProfile';
import { formatAuditActionLabel, formatResourceTypeLabel } from '@/lib/audit/actionLabels';
import { normalizeIndustryType, industryLabels } from '@/lib/industries/documentTypes';
import { getCaseStatusLabel, isCaseActive, caseStatusesByIndustry } from '@/lib/industries/caseConfig';
import { getIndustryTerms, type IndustryTerms } from '@/lib/industries/uiLabels';
import { getDocumentExpiryStatus } from '@/lib/documents/expiry';
import { MotionCard } from '@/components/ui/MotionCard';

type ReportView = 'general' | 'gestion' | 'documentos' | 'auditoria';

type AuditFilter = 'todos' | 'documentos' | 'ia' | 'expedientes' | 'invitaciones';

interface ReportsPageProps {
  searchParams: Promise<{ vista?: string; tipo?: string }>;
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

interface DocumentRecordForReport {
  id: string;
  file_name: string;
  document_type?: string | null;
  sensitivity_level: string;
  file_size?: number | null;
  file_mime_type?: string | null;
  created_at?: string | null;
  expires_at?: string | null;
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

interface AuditLogRecordForReport {
  id: string;
  organization_id?: string | null;
  user_id?: string | null;
  action: string;
  resource_type?: string | null;
  resource_id?: string | null;
  created_at?: string | null;
  metadata?: Record<string, unknown> | null;
}

interface ProfileRecordForReport {
  id: string;
  full_name?: string | null;
  email?: string | null;
  role?: string | null;
}

function formatDate(value?: string | null) {
  if (!value) return '-';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return '-';

  return new Intl.DateTimeFormat('es-AR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date);
}

function formatExpiryDate(value?: string | null) {
  if (!value) return '-';
  const parts = value.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return value;
}

function sensitivityLabel(value?: string | null) {
  const labels: Record<string, string> = {
    low: 'Bajo',
    medium: 'Medio',
    high: 'Alto',
    critical: 'Crítico',
    bajo: 'Bajo',
    medio: 'Medio',
    alto: 'Alto',
    critico: 'Crítico',
    crítico: 'Crítico',
  };

  return labels[String(value ?? '').toLowerCase()] ?? value ?? 'No definida';
}

function sensitivityRank(value?: string | null) {
  const normalized = String(value ?? '').toLowerCase();

  if (normalized === 'critical' || normalized === 'critico' || normalized === 'crítico') {
    return 4;
  }

  if (normalized === 'high' || normalized === 'alto') return 3;
  if (normalized === 'medium' || normalized === 'medio') return 2;
  if (normalized === 'low' || normalized === 'bajo') return 1;

  return 0;
}

function statusLabel(value?: string | null) {
  return getCaseStatusLabel(value);
}

function invitationStatusLabel(value?: string | null) {
  const labels: Record<string, string> = {
    pending: 'Pendiente',
    accepted: 'Aceptada',
    cancelled: 'Cancelada',
    expired: 'Vencida',
  };

  return labels[value ?? ''] ?? value ?? 'Sin estado';
}

function invitationStatusTone(value?: string | null, isExpired?: boolean | null) {
  if (isExpired || value === 'expired') return 'bg-amber-50 text-amber-700';
  if (value === 'accepted') return 'bg-emerald-50 text-emerald-700';
  if (value === 'cancelled') return 'bg-rose-50 text-rose-700';
  if (value === 'pending') return 'bg-sky-50 text-sky-700';

  return 'bg-slate-100 text-slate-600';
}

function invitationRoleLabel(value?: string | null) {
  const labels: Record<string, string> = {
    admin: 'Administrador',
    employee: 'Operador',
    auditor: 'Auditor',
    client: 'Cliente',
  };

  return labels[value ?? ''] ?? value ?? 'Sin rol';
}

function actionDotTone(value: string) {
  if (value.includes('cancel')) {
    return 'bg-rose-500';
  }

  if (value.includes('updated') || value.includes('status')) {
    return 'bg-slate-400';
  }

  if (
    value.includes('created') ||
    value.includes('accepted') ||
    value.includes('uploaded') ||
    value.includes('authorized') ||
    value.includes('autoriz')
  ) {
    return 'bg-emerald-400';
  }

  if (value.includes('viewed') || value.includes('access') || value.includes('analyzed')) {
    return 'bg-sky-400';
  }

  return 'bg-slate-400';
}

function getPercentage(value: number, total: number) {
  if (total <= 0) return 0;
  return Math.round((value / total) * 100);
}

function getMetricValue(value?: number | null) {
  return value ?? 0;
}

function getAnalysisCountByDocument(aiOutputs: AiOutputRecordForReport[]) {
  const map = new Map<string, number>();

  for (const item of aiOutputs) {
    const documentId = String(item.document_id || '');
    if (!documentId) continue;

    map.set(documentId, (map.get(documentId) ?? 0) + 1);
  }

  return map;
}



function isValidView(value?: string): value is ReportView {
  return value === 'general' || value === 'gestion' || value === 'documentos' || value === 'auditoria';
}

function isValidAuditFilter(value?: string): value is AuditFilter {
  return (
    value === 'todos' ||
    value === 'documentos' ||
    value === 'ia' ||
    value === 'expedientes' ||
    value === 'invitaciones'
  );
}

function uniqueDocuments(documents: DocumentRecordForReport[]) {
  const map = new Map<string, DocumentRecordForReport>();

  for (const document of documents) {
    map.set(document.id, document);
  }

  return Array.from(map.values());
}

function metadataText(
  metadata: Record<string, unknown> | null | undefined,
  key: string
) {
  const value = metadata?.[key];

  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  if (typeof value === 'boolean') return value ? 'Sí' : 'No';

  return null;
}

function getActorLabel(
  log: AuditLogRecordForReport,
  profilesById: Map<string, ProfileRecordForReport>
) {
  if (!log.user_id) return 'Sistema';

  const profile = profilesById.get(log.user_id);

  if (profile?.full_name) return profile.full_name;
  if (profile?.email) return profile.email;

  return `Usuario ${log.user_id.slice(0, 8)}...`;
}

function getActorRole(
  log: AuditLogRecordForReport,
  profilesById: Map<string, ProfileRecordForReport>
) {
  if (!log.user_id) return 'Automático';

  const profile = profilesById.get(log.user_id);

  if (profile?.role) return profile.role;

  return 'Usuario';
}

function getResourceLabel(
  log: AuditLogRecordForReport,
  documentsById: Map<string, DocumentRecordForReport>,
  casesById: Map<string, CaseRecord>,
  terms?: IndustryTerms
) {
  const metadataFileName = metadataText(log.metadata, 'file_name');
  const metadataCaseTitle = metadataText(log.metadata, 'case_title');
  const metadataTitle = metadataText(log.metadata, 'title');
  const metadataEmail =
    metadataText(log.metadata, 'email') ??
    metadataText(log.metadata, 'invitation_email') ??
    metadataText(log.metadata, 'invited_email');

  if (metadataFileName) return metadataFileName;
  if (metadataCaseTitle) return metadataCaseTitle;
  if (metadataTitle) return metadataTitle;

  if (
    log.resource_type === 'user_invitation' ||
    log.resource_type === 'invitation' ||
    log.action.includes('invitation') ||
    log.action.includes('invitacion')
  ) {
    return metadataEmail ?? 'Invitación de usuario';
  }

  if (log.resource_type === 'document' && log.resource_id) {
    return (
      documentsById.get(log.resource_id)?.file_name ??
      `Documento ${log.resource_id.slice(0, 8)}...`
    );
  }

  if (log.resource_type === 'case' && log.resource_id) {
    return (
      casesById.get(log.resource_id)?.title ??
      `${terms ? terms.expedienteSingular : 'Expediente'} ${log.resource_id.slice(0, 8)}...`
    );
  }

  if (log.resource_type === 'organization') return 'Organización';

  return formatResourceTypeLabel(log.resource_type, terms);
}

function getAuditDetail(log: AuditLogRecordForReport) {
  const details: string[] = [];

  const model = metadataText(log.metadata, 'model');
  const outputType = metadataText(log.metadata, 'output_type');
  const statusFrom = metadataText(log.metadata, 'from');
  const statusTo = metadataText(log.metadata, 'to');
  const documentType = metadataText(log.metadata, 'document_type');
  const sensitivity = metadataText(log.metadata, 'sensitivity');
  const fileName = metadataText(log.metadata, 'file_name');
  const invitedEmail =
    metadataText(log.metadata, 'email') ??
    metadataText(log.metadata, 'invitation_email') ??
    metadataText(log.metadata, 'invited_email');
  const invitedRole = metadataText(log.metadata, 'role');
  const invitationStatus = metadataText(log.metadata, 'status');

  if (model) details.push(`Modelo: ${model}`);
  if (outputType) details.push(`Salida: ${outputType}`);
  if (statusFrom || statusTo) {
    if (log.action === 'organization_industry_updated') {
      const fromLabel = statusFrom ? (industryLabels[normalizeIndustryType(statusFrom)] || statusFrom) : '-';
      const toLabel = statusTo ? (industryLabels[normalizeIndustryType(statusTo)] || statusTo) : '-';
      details.push(`Rubro: ${fromLabel} → ${toLabel}`);
    } else {
      details.push(`Estado: ${statusFrom ?? '-'} → ${statusTo ?? '-'}`);
    }
  }
  if (documentType) details.push(`Tipo: ${documentType}`);
  if (sensitivity) details.push(`Sensibilidad: ${sensitivityLabel(sensitivity)}`);
  if (fileName && !details.some((item) => item.includes(fileName))) {
    details.push(`Archivo: ${fileName}`);
  }
  if (invitedEmail) details.push(`Invitado: ${invitedEmail}`);
  if (invitedRole) details.push(`Rol: ${invitationRoleLabel(invitedRole)}`);
  if (invitationStatus) details.push(`Estado: ${invitationStatusLabel(invitationStatus)}`);

  if (details.length === 0) return 'Sin detalle adicional registrado.';

  return details.slice(0, 3).join(' · ');
}

function isDocumentAudit(log: AuditLogRecordForReport) {
  return log.resource_type === 'document' || log.action.startsWith('document_');
}

function isAiAudit(log: AuditLogRecordForReport) {
  return (
    log.action.includes('analyzed') ||
    metadataText(log.metadata, 'output_type') === 'document_analysis'
  );
}

function isCaseAudit(log: AuditLogRecordForReport) {
  return log.resource_type === 'case' || log.action.startsWith('case_');
}

function isInvitationAudit(log: AuditLogRecordForReport) {
  return (
    log.resource_type === 'user_invitation' ||
    log.resource_type === 'invitation' ||
    log.action.includes('invitation') ||
    log.action.includes('invitacion')
  );
}

function filterAuditLogs(logs: AuditLogRecordForReport[], filter: AuditFilter) {
  if (filter === 'documentos') return logs.filter(isDocumentAudit);
  if (filter === 'ia') return logs.filter(isAiAudit);
  if (filter === 'expedientes') return logs.filter(isCaseAudit);
  if (filter === 'invitaciones') return logs.filter(isInvitationAudit);

  return logs;
}

export default async function ReportsPage({ searchParams }: ReportsPageProps) {
  const query = await searchParams;
  const activeView: ReportView = isValidView(query.vista) ? query.vista : 'general';
  const activeAuditFilter: AuditFilter = isValidAuditFilter(query.tipo)
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

  const [
    casesResult,
    documentsResult,
    aiOutputsResult,
    auditLogsResult,
    profilesResult,
  ] = await Promise.all([
    supabase
      .from('cases')
      .select('id, title, client_name, case_type, status, created_at, metadata')
      .eq('organization_id', profile.organization_id)
      .order('created_at', { ascending: false }),

    supabase
      .from('documents')
      .select(
        'id, file_name, document_type, sensitivity_level, file_size, file_mime_type, created_at, expires_at'
      )
      .eq('organization_id', profile.organization_id)
      .order('created_at', { ascending: false }),

    supabase
      .from('ai_outputs')
      .select('id, document_id, output_type, model_name, result_json, created_at')
      .eq('organization_id', profile.organization_id)
      .eq('output_type', 'document_analysis')
      .order('created_at', { ascending: false }),

    supabase
      .from('audit_logs')
      .select(
        'id, organization_id, user_id, action, resource_type, resource_id, metadata, created_at'
      )
      .eq('organization_id', profile.organization_id)
      .order('created_at', { ascending: false })
      .limit(80),

    supabase
      .from('profiles')
      .select('id, full_name, email, role')
      .eq('organization_id', profile.organization_id),
  ]);

  const cases = (casesResult.data ?? []) as CaseRecord[];
  const documents = (documentsResult.data ?? []) as DocumentRecordForReport[];
  const aiOutputs = (aiOutputsResult.data ?? []) as AiOutputRecordForReport[];
  const auditLogs = (auditLogsResult.data ?? []) as AuditLogRecordForReport[];
  const profiles = (profilesResult.data ?? []) as ProfileRecordForReport[];

  const documentsById = new Map(documents.map((document) => [document.id, document]));
  const casesById = new Map(cases.map((caseItem) => [caseItem.id, caseItem]));
  const profilesById = new Map(
    profiles.map((profileItem) => [profileItem.id, profileItem])
  );

  const analysisCountByDocument = getAnalysisCountByDocument(aiOutputs);

  const totalCases = cases.length;
  const activeCases = cases.filter((item) => isCaseActive(item.status)).length;

  const totalDocuments = documents.length;

  const analyzedDocumentsList = documents.filter(
    (item) => (analysisCountByDocument.get(item.id) ?? 0) > 0
  );

  const pendingDocumentsList = documents.filter(
    (item) => (analysisCountByDocument.get(item.id) ?? 0) === 0
  );

  const analyzedDocuments = analyzedDocumentsList.length;
  const pendingDocuments = pendingDocumentsList.length;

  const coverage = getPercentage(analyzedDocuments, totalDocuments);

  const documentAuditLogs = auditLogs.filter(isDocumentAudit);
  const iaAuditLogs = auditLogs.filter(isAiAudit);
  const caseAuditLogs = auditLogs.filter(isCaseAudit);
  const invitationAuditLogs = auditLogs.filter(isInvitationAudit);
  const filteredAuditLogs = filterAuditLogs(auditLogs, activeAuditFilter);

  const auditedUsers = new Set(auditLogs.map((log) => log.user_id).filter(Boolean)).size;

  let vigentes = 0;
  let porVencer = 0;
  let vencidos = 0;
  let sinVencimiento = 0;

  documents.forEach((doc) => {
    if (!doc.expires_at) {
      sinVencimiento++;
      return;
    }
    const status = getDocumentExpiryStatus(doc.expires_at);
    if (status === 'vigente') vigentes++;
    else if (status === 'por_vencer') porVencer++;
    else if (status === 'vencido') vencidos++;
  });

  const sensitivityStats = [
    {
      key: 'low',
      label: 'Bajo',
      value: documents.filter((item) => sensitivityRank(item.sensitivity_level) === 1).length,
      className: 'bg-emerald-500',
    },
    {
      key: 'medium',
      label: 'Medio',
      value: documents.filter((item) => sensitivityRank(item.sensitivity_level) === 2)
        .length,
      className: 'bg-sky-500',
    },
    {
      key: 'high',
      label: 'Alto',
      value: documents.filter((item) => sensitivityRank(item.sensitivity_level) === 3)
        .length,
      className: 'bg-amber-500',
    },
    {
      key: 'critical',
      label: 'Crítico',
      value: documents.filter((item) => sensitivityRank(item.sensitivity_level) === 4)
        .length,
      className: 'bg-rose-500',
    },
  ];

  const metrics = [
    {
      label: `${terms.expedientePlural} totales`,
      value: totalCases,
      helper: `${activeCases} ${isFem ? 'activas' : 'activos'}`,
    },
    {
      label: `${terms.expedientePlural} ${isFem ? 'activas' : 'activos'}`,
      value: activeCases,
      helper: 'En proceso o preparación',
    },
    {
      label: 'Documentos cargados',
      value: totalDocuments,
      helper: 'En todo el sistema',
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
    value: AuditFilter;
    href: string;
    count: number;
  }> = [
    {
      label: 'Todos',
      value: 'todos',
      href: '/reportes?vista=auditoria',
      count: auditLogs.length,
    },
    {
      label: 'Documentos',
      value: 'documentos',
      href: '/reportes?vista=auditoria&tipo=documentos',
      count: documentAuditLogs.length,
    },
    {
      label: 'IA',
      value: 'ia',
      href: '/reportes?vista=auditoria&tipo=ia',
      count: iaAuditLogs.length,
    },
    {
      label: terms.expedientePlural,
      value: 'expedientes',
      href: '/reportes?vista=auditoria&tipo=expedientes',
      count: caseAuditLogs.length,
    },
    {
      label: 'Invitaciones',
      value: 'invitaciones',
      href: '/reportes?vista=auditoria&tipo=invitaciones',
      count: invitationAuditLogs.length,
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
                <p className="text-sm font-semibold text-slate-400">{isFem ? 'Archivadas / Inactivas' : 'Archivados / Inactivos'}</p>
                <p className="mt-2 text-3xl font-bold text-slate-400">{totalCases - activeCases}</p>
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
              </div>
            ) : (
              <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.02] p-6 text-center text-sm text-slate-500">
                No hay {terms.expedientePlural.toLowerCase()} registrados en el sistema.
              </div>
            )}
          </MotionCard>
        </div>
      ) : null}

      {activeView === 'documentos' ? (
        <div className="mt-8">
          <MotionCard index={7} className="p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-400">
                  Cobertura IA
                </p>

                <h3 className="mt-2 text-2xl font-bold text-white">
                  Estado del análisis documental
                </h3>

                <p className="mt-2 text-sm text-slate-300">
                  Medición de documentos analizados y pendientes.
                </p>
              </div>

              <span className="rounded-full bg-cyan-950 px-4 py-2 text-sm font-bold text-cyan-300">
                {coverage}%
              </span>
            </div>

            <div className="mt-6">
              <div className="mb-2 flex justify-between text-sm">
                <span className="font-semibold text-slate-400">
                  Progreso de cobertura
                </span>
                <span className="font-bold text-white">
                  {analyzedDocuments}/{totalDocuments}
                </span>
              </div>

              <div className="h-4 overflow-hidden rounded-full bg-slate-800">
                <div
                  className="h-full rounded-full bg-cyan-500"
                  style={{ width: `${coverage}%` }}
                />
              </div>
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl bg-white/[0.04] p-4">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                  Analizados
                </p>
                <p className="mt-2 text-2xl font-bold text-white">
                  {analyzedDocuments}
                </p>
              </div>

              <div className="rounded-2xl bg-white/[0.04] p-4">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                  Pendientes
                </p>
                <p className="mt-2 text-2xl font-bold text-white">
                  {pendingDocuments}
                </p>
              </div>
            </div>

            <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.02] p-4">
              <p className="font-bold text-slate-300">
                Cobertura de documentos procesados por IA.
              </p>
              <p className="mt-1 text-sm text-slate-400">
                Muestra la relación entre los documentos totales del sistema y aquellos que ya cuentan con un análisis estructural completo.
              </p>
            </div>
          </MotionCard>
        </div>
      ) : null}

      {activeView === 'documentos' ? (
        <>
          <MotionCard index={9} className="mt-8 p-6">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-400">
            Sensibilidad
          </p>

          <h3 className="mt-2 text-2xl font-bold text-white">
            Distribución documental
          </h3>

          <p className="mt-2 text-sm text-slate-300">
            Clasificación de documentos según sensibilidad asignada.
          </p>

          <div className="mt-6 grid gap-5 xl:grid-cols-4">
            {sensitivityStats.map((item) => {
              const percentage = getPercentage(item.value, totalDocuments);

              return (
                <div key={item.key} className="rounded-2xl bg-white/[0.04] p-4">
                  <div className="mb-3 flex justify-between text-sm">
                    <span className="font-semibold text-slate-300">{item.label}</span>
                    <span className="font-bold text-white">
                      {item.value} · {percentage}%
                    </span>
                  </div>

                  <div className="h-3 overflow-hidden rounded-full bg-slate-800">
                    <div
                      className={`h-full rounded-full ${item.className}`}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.02] p-4">
            <p className="font-bold text-slate-300">
              Distribución actual según sensibilidad asignada.
            </p>
            <p className="mt-1 text-sm text-slate-400">
              Muestra la proporción de documentos categorizados por su nivel de riesgo y exposición de datos.
            </p>
          </div>
        </MotionCard>
          <MotionCard index={10} className="p-6">
            <div className="mb-5 flex flex-col justify-between gap-4 xl:flex-row xl:items-start">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-400">
                  Vencimientos
                </p>
                <h3 className="mt-2 text-2xl font-bold text-white">
                  Estado actual de las vigencias documentales
                </h3>
                <p className="mt-2 text-sm text-slate-300">
                  Seguimiento de documentos vigentes, por vencer y vencidos en entorno controlado.
                </p>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
                <p className="text-sm font-semibold text-slate-400">Vencidos</p>
                <p className="mt-2 text-3xl font-bold text-rose-400">{vencidos}</p>
                <p className="mt-3 text-xs text-slate-500">Documentos expirados</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
                <p className="text-sm font-semibold text-slate-400">Por vencer</p>
                <p className="mt-2 text-3xl font-bold text-amber-400">{porVencer}</p>
                <p className="mt-3 text-xs text-slate-500">Próximos 30 días</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
                <p className="text-sm font-semibold text-slate-400">Vigentes</p>
                <p className="mt-2 text-3xl font-bold text-emerald-400">{vigentes}</p>
                <p className="mt-3 text-xs text-slate-500">En regla</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
                <p className="text-sm font-semibold text-slate-400">Sin fecha</p>
                <p className="mt-2 text-3xl font-bold text-white">{sinVencimiento}</p>
                <p className="mt-3 text-xs text-slate-500">No aplica o no cargada</p>
              </div>
            </div>
          </MotionCard>
        </>
      ) : null}



      {activeView === 'auditoria' ? (
        <MotionCard index={11} className="mt-8 p-6">
          <div className="mb-6 flex flex-col justify-between gap-4 xl:flex-row xl:items-start">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-400">
                Trazabilidad
              </p>

              <h3 className="mt-2 text-2xl font-bold text-white">
                Centro de auditoría operativa
              </h3>

              <p className="mt-2 text-sm text-slate-300">
                Control de acciones registradas por usuario, recurso, evento y fecha.
              </p>
            </div>

            <span className="rounded-full bg-white/[0.04] px-4 py-2 text-sm font-bold text-slate-300">
              {auditLogs.length} eventos totales
            </span>
          </div>

          <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            <div className="rounded-2xl bg-white/[0.04] p-4">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                Eventos auditados
              </p>
              <p className="mt-2 text-3xl font-bold text-white">
                {auditLogs.length}
              </p>
            </div>

            <div className="rounded-2xl bg-white/[0.04] p-4">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                Eventos documentales
              </p>
              <p className="mt-2 text-3xl font-bold text-white">
                {documentAuditLogs.length}
              </p>
            </div>

            <div className="rounded-2xl bg-white/[0.04] p-4">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                Eventos IA
              </p>
              <p className="mt-2 text-3xl font-bold text-white">
                {iaAuditLogs.length}
              </p>
            </div>

            <div className="rounded-2xl bg-white/[0.04] p-4">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                Invitaciones
              </p>
              <p className="mt-2 text-3xl font-bold text-white">
                {invitationAuditLogs.length}
              </p>
            </div>

            <div className="rounded-2xl bg-white/[0.04] p-4">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                Usuarios detectados
              </p>
              <p className="mt-2 text-3xl font-bold text-white">
                {auditedUsers}
              </p>
            </div>
          </div>

          <div className="mb-6 flex flex-wrap gap-3">
            {auditFilters.map((filter) => (
              <Link
                key={filter.value}
                href={filter.href}
                className={`rounded-xl px-4 py-2 text-sm font-bold transition-all ${
                  activeAuditFilter === filter.value
                    ? 'bg-cyan-600 text-white'
                    : 'border border-white/10 bg-white/[0.04] text-slate-200 hover:bg-white/[0.08]'
                }`}
              >
                {filter.label} · {filter.count}
              </Link>
            ))}
          </div>

          <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04]">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-white/10 bg-white/[0.02] text-xs uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="w-72 px-4 py-3">Evento</th>
                  <th className="px-4 py-3">Usuario</th>
                  <th className="px-4 py-3">Recurso</th>
                  <th className="px-4 py-3">Detalle</th>
                  <th className="px-4 py-3">Fecha</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-white/5">
                {filteredAuditLogs.map((log) => (
                  <tr key={log.id} className="align-top hover:bg-white/[0.02]">
                    <td className="px-4 py-4 align-middle">
                      <span className="inline-flex items-center gap-2 whitespace-nowrap text-xs font-bold text-slate-200">
                        <span
                          className={`h-2.5 w-2.5 shrink-0 rounded-full ${actionDotTone(
                            log.action
                          )}`}
                        />
                        {formatAuditActionLabel(log.action)}
                      </span>

                    </td>

                    <td className="px-4 py-4">
                      <p className="font-bold text-white">
                        {getActorLabel(log, profilesById)}
                      </p>

                      <p className="mt-1 text-xs text-slate-500">
                        {getActorRole(log, profilesById)}
                      </p>
                    </td>

                    <td className="px-4 py-4">
                      <p className="font-semibold text-slate-200">
                        {getResourceLabel(log, documentsById, casesById, terms)}
                      </p>

                    </td>

                    <td className="px-4 py-4 text-slate-300 break-words whitespace-normal max-w-[200px] sm:max-w-[300px]">
                      {getAuditDetail(log)}
                    </td>

                    <td className="px-4 py-4 text-slate-500">
                      {formatDate(log.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {filteredAuditLogs.length === 0 ? (
              <div className="p-6 text-sm text-slate-500">
                No hay eventos para este filtro de auditoría.
              </div>
            ) : null}
          </div>
        </MotionCard>
      ) : null}


    </AppShell>
  );
}
