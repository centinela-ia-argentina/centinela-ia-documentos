import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowRight, CalendarDots } from '@phosphor-icons/react/ssr';
import { getUserProfile } from '@/lib/auth/getUserProfile';
import { createClient } from '@/lib/supabase/server';
import { AppShell } from '@/components/layout/AppShell';
import { normalizeIndustryType } from '@/lib/industries/documentTypes';
import {
  getCaseStatusLabel,
  isCaseActive,
} from '@/lib/industries/caseConfig';
import { getIndustryTerms } from '@/lib/industries/uiLabels';
import { isUserRole } from '@/lib/permissions/roles';
import { getDocumentExpiryStatus } from '@/lib/documents/expiry';
import { PrimerosPasos } from '@/components/dashboard/PrimerosPasos';
import {
  LocalDateLabel,
  TimeAwareGreeting,
} from '@/components/dashboard/TimeAwareGreeting';

interface DashboardDocument {
  id: string;
  expires_at?: string | null;
}

interface DashboardCase {
  id: string;
  title: string | null;
  client_name: string | null;
  case_type: string | null;
  status: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string | null;
}

function firstName(fullName?: string | null) {
  return fullName?.trim().split(/\s+/)[0] || 'equipo';
}

function formatRelevantDate(value?: string) {
  if (!value) return 'Sin fecha definida';
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return 'Fecha por revisar';
  return new Intl.DateTimeFormat('es-AR', { day: '2-digit', month: 'short' }).format(date);
}

function operationValue(item: DashboardCase) {
  const amount = String(item.metadata?.valor_operacion ?? '').trim();
  const currency = String(item.metadata?.moneda_operacion ?? '').trim();
  return amount ? `${currency || ''} ${amount}`.trim() : null;
}

