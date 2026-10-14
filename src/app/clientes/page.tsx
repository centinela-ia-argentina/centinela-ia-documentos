import { redirect } from 'next/navigation';
import { UsersThree, UserCircle, WarningCircle, ArrowCounterClockwise } from '@phosphor-icons/react/dist/ssr';
import { AppShell } from '@/components/layout/AppShell';
import { createClient } from '@/lib/supabase/server';
import { getUserProfile } from '@/lib/auth/getUserProfile';
import { canManageClient, isUserRole } from '@/lib/permissions/roles';
import { AppButton, AppButtonLink } from '@/components/ui/AppButton';
import { Surface } from '@/components/ui/Surface';
import { Eyebrow, PageTitle, SupportingCopy } from '@/components/ui/Typography';
import type { ClientRecord } from '@/types/client';
import { ClienteCard } from './ClienteCard';
import styles from './Clientes.module.css';

export default async function ClientesPage() {
  const { user, profile } = await getUserProfile();
  if (!user) redirect('/login');
  if (!profile) redirect('/onboarding');
  if (profile.role === 'client') redirect('/acceso-denegado');

  const supabase = await createClient();
  const { data: clientsData, error } = await supabase
    .from('clients')
    .select('*')
    .eq('organization_id', profile.organization_id)
    .is('archived_at', null)
    .order('created_at', { ascending: false });

  const clients = (clientsData ?? []) as ClientRecord[];
  const canManage = isUserRole(profile.role) && canManageClient(profile.role);

  return (
    <AppShell>
      <div className={styles.page}>
        <Eyebrow className={styles.eyebrow}><UsersThree size={20} weight="duotone" aria-hidden="true" />Cartera de clientes</Eyebrow>
        <header className={styles.header}>
          <div><PageTitle className={styles.pageTitle}>Clientes e interesados</PageTitle><SupportingCopy variant="hero" className={styles.heroCopy}>Gestioná la cartera de clientes y sus criterios de búsqueda.</SupportingCopy></div>
          {canManage && <AppButtonLink href="/clientes/nuevo" className={styles.primary}><UserCircle size={20} weight="duotone" aria-hidden="true" />Nuevo cliente</AppButtonLink>}
        </header>
        {error ? (
          <Surface family="panel" className={`${styles.state} ${styles.error}`}>
            <div className={styles.stateContent}><span className={styles.stateIcon}><WarningCircle size={32} weight="duotone" aria-hidden="true" /></span>
              <h2>No se pudo cargar la cartera</h2><p>No podemos confirmar si hay clientes registrados. Volvé a intentar cargar el listado.</p>
              {/* A read-only GET retries the server query without reusing a cached client navigation. */}
              <form action="/clientes" method="get"><AppButton type="submit" variant="secondary" className={styles.retry}><ArrowCounterClockwise size={20} weight="duotone" aria-hidden="true" />Reintentar</AppButton></form>
            </div>
          </Surface>
        ) : clients.length > 0 ? (
          <section className={styles.grid} aria-label="Cartera de clientes">{clients.map(client => <ClienteCard key={client.id} client={client} />)}</section>
        ) : (
          <Surface family="panel" className={styles.state}>
            <div className={styles.stateContent}><span className={styles.stateIcon}><UsersThree size={32} weight="duotone" aria-hidden="true" /></span>
              <h2>Aún no tenés clientes registrados</h2><p>Comenzá cargando tu primer cliente para organizar la cartera y sus criterios de búsqueda.</p>
              {canManage && <AppButtonLink href="/clientes/nuevo" className={styles.primary}><UserCircle size={20} weight="duotone" aria-hidden="true" />Cargar primer cliente</AppButtonLink>}
            </div>
          </Surface>
        )}
      </div>
    </AppShell>
  );
}
