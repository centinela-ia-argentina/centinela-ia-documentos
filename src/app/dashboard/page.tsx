import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getUserProfile } from '@/lib/auth/getUserProfile';
import { createClient } from '@/lib/supabase/server';
import { AppShell } from '@/components/layout/AppShell';
import { MetricCard } from '@/components/dashboard/MetricCard';
import { Reveal } from '@/components/ui/Reveal';
import { MotionCard } from '@/components/ui/MotionCard';
import { normalizeIndustryType } from '@/lib/industries/documentTypes';
import {
  getDashboardCards,
  isCaseActive,
  type DashboardCardKey,
} from '@/lib/industries/caseConfig';
import { getIndustryTerms, type IndustryTerms } from '@/lib/industries/uiLabels';
import { isUserRole } from '@/lib/permissions/roles';
import { getDocumentExpiryStatus } from '@/lib/documents/expiry';
import { sensitivityLabel, isSensitiveDocument } from '@/lib/documents/sensitivity';
import { PrimerosPasos } from '@/components/dashboard/PrimerosPasos';

interface DashboardDocument {
  id: string;
  file_name: string;
  file_mime_type?: string | null;
  document_type?: string | null;
  sensitivity_level: string;
  created_at?: string | null;
  expires_at?: string | null;
}



function buildMetricCard(
  card: DashboardCardKey,
  values: {
    activeCases: number;
    loadedDocuments: number;
    pendingAnalysis: number;
    sensitiveDocuments: number;
    expiringDocuments: number;
    proximosPlazos?: number;
  },
  terms: IndustryTerms
) {
  switch (card) {
    case 'expedientes_activos': {
      const isFem = terms.expedientePlural.toLowerCase() === 'operaciones';
      return {
        label: `${terms.expedientePlural} ${isFem ? 'activas' : 'activos'}`,
        value: String(values.activeCases),
        helper: terms.dashboardActivesHelper,
      };
    }
    case 'proximos_plazos':
      return {
        label: 'Próximos plazos',
        value: String(values.proximosPlazos ?? 0),
        helper: terms.dashboardPlazosHelper,
        href: '/observaciones',
      };
    case 'documentos_cargados':
      return {
        label: 'Documentos cargados',
        value: String(values.loadedDocuments),
        helper: 'Bóveda privada',
      };

    case 'documentos_sensibles':
      return {
        label: 'Documentos sensibles',
        value: String(values.sensitiveDocuments),
        helper: 'Alta o crítica',
      };
    case 'documentos_por_vencer':
      return {
        label: 'Documentos por vencer',
        value: String(values.expiringDocuments),
        helper: 'Por vencer o vencidos',
      };

    default:
      return null;
  }
}

