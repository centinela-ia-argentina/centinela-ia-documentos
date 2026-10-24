import { redirect } from 'next/navigation';
import { Buildings, HouseLine, Plus } from '@phosphor-icons/react/dist/ssr';
import { AppShell } from '@/components/layout/AppShell';
import { createClient } from '@/lib/supabase/server';
import { getUserProfile } from '@/lib/auth/getUserProfile';
import { canManageProperty, isUserRole } from '@/lib/permissions/roles';
import type { PropertyRecord } from '@/types/property';
import { AppButtonLink } from '@/components/ui/AppButton';
import { Surface } from '@/components/ui/Surface';
import { Eyebrow, PageTitle, SupportingCopy } from '@/components/ui/Typography';
import { PropiedadCard } from './PropiedadCard';
import styles from './Propiedades.module.css';

export default async function PropiedadesPage() {
  const { user, profile } = await getUserProfile();

  if (!user) redirect('/login');
  if (!profile) redirect('/onboarding');
  if (profile.role === 'client') redirect('/acceso-denegado');

  const supabase = await createClient();

  const { data: properties } = await supabase
    .from('properties')
    .select('*')
    .eq('organization_id', profile.organization_id)
    .is('archived_at', null)
    .order('created_at', { ascending: false });

  const records = (properties ?? []) as PropertyRecord[];
  const canManage = isUserRole(profile.role) && canManageProperty(profile.role);

  return (
    <AppShell>
      <div className={styles.page}>
        <Eyebrow className={styles.eyebrow}><Buildings size={25} weight="duotone" aria-hidden="true" />Propiedades / Gestión inmobiliaria</Eyebrow>
        <header className={styles.header}>
          <div><PageTitle className={styles.pageTitle}>Cartera de propiedades</PageTitle>
            <SupportingCopy variant="hero" className={styles.heroCopy}>Consultá el estado y los datos de tu cartera.<br />Entrá en una ficha para continuar con su gestión.</SupportingCopy>
          </div>
          {canManage && <AppButtonLink href="/propiedades/nueva" className={styles.primary}><Plus size={20} aria-hidden="true" />Nueva propiedad</AppButtonLink>}
        </header>
        {records.length > 0 ? (
          <section className={styles.grid} aria-label="Cartera de propiedades">
            {records.map((property) => <PropiedadCard key={property.id} property={property} />)}
          </section>
        ) : (
          <Surface family="panel" className={styles.empty}>
            <HouseLine size={40} weight="duotone" aria-hidden="true" />
            <h2>Todavía no hay propiedades cargadas</h2>
            <p>Cuando agregues una propiedad, aparecerá acá con su estado y sus datos principales.</p>
            {canManage && <AppButtonLink href="/propiedades/nueva" className={styles.primary}><Plus size={20} aria-hidden="true" />Cargar primera propiedad</AppButtonLink>}
          </Surface>
        )}
      </div>
    </AppShell>
  );
}
