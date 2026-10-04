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
  const rawCurrency = String(item.metadata?.moneda_operacion ?? '').trim();
  const currency = (rawCurrency || 'USD').toUpperCase();
  if (!amount) return null;

  const numericAmount = Number(amount);
  const formattedAmount = Number.isFinite(numericAmount)
    ? new Intl.NumberFormat('es-AR', { maximumFractionDigits: 2 }).format(numericAmount)
    : amount;

  const currencyLabel =
    currency === 'USD' ? 'US$' : currency === 'ARS' ? 'AR$' : currency;

  return `${currencyLabel} ${formattedAmount}`;
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
      <section className="relative overflow-hidden border-b border-[#85E4D4]/15 pb-10 pt-3 sm:pb-12 sm:pt-6">
        <span
          className="pointer-events-none absolute -right-4 -top-16 select-none font-display text-[clamp(7rem,18vw,17rem)] font-black leading-none tracking-[-0.075em] text-white/[0.025] [-webkit-text-stroke:1px_rgba(243,248,245,0.04)]"
          aria-hidden="true"
        >
          ANULUS
        </span>
        <div className="relative max-w-4xl">
          <p className="font-ui text-sm font-semibold tracking-[-0.02em] text-[#85E4D4]">
            <LocalDateLabel />
          </p>
          <h1
            data-testid="dashboard-title"
            className="mt-3 font-display text-[clamp(2.45rem,5vw,4.75rem)] font-medium leading-[0.98] tracking-[-0.06em] text-[#F3F8F5]"
          >
            <TimeAwareGreeting name={greetingName} />
          </h1>
          <p
            className="mt-5 max-w-2xl font-ui text-base font-medium leading-7 sm:text-lg"
            style={{ color: '#B8C6C1' }}
          >
            Controlá operaciones, documentos y próximos pasos desde un mismo lugar.
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

      <section
        aria-label="Indicadores operativos"
        className="grid border-b border-[#85E4D4]/15 sm:grid-cols-2 xl:grid-cols-4"
      >
        {metrics.map((metric, index) => (
          <article
            key={metric.label}
            className={`px-5 py-6 sm:px-6 ${index > 0 ? 'border-t border-[#85E4D4]/15 sm:border-l sm:border-t-0' : ''} ${index === 2 ? 'sm:border-t xl:border-t-0' : ''}`}
          >
            <p className="font-ui text-[13px] font-semibold tracking-[-0.025em] text-[#B8C6C1]">
              {metric.label}
            </p>
            <p className="mt-1.5 font-display text-[2rem] font-semibold leading-none tracking-[-0.055em] text-[#F3F8F5]">
              {metric.value}
            </p>
            <p className="mt-2 font-ui text-[11px] font-medium text-[#71857F]">
              {metric.helper}
            </p>
          </article>
        ))}
      </section>

      <section className="mt-8 overflow-hidden rounded-[30px] border border-white/10 bg-[#081A22] shadow-[0_26px_80px_rgba(0,0,0,0.22)]">
        <div className="flex flex-col gap-6 px-6 py-7 sm:px-8 lg:flex-row lg:items-end lg:justify-between lg:px-10 lg:py-9">
          <div className="max-w-2xl">
            <p className="font-ui text-xs font-semibold text-[#85E4D4]">Seguimiento operativo</p>
            <h2 className="mt-2 font-display text-3xl font-medium tracking-[-0.05em] text-[#F3F8F5] sm:text-4xl">
              {isRealEstate ? 'Operaciones en curso' : `${terms.expedientePlural} en curso`}
            </h2>
            <p className="mt-3 font-ui text-sm leading-6 text-[#9FB0AB]">
              Estado, actividad reciente y próximo hito de cada registro activo.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <span className="rounded-full border border-white/15 px-3 py-1.5 text-xs font-semibold text-[#D7E2DE]">
                {activeCases.length} activas
              </span>
              <span className="rounded-full border border-white/15 px-3 py-1.5 text-xs font-semibold text-[#D7E2DE]">
                {pendingDocuments.length + expiringDocuments} pendientes
              </span>
            </div>
          </div>
          <Link
            href={operationBasePath}
            className="group inline-flex min-h-12 w-fit items-center gap-3 rounded-full bg-[#F3F8F5] px-5 font-ui text-sm font-bold text-[#071110] transition-[transform,box-shadow] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] hover:-translate-y-0.5 hover:shadow-[0_0_0_1px_rgba(200,255,98,0.3),0_0_26px_rgba(200,255,98,0.24)] active:translate-y-0 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C8FF62]"
          >
            Ver todas las operaciones
            <ArrowRight size={17} weight="bold" className="transition-transform duration-150 group-hover:translate-x-0.5" />
          </Link>
        </div>

        <div className="grid border-t border-white/10 lg:grid-cols-2">
          <article
            aria-label="Listado de operaciones en curso"
            className="px-5 py-3 sm:px-8 lg:py-5"
          >
            {activeCases.length ? (
              <div className="divide-y divide-white/10">
                {activeCases.slice(0, 5).map((item) => {
                  const date = String(item.metadata?.fecha_relevante ?? '').trim();
                  return (
                    <Link
                      key={item.id}
                      href={`${operationBasePath}/${item.id}`}
                      className="group grid gap-3 py-5 transition-colors duration-150 hover:text-white sm:grid-cols-[minmax(0,1fr)_132px_104px] sm:items-center sm:gap-3"
                    >
                      <span className="min-w-0">
                        <span className="line-clamp-2 font-ui text-sm font-bold leading-5 text-[#EDF4F1] group-hover:text-white">
                          {item.title || terms.itemSinTitulo}
                        </span>
                        <span className="mt-1 block truncate font-ui text-[11px] text-[#80948D]">
                          {item.case_type || 'General'}{item.client_name ? ` · ${item.client_name}` : ''}
                        </span>
                      </span>
                      <span className="inline-flex min-h-8 w-[132px] items-center justify-center gap-2 rounded-lg border border-[#85E4D4]/25 bg-[linear-gradient(135deg,rgba(133,228,212,0.11),rgba(133,228,212,0.035))] px-3 font-ui text-[10px] font-bold tracking-[-0.01em] text-[#9AF0E2] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                        <span className="h-1.5 w-1.5 rotate-45 bg-[#85E4D4]" aria-hidden="true" />
                        {getCaseStatusLabel(item.status, industry)}
                      </span>
                      <span className="font-display text-left text-sm font-semibold tabular-nums tracking-[-0.025em] text-[#F3F8F5] sm:text-right">
                        {operationValue(item) || (date ? formatRelevantDate(date) : 'Ver detalle')}
                      </span>
                    </Link>
                  );
                })}
              </div>
            ) : (
              <div className="py-14 text-center">
                <p className="font-ui text-sm font-semibold text-[#D7E2DE]">{terms.vacioSinDatos}</p>
                <Link
                  href={`${operationBasePath}/nuevo`}
                  className="mt-3 inline-flex items-center gap-1 font-ui text-sm font-bold text-[#C8FF62]"
                >
                  {terms.nuevoCta} <ArrowRight size={16} weight="bold" />
                </Link>
              </div>
            )}
          </article>

          <aside className="border-t border-white/10 p-5 sm:p-7 lg:border-l lg:border-t-0 lg:p-8">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-ui text-xs font-semibold text-[#85E4D4]">Prioridad del día</p>
                <h3 className="mt-1 font-display text-2xl font-medium tracking-[-0.04em] text-[#F3F8F5]">
                  Para resolver ahora
                </h3>
                <p className="mt-2 font-ui text-xs leading-5 text-[#91A39F]">
                  Tareas ordenadas por urgencia e impacto.
                </p>
              </div>
              <CalendarDots size={20} weight="light" className="mt-1 shrink-0 text-[#85E4D4]" />
            </div>

            <div className="mt-5 divide-y divide-white/10 border-t border-white/10">
              {nextActions.length ? nextActions.map((action, index) => (
                <Link
                  key={`${action.href}-${index}`}
                  href={action.href}
                  className="group grid grid-cols-[24px_1fr] gap-3 py-4"
                >
                  <span className="pt-0.5 font-ui text-[10px] font-bold text-[#85E4D4]">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <span>
                    <span className="block font-ui text-xs font-bold text-[#E5EEEA] group-hover:text-white">
                      {action.title}
                    </span>
                    <span className="mt-1 block font-ui text-[10px] text-[#7F938D]">
                      {action.detail}
                    </span>
                  </span>
                </Link>
              )) : (
                <p className="py-6 font-ui text-xs text-[#91A39F]">
                  No hay acciones urgentes. El panorama está al día.
                </p>
              )}
            </div>
          </aside>
        </div>
      </section>
    </AppShell>
  );
}
