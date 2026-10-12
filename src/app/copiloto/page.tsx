import { redirect } from 'next/navigation';
import { Buildings, House, FolderOpen, Users, Key, ArrowUpRight, Info } from '@phosphor-icons/react/dist/ssr';
import { createClient } from '@/lib/supabase/server';
import { getUserProfile } from '@/lib/auth/getUserProfile';
import { AppShell } from '@/components/layout/AppShell';
import { getStrictIndustry } from '@/lib/auth/getStrictIndustry';
import { canUseAi } from '@/lib/permissions/roles';
import { calcularProximoAjuste, estadoVencimiento } from '@/lib/rentals/labels';
import { AppButtonLink } from '@/components/ui/AppButton';
import { Surface } from '@/components/ui/Surface';
import { Eyebrow, PageTitle, SectionTitle, SupportingCopy } from '@/components/ui/Typography';
import type { RentalContract } from '@/types/rental';
import { CopilotoClient } from './CopilotoClient';
import styles from './Copiloto.module.css';

export default async function CopilotoPage() {
  const { user, profile } = await getUserProfile();
  if (!user) redirect('/login');
  if (!profile) redirect('/onboarding');
  if (profile.role === 'client') redirect('/acceso-denegado');

  let industry: string;
  try {
    industry = await getStrictIndustry();
  } catch {
    redirect('/dashboard');
  }
  if (industry !== 'inmobiliaria') redirect('/dashboard');

  const supabase = await createClient();
  const orgId = profile.organization_id;
  const [propsRes, casesRes, clientsRes, rentalsRes] = await Promise.all([
    supabase.from('properties').select('id').eq('organization_id', orgId).is('archived_at', null),
    supabase.from('cases').select('id').eq('organization_id', orgId),
    supabase.from('clients').select('id').eq('organization_id', orgId).is('archived_at', null),
    supabase.from('rental_contracts').select('*').eq('organization_id', orgId).is('archived_at', null),
  ]);

  const rentals = (rentalsRes.data || []) as RentalContract[];
  const rentalEstados = rentals.map((r) =>
    estadoVencimiento(calcularProximoAjuste(r.start_date, r.last_adjustment_date, r.adjustment_period_months), r.status)
  );
  // Preserve the published query scope; an unavailable response is not an empty portfolio.
  const stats = {
    propiedades: propsRes.error || propsRes.data == null ? null : propsRes.data.length,
    operaciones: casesRes.error || casesRes.data == null ? null : casesRes.data.length,
    clientes: clientsRes.error || clientsRes.data == null ? null : clientsRes.data.length,
    alquileres: rentalsRes.error || rentalsRes.data == null ? null : rentals.length,
    ajustesVencidos: rentalsRes.error || rentalsRes.data == null ? null : rentalEstados.filter((e) => e.tipo === 'vencido').length,
    ajustesProximos: rentalsRes.error || rentalsRes.data == null ? null : rentalEstados.filter((e) => e.tipo === 'proximo').length,
  };
  const metrics = [
    { label: 'Propiedades', value: stats.propiedades, scope: 'Sin archivadas', href: '/propiedades', icon: House },
    { label: 'Operaciones', value: stats.operaciones, scope: 'Todos los estados', href: '/operaciones', icon: FolderOpen },
    { label: 'Clientes', value: stats.clientes, scope: 'Sin archivados', href: '/clientes', icon: Users },
    { label: 'Alquileres', value: stats.alquileres, scope: 'Sin archivados', href: '/alquileres', icon: Key },
  ];

  return (
    <AppShell>
      <div className={styles.page}>
        <header className={styles.hero}>
          <Eyebrow className={styles.sector}><Buildings size={17} aria-hidden="true" /> Cartera / Gestión inmobiliaria</Eyebrow>
          <PageTitle>Panel inmobiliario</PageTitle>
          <SupportingCopy variant="hero" className={styles.heroCopy}>Una mirada al conjunto. Un punto concreto para continuar.</SupportingCopy>
        </header>
        <section className={styles.metrics} aria-label="Contexto de cartera">
          {metrics.map(({ label, value, scope, href, icon: Icon }) => (
            <div key={label} className={styles.metric}>
              <div className={styles.metricLabel}>{label}<Icon size={19} aria-hidden="true" /></div>
              <div className={styles.metricValue}>{value === null ? <span className={styles.unavailable}>No disponible</span> : value}</div>
              <p className={styles.metricScope}>{value === null ? 'No pudimos cargar este recuento.' : scope}</p>
              <AppButtonLink href={href} variant="ghost" className={styles.metricLink}>Ver {label.toLowerCase()}<ArrowUpRight size={15} aria-hidden="true" /></AppButtonLink>
            </div>
          ))}
        </section>
        <section className={styles.adjustments} aria-labelledby="rental-adjustments-title">
          <Eyebrow>Revisión de contratos</Eyebrow>
          <SectionTitle id="rental-adjustments-title" className={styles.adjustmentTitle}>Ajustes de alquiler</SectionTitle>
          <SupportingCopy className={styles.sectionCopy}>Fechas de actualización de contratos vigentes. No representan deuda ni falta de pago.</SupportingCopy>
          <div className={styles.adjustmentSignals}>
            <Surface family="row" className={styles.signal}>
              <span className={styles.signalNumber}>{stats.ajustesVencidos === null ? '—' : stats.ajustesVencidos}</span>
              <div><h3>Ajustes vencidos</h3><p>{stats.ajustesVencidos === null ? 'Recuento no disponible' : 'Fecha de ajuste anterior a hoy'}</p></div>
            </Surface>
            <Surface family="row" className={styles.signal}>
              <span className={styles.signalNumber}>{stats.ajustesProximos === null ? '—' : stats.ajustesProximos}</span>
              <div><h3>Ajustes próximos</h3><p>{stats.ajustesProximos === null ? 'Recuento no disponible' : 'Hasta 30 días, incluido hoy'}</p></div>
            </Surface>
          </div>
          {stats.alquileres === null && <p role="status" className={styles.loadNotice}>No pudimos cargar los alquileres ni clasificar sus ajustes.</p>}
          <div className={styles.adjustmentFooter}>
            <p>Revisá los contratos y sus condiciones en el módulo Alquileres.</p>
            <AppButtonLink href="/alquileres" variant="secondary">Ver alquileres<ArrowUpRight size={17} aria-hidden="true" /></AppButtonLink>
          </div>
        </section>
        <div className={styles.scopeNote}><Info size={19} aria-hidden="true" /><p>Los datos y las acciones se gestionan en cada módulo. Para consultar documentos de una operación, abrila y usá su agente contextual.</p></div>
        <CopilotoClient canUsePortfolioAi={canUseAi(profile.role)} />
      </div>
    </AppShell>
  );
}
