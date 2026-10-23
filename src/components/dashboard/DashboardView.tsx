import Link from 'next/link';
import { ArrowRight, ArrowUpRight, CalendarDots, FileText, WarningCircle } from '@phosphor-icons/react/ssr';
import { industryLabels, type IndustryType } from '@/lib/industries/documentTypes';
import type { IndustryTerms } from '@/lib/industries/uiLabels';
import type { DashboardCase } from '@/app/dashboard/page';
import { getCaseStatusLabel } from '@/lib/industries/caseConfig';
import { AppButtonLink } from '@/components/ui/AppButton';
import { PrimerosPasos } from './PrimerosPasos';
import { LocalDateLabel, TimeAwareGreeting } from './TimeAwareGreeting';
import styles from './Dashboard.module.css';

export function formatRelevantDate(value?: string) {
  if (!value) return 'Sin fecha definida';
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return 'Fecha por revisar';
  return new Intl.DateTimeFormat('es-AR', { day: '2-digit', month: 'short' }).format(date);
}

export function operationValue(item: DashboardCase) {
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

type Props = {
  industry: IndustryType; terms: IndustryTerms; greetingName: string;
  role: string | null; userName?: string | null;
  metrics: {label: string; value: string; helper: string}[];
  workspaces: {title: string; detail: string; href: string}[];
  activeCases: DashboardCase[]; operationBasePath: string;
  hasCase: boolean; hasDocument: boolean; hasTeam: boolean; showGettingStarted: boolean;
};
const workspaceIcons = [CalendarDots, FileText, WarningCircle];
export function DashboardView({industry, terms, greetingName, role, userName, metrics, workspaces,
  activeCases, operationBasePath, hasCase, hasDocument, hasTeam, showGettingStarted}: Props) {
  return <div className={styles.home}>
    <header className={styles.homeHead}><div>
      <p className={styles.homeDate}><LocalDateLabel /></p>
      <h1 data-testid="dashboard-title"><TimeAwareGreeting name={greetingName} /></h1>
      <p className={styles.homeIntro}>Controlá {terms.expedientePlural.toLowerCase()}, documentos y próximos pasos desde un mismo lugar.</p>
    </div><span className={styles.industryTag}>{industryLabels[industry]}</span></header>
    {showGettingStarted ? <PrimerosPasos hasCase={hasCase} hasDocument={hasDocument} hasTeam={hasTeam}
      isAdmin={role === 'admin'} userName={userName} industry={industry} /> : null}
    <section aria-label="Indicadores operativos" className={styles.metrics}>
      {metrics.map(metric => <dl className={styles.metric} key={metric.label}>
        <dt>{metric.label}</dt><dd>{metric.value}</dd><dd className={styles.metricHelper}>{metric.helper}</dd>
      </dl>)}
    </section>
    <div className={styles.homeGrid}>
      <section className={styles.work} aria-label={`Listado de ${terms.expedientePlural.toLowerCase()} en curso`}>
        <div className={styles.workHead}><div><p className={styles.eyebrow}>Seguimiento operativo</p>
          <h2>{terms.expedientePlural} en curso</h2>
          <p>Los últimos registros creados que continúan activos.</p></div>
          <AppButtonLink variant="secondary" href={operationBasePath}>Ver {terms.expedientePlural.toLowerCase()} <ArrowRight size={16} aria-hidden="true" /></AppButtonLink>
        </div>
        {activeCases.length ? <><div className={styles.recordLabels} aria-hidden="true"><span>{terms.expedienteSingular}</span><span>Estado</span><span>Referencia</span></div>
          {activeCases.slice(0,5).map(item => { const date=String(item.metadata?.fecha_relevante ?? '').trim(); return <Link
            key={item.id} href={`${operationBasePath}/${item.id}`} className={styles.record}>
            <div><strong>{item.title || terms.itemSinTitulo}</strong><small>{item.case_type || 'General'}{item.client_name ? ` · ${item.client_name}` : ''}</small></div>
            <span className={styles.status}>{getCaseStatusLabel(item.status,industry)}</span>
            <span className={styles.ref}>{operationValue(item) || (date ? formatRelevantDate(date) : 'Ver detalle')}<ArrowUpRight size={13} aria-hidden="true" /></span>
          </Link>; })}</> : <div className={styles.empty}><p>{terms.vacioSinDatos}</p>
            <AppButtonLink variant="secondary" href={`${operationBasePath}/nuevo`}>{terms.nuevoCta}<ArrowRight size={16} aria-hidden="true" /></AppButtonLink></div>}
      </section>
      <aside className={styles.shortcuts}><p className={styles.eyebrow}>Navegación operativa</p><h2>Accesos de trabajo</h2><p>Abrí la herramienta adecuada para cada tarea.</p>
        {workspaces.map((workspace,index) => {const Icon=workspaceIcons[index] ?? FileText; return <Link key={workspace.href} href={workspace.href} className={styles.shortcut}>
          <Icon size={17} aria-hidden="true" /><span><strong>{workspace.title}</strong><small>{workspace.detail}</small></span><ArrowUpRight size={13} aria-hidden="true" /></Link>;})}
      </aside>
    </div>
  </div>;
}