export default async function DashboardPage() {
  const { user, profile } = await getUserProfile();

  if (!user) redirect('/login');
  if (!profile) redirect('/onboarding');

  const role = isUserRole(profile.role) ? profile.role : null;

  const supabase = await createClient();

  const [
    organizationResult,
    casesResult,
    documentsResult,
    aiOutputsResult,
  ] = await Promise.all([
    supabase
      .from('organizations')
      .select('industry_type')
      .eq('id', profile.organization_id)
      .maybeSingle(),

    supabase
      .from('cases')
      .select('id, status, metadata')
      .eq('organization_id', profile.organization_id)
      .neq('status', 'archived')
      .neq('status', 'Archivado'),

    supabase
      .from('documents')
      .select('id, file_name, file_mime_type, document_type, sensitivity_level, created_at, expires_at')
      .eq('organization_id', profile.organization_id)
      .order('created_at', { ascending: false }),

    supabase
      .from('ai_outputs')
      .select('document_id')
      .eq('organization_id', profile.organization_id)
      .eq('output_type', 'document_analysis'),
  ]);

  const industry = normalizeIndustryType(organizationResult.data?.industry_type);
  const terms = getIndustryTerms(industry);
  const dashboardCards = getDashboardCards(industry);
  const cases = (casesResult.data ?? []) as any[];
  const documents = (documentsResult.data ?? []) as DashboardDocument[];
  const aiOutputs = aiOutputsResult.data ?? [];

  const activeCasesCount = cases.filter((c) => isCaseActive(c.status)).length;
  const proximosPlazos = cases.filter((c) => {
    const fecha = ((c.metadata as Record<string, unknown> | null)?.fecha_relevante as string | undefined)?.trim();
    if (!fecha) return false;
    const status = getDocumentExpiryStatus(fecha);
    return status === 'por_vencer' || status === 'vencido';
  }).length;

  const analysisCountByDocument = new Map<string, number>();

  for (const item of aiOutputs) {
    const documentId = String(item.document_id || '');
    if (!documentId) continue;

    analysisCountByDocument.set(
      documentId,
      (analysisCountByDocument.get(documentId) ?? 0) + 1
    );
  }

  const analyzedDocuments = documents.filter(
    (document) => (analysisCountByDocument.get(document.id) ?? 0) > 0
  );

  const pendingDocuments = documents.filter(
    (document) => (analysisCountByDocument.get(document.id) ?? 0) === 0
  );



  const coverage =
    documents.length > 0
      ? Math.round((analyzedDocuments.length / documents.length) * 100)
      : 0;


  const sensitiveDocuments = documents.filter((document) =>
    isSensitiveDocument(document.sensitivity_level)
  );

  const expiringDocuments = documents.filter((document) => {
    if (!document.expires_at) return false;
    const status = getDocumentExpiryStatus(document.expires_at);
    return status === 'por_vencer' || status === 'vencido';
  }).length;

  const metricCards = dashboardCards
    .map((card) =>
      buildMetricCard(card, {
        activeCases: activeCasesCount,
        loadedDocuments: documents.length,
        pendingAnalysis: pendingDocuments.length,
        sensitiveDocuments: sensitiveDocuments.length,
        expiringDocuments,
        proximosPlazos,
      }, terms)
    )
    .filter((card): card is NonNullable<typeof card> => Boolean(card));




  // Primeros pasos (home guiado)
  const { count: memberCount } = await supabase
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', profile.organization_id);

  const hasCase = cases.length > 0;
  const hasDocument = documents.length > 0;
  const hasTeam = (memberCount ?? 0) > 1;
  const isAdmin = role === 'admin';
  const showGettingStarted = !hasCase || !hasDocument;

  return (
    <AppShell>
      <MotionCard className="mb-8" index={0}>
        <p className="text-xs font-semibold uppercase tracking-widest text-cyan-400/80">INICIO</p>
        <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight text-white">
          Bienvenido, <span className="text-gradient">{profile.full_name}</span>
        </h1>
        <p className="mt-2 text-sm text-slate-400">
          {terms.dashboardSubtitulo}
        </p>

        <div className="mt-5 flex flex-wrap gap-3">
          <Link href="/expedientes/nuevo" className="quick-action">＋ {terms.nuevoCta}</Link>
          <Link href="/documentos/subir" className="quick-action">⬆ Subir documento</Link>
          <Link href="/buscar" className="quick-action">🔍 Buscar</Link>
        </div>
      </MotionCard>

      {showGettingStarted && (
        <PrimerosPasos
          hasCase={hasCase}
          hasDocument={hasDocument}
          hasTeam={hasTeam}
          isAdmin={isAdmin}
          userName={profile.full_name}
        />
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {metricCards.map((metric, i) => (
          <MetricCard key={metric.label} index={i} label={metric.label} value={metric.value} helper={metric.helper} href={metric.href} />
        ))}
      </div>

      <div className="mt-8 grid items-start gap-6 xl:grid-cols-[1fr_0.8fr]">
        <MotionCard index={1} className="flex flex-col gap-6">
          <div>
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
              <div>
                <div className="flex items-center gap-2.5">
                  <span className="h-6 w-1 rounded-full bg-gradient-to-b from-accent to-brandviolet" />
                  <h2 className="font-display text-lg font-semibold text-white">IA documental</h2>
                </div>
                <h3 className="mt-2 font-display text-2xl font-semibold text-white">
                  Cobertura de análisis
                </h3>

                <p className="mt-2 text-sm text-slate-400">
                  Seguimiento de documentos procesados y pendientes.
                </p>
              </div>

              <Link
                href="/observaciones#analisis-ia-pendientes"
                className="quick-action"
              >
                Ver pendientes
              </Link>
            </div>

            <div className="mt-6">
              <div className="mb-2 flex justify-between text-sm">
                <span className="font-semibold text-slate-400">
                  Cobertura IA
                </span>
                <span className="font-bold text-white">{coverage}%</span>
              </div>

              <div className="h-3 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.5)]"
                  style={{ width: `${coverage}%` }}
                />
              </div>
            </div>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Procesados
              </p>
              <p className="mt-2 text-2xl font-bold text-white">
                {analyzedDocuments.length}
              </p>
            </div>

            <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Pendientes
              </p>
              <p className="mt-2 text-2xl font-bold text-white">
                {pendingDocuments.length}
              </p>
            </div>
          </div>
        </MotionCard>
      </div>

    </AppShell>
  );
}
