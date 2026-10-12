import { redirect } from 'next/navigation';
import { MapTrifold, HouseLine, Handshake, UsersThree, FileText, CheckCircle, ClockCountdown, Folders, WarningCircle } from '@phosphor-icons/react/dist/ssr';
import { ArrowRight } from 'lucide-react';
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
  const now = new Date();
  const rentalEstados = rentals.map((r) =>
    estadoVencimiento(calcularProximoAjuste(r.start_date, r.last_adjustment_date, r.adjustment_period_months), r.status, now)
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
    { label: 'Propiedades', value: stats.propiedades, scope: 'Sin archivadas', href: '/propiedades', icon: HouseLine },
    { label: 'Operaciones', value: stats.operaciones, scope: 'Todos los estados', href: '/operaciones', icon: Handshake },
    { label: 'Clientes', value: stats.clientes, scope: 'Sin archivados', href: '/clientes', icon: UsersThree },
    { label: 'Alquileres', value: stats.alquileres, scope: 'Sin archivados', href: '/alquileres', icon: FileText },
  ];

  return (
    <AppShell>
      <div className={styles.page}>
        <header className={styles.hero}>
          <Eyebrow className={styles.sector}><MapTrifold size={27} weight="duotone" aria-hidden="true" /> Cartera / Gestión inmobiliaria</Eyebrow>
          <PageTitle className={styles.pageTitle}>Panel inmobiliario</PageTitle>
          <SupportingCopy variant="hero" className={styles.heroCopy}>Una mirada al conjunto. Un punto concreto para continuar.</SupportingCopy>
        </header>
        <section className={styles.metrics} aria-label="Contexto de cartera">
          {metrics.map(({ label, value, scope, href, icon: Icon }) => (
            <div key={label} className={styles.metric}>
              <div className={styles.metricLabel}><Icon size={25} weight="duotone" aria-hidden="true" />{label}</div>
              <div className={styles.metricValue}>{value === null ? <span className={styles.unavailable}>No disponible</span> : value}</div>
              <p className={styles.metricScope}>{value === null ? 'No pudimos cargar este recuento.' : scope}</p>
              <AppButtonLink href={href} className={styles.metricLink}>Ver {label.toLowerCase()}<ArrowRight size={18} strokeWidth={1.7} aria-hidden="true" /></AppButtonLink>
            </div>
          ))}
        </section>
        <section className={styles.adjustments} aria-labelledby="rental-adjustments-title">
          <div className={styles.adjustmentHeading}>
            <div><Eyebrow className={styles.adjustmentEyebrow}>Revisión de contratos</Eyebrow>
              <SectionTitle id="rental-adjustments-title" className={styles.adjustmentTitle}>Ajustes de alquiler</SectionTitle>
              <SupportingCopy className={styles.sectionCopy}>Fechas de actualización de contratos vigentes. No representan deuda ni falta de pago.</SupportingCopy>
            </div>
            <AppButtonLink href="/alquileres" className={styles.moduleAction}>Ver alquileres<ArrowRight size={18} strokeWidth={1.7} aria-hidden="true" /></AppButtonLink>
          </div>
          <div className={styles.adjustmentSignals}>
            <Surface family="row" className={styles.signal}>
              <span className={styles.signalNumber}>{stats.ajustesVencidos === null ? '—' : stats.ajustesVencidos}</span>
              <div><h3>Ajustes vencidos</h3><p>{stats.ajustesVencidos === null ? 'Recuento no disponible' : 'Fecha de ajuste anterior a hoy'}</p>
                <span className={styles.signalStatus} data-status={stats.ajustesVencidos === null ? 'unavailable' : stats.ajustesVencidos > 0 ? 'late' : 'clear'}>
                  {stats.ajustesVencidos === null || stats.ajustesVencidos > 0 ? <WarningCircle size={19} weight="duotone" aria-hidden="true" /> : <CheckCircle size={19} weight="duotone" aria-hidden="true" />}
                  {stats.ajustesVencidos === null ? 'No disponible' : stats.ajustesVencidos > 0 ? 'Para revisar' : 'Sin vencidos'}
                </span></div>
            </Surface>
            <Surface family="row" className={styles.signal}>
              <span className={styles.signalNumber}>{stats.ajustesProximos === null ? '—' : stats.ajustesProximos}</span>
              <div><h3>Ajustes próximos</h3><p>{stats.ajustesProximos === null ? 'Recuento no disponible' : 'Hasta 30 días, incluido hoy'}</p>
                <span className={styles.signalStatus} data-status={stats.ajustesProximos === null ? 'unavailable' : 'next'}>
                  <ClockCountdown size={19} weight="duotone" aria-hidden="true" />
                  {stats.ajustesProximos === null ? 'No disponible' : stats.ajustesProximos > 0 ? 'Para revisar' : 'Sin próximos'}
                </span></div>
            </Surface>
          </div>
          {stats.alquileres === null && <p role="status" className={styles.loadNotice}>No pudimos cargar los alquileres ni clasificar sus ajustes.</p>}
        </section>
        <div className={styles.scopeNote}><Folders size={22} weight="duotone" aria-hidden="true" /><p>Los datos y las acciones se gestionan en cada módulo. Para consultar documentos de una operación, abrila y usá su agente contextual.</p></div>
        <CopilotoClient canUsePortfolioAi={canUseAi(profile.role)} />
      </div>
    </AppShell>
  );
}