export default async function DashboardPage() {
  const { user, profile } = await getUserProfile();

  if (!user) redirect('/login');
  if (!profile) redirect('/onboarding');

  const role = isUserRole(profile.role) ? profile.role : null;
  const supabase = await createClient();

  const [organizationResult, casesResult, documentsResult, aiOutputsResult, memberResult] =
    await Promise.all([
      supabase
        .from('organizations')
        .select('name, industry_type')
        .eq('id', profile.organization_id)
        .maybeSingle(),
      supabase
        .from('cases')
        .select('id, title, client_name, case_type, status, metadata, created_at')
        .eq('organization_id', profile.organization_id)
        .neq('status', 'archived')
        .neq('status', 'Archivado')
        .order('created_at', { ascending: false }),
      supabase
        .from('documents')
        .select('id, expires_at')
        .eq('organization_id', profile.organization_id)
        .order('created_at', { ascending: false }),
      supabase
        .from('ai_outputs')
        .select('document_id')
        .eq('organization_id', profile.organization_id)
        .eq('output_type', 'document_analysis'),
      supabase
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', profile.organization_id),
    ]);

  const industry = normalizeIndustryType(organizationResult.data?.industry_type);
  const terms = getIndustryTerms(industry);
  const cases = (casesResult.data ?? []) as DashboardCase[];
  const documents = (documentsResult.data ?? []) as DashboardDocument[];
  const aiOutputs = aiOutputsResult.data ?? [];
  const isRealEstate = industry === 'inmobiliaria';
  const profileName = profile.full_name?.trim();
  const greetingName =
    profileName && !/^inmobiliaria$/i.test(profileName)
      ? firstName(profileName)
      : organizationResult.data?.name?.trim() || firstName(profileName);
  const operationBasePath = isRealEstate ? '/operaciones' : '/expedientes';

  const activeCases = cases.filter((item) => isCaseActive(item.status));
  const relevantCases = activeCases
    .filter((item) => String(item.metadata?.fecha_relevante ?? '').trim())
    .sort((a, b) =>
      String(a.metadata?.fecha_relevante).localeCompare(
        String(b.metadata?.fecha_relevante)
      )
    );

  const analyzedDocumentIds = new Set(
    aiOutputs.map((item) => String(item.document_id || '')).filter(Boolean)
  );
  const pendingDocuments = documents.filter(
    (document) => !analyzedDocumentIds.has(document.id)
  );
  const coverage = documents.length
    ? Math.round((analyzedDocumentIds.size / documents.length) * 100)
    : 0;
  const expiringDocuments = documents.filter((document) => {
    if (!document.expires_at) return false;
    const status = getDocumentExpiryStatus(document.expires_at);
    return status === 'por_vencer' || status === 'vencido';
  }).length;

  const hasCase = cases.length > 0;
  const hasDocument = documents.length > 0;
  const showGettingStarted = !hasCase || !hasDocument;

  const metrics = [
    {
      label: `${terms.expedientePlural} ${terms.adjetivoActivos}`,
      value: String(activeCases.length).padStart(2, '0'),
      helper: activeCases.length === 1 ? '1 abierta en este momento' : `${activeCases.length} abiertas en este momento`,
    },
    {
      label: 'Documentos analizados',
      value: `${coverage}%`,
      helper: documents.length ? `${analyzedDocumentIds.size} de ${documents.length} con análisis disponible` : 'Todavía no hay documentos',
    },
    {
      label: 'Próximas fechas',
      value: String(relevantCases.length).padStart(2, '0'),
      helper: relevantCases.length ? `${relevantCases.length} hito${relevantCases.length === 1 ? '' : 's'} con fecha registrada` : 'Sin fechas próximas',
    },
    {
      label: 'Pendientes',
      value: String(pendingDocuments.length + expiringDocuments).padStart(2, '0'),
      helper: `${pendingDocuments.length} análisis y ${expiringDocuments} vencimiento${expiringDocuments === 1 ? '' : 's'}`,
    },
  ];

  const nextActions = [
    ...relevantCases.slice(0, 2).map((item) => ({
      title: item.title || terms.itemSinTitulo,
      detail: `Revisar hito · ${formatRelevantDate(String(item.metadata?.fecha_relevante ?? ''))}`,
      href: `${operationBasePath}/${item.id}`,
    })),
    ...(pendingDocuments.length
      ? [{
          title: 'Revisar análisis pendientes',
          detail: `${pendingDocuments.length} documento${pendingDocuments.length === 1 ? '' : 's'} sin procesar`,
          href: '/observaciones#analisis-ia-pendientes',
        }]
      : []),
  ].slice(0, 3);

  return (
    <AppShell>
      <section className="relative overflow-hidden border-b border-[#85E4D4]/15 pb-8 pt-2 sm:pb-10 sm:pt-5">
        <span className="pointer-events-none absolute -right-4 -top-16 select-none font-display text-[clamp(7rem,18vw,17rem)] font-black leading-none tracking-[-0.075em] text-white/[0.025] [-webkit-text-stroke:1px_rgba(243,248,245,0.035)]" aria-hidden="true">
          ANULUS
        </span>
        <div className="relative max-w-4xl">
          <p className="text-sm font-medium tracking-[-0.015em] text-[#85E4D4]">
            <LocalDateLabel />
          </p>
          <h1 data-testid="dashboard-title" className="mt-2 font-display text-[clamp(2.25rem,5vw,4.5rem)] font-semibold leading-[0.98] tracking-[-0.055em] text-[#F3F8F5]">
            <TimeAwareGreeting name={greetingName} />
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-6 text-[#B7C5C0] sm:text-base">
            Operaciones, documentos y próximos pasos en un solo lugar.
          </p>
        </div>


      </section>

      {showGettingStarted ? (
        <div className="mt-6">
          <PrimerosPasos
            hasCase={hasCase}
            hasDocument={hasDocument}
            hasTeam={(memberResult.count ?? 0) > 1}
            isAdmin={role === 'admin'}
            userName={profile.full_name}
            industry={industry}
          />
        </div>
      ) : null}

      <section aria-label="Indicadores operativos" className="grid border-b border-[#85E4D4]/15 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric, index) => (
          <article key={metric.label} className={`px-4 py-5 sm:px-5 ${index > 0 ? 'border-t border-[#85E4D4]/15 sm:border-l sm:border-t-0' : ''} ${index === 2 ? 'sm:border-t xl:border-t-0' : ''}`}>
            <p className="text-xs font-medium tracking-[-0.015em] text-[#9FB0AB]">{metric.label}</p>
            <p className="mt-1 font-display text-2xl font-bold tracking-[-0.04em] text-[#F3F8F5]">{metric.value}</p>
            <p className="mt-1 text-[10px] text-[#6F827D]">{metric.helper}</p>
          </article>
        ))}
      </section>

      <div className="mt-8 grid items-start gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.55fr)]">
        <section className="min-w-0 overflow-hidden rounded-[22px] border border-[#85E4D4]/15 bg-white/[0.018] p-1.5">
          <div className="overflow-hidden rounded-[17px] bg-[#0B1918]">
          <div className="flex items-start justify-between gap-4 border-b border-[#85E4D4]/15 px-6 py-5">
            <div>
              <h2 className="font-display text-lg font-semibold text-[#F3F8F5]">{isRealEstate ? 'Operaciones en curso' : `${terms.expedientePlural} en curso`}</h2>
              <p className="mt-1 text-xs text-[#91A39F]">Estado, actividad reciente y próximo hito.</p>
            </div>
            <Link href={operationBasePath} className="inline-flex shrink-0 items-center gap-1 text-xs font-bold text-[#85E4D4] hover:text-[#C8FF62]">
              Ver todas <ArrowRight size={14} weight="bold" />
            </Link>
          </div>

          {activeCases.length ? (
            <div className="divide-y divide-[#85E4D4]/15">
              {activeCases.slice(0, 5).map((item) => {
                const date = String(item.metadata?.fecha_relevante ?? '').trim();
                return (
                  <Link key={item.id} href={`${operationBasePath}/${item.id}`} className="grid gap-3 px-5 py-4 hover:bg-white/[0.025] sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center sm:gap-5">
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-bold text-[#EDF4F1]">{item.title || terms.itemSinTitulo}</span>
                      <span className="mt-1 block truncate text-[11px] text-[#7F938D]">{item.case_type || 'General'}{item.client_name ? ` · ${item.client_name}` : ''}</span>
                    </span>
                    <span className="w-fit rounded-full bg-[#85E4D4]/10 px-2.5 py-1 text-[10px] font-bold text-[#85E4D4]">●&nbsp; {getCaseStatusLabel(item.status, industry)}</span>
                    <span className="text-left text-xs font-semibold text-[#D7E2DE] sm:min-w-24 sm:text-right">{operationValue(item) || (date ? formatRelevantDate(date) : 'Ver detalle')}</span>
                  </Link>
                );
              })}
            </div>
          ) : (
            <div className="px-5 py-12 text-center">
              <p className="text-sm font-semibold text-[#D7E2DE]">{terms.vacioSinDatos}</p>
              <Link href={`${operationBasePath}/nuevo`} className="mt-3 inline-flex items-center gap-1 text-sm font-bold text-[#C8FF62]">{terms.nuevoCta} <ArrowRight size={16} weight="bold" /></Link>
            </div>
          )}
          </div>
        </section>

        <div>
          <section className="rounded-[22px] border border-[#85E4D4]/15 bg-white/[0.018] p-1.5">
            <div className="rounded-[17px] bg-[#0B1918] p-5 sm:p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-display text-lg font-semibold text-[#F3F8F5]">Para resolver ahora</h2>
                <p className="mt-1 text-xs text-[#91A39F]">Tareas ordenadas por urgencia e impacto.</p>
              </div>
              <CalendarDots size={18} weight="regular" className="text-[#85E4D4]" />
            </div>
            <div className="mt-4 divide-y divide-[#85E4D4]/15 border-t border-[#85E4D4]/15">
              {nextActions.length ? nextActions.map((action, index) => (
                <Link key={`${action.href}-${index}`} href={action.href} className="grid grid-cols-[22px_1fr] gap-3 py-3.5 hover:text-[#C8FF62]">
                  <span className="pt-0.5 text-[10px] font-bold text-[#85E4D4]">{String(index + 1).padStart(2, '0')}</span>
                  <span>
                    <span className="block text-xs font-bold text-[#E5EEEA]">{action.title}</span>
                    <span className="mt-1 block text-[10px] text-[#7F938D]">{action.detail}</span>
                  </span>
                </Link>
              )) : (
                <p className="py-6 text-xs text-[#91A39F]">No hay acciones urgentes. El panorama está al día.</p>
              )}
            </div>
            </div>
          </section>
        </div>
      </div>
    </AppShell>
  );
}
