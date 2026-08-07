import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AppShell } from '@/components/layout/AppShell';
import { createClient } from '@/lib/supabase/server';
import { getUserProfile } from '@/lib/auth/getUserProfile';
import { MotionCard } from '@/components/ui/MotionCard';
import { MotionButton } from '@/components/ui/MotionButton';
import { Badge } from '@/components/ui/Badge';
import { getPropertyStatusLabel, getPropertyTypeLabel } from '@/lib/properties/labels';
import { canManageProperty, isUserRole } from '@/lib/permissions/roles';
import type { PropertyRecord } from '@/types/property';
import { Building2, ArrowRight } from 'lucide-react';

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
      <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-400/80">
            INMOBILIARIA
          </p>

          <h2 className="mt-2 font-display text-3xl font-semibold tracking-tight text-gradient">
            Cartera de propiedades
          </h2>

          <p className="mt-2 text-sm text-slate-400">
            Inventario activo de propiedades disponibles y gestionadas.
          </p>
        </div>

        {canManage && (
          <Link href="/propiedades/nueva">
            <MotionButton className="bg-gradient-to-r from-accent to-brandviolet text-white">
              + Nueva propiedad
            </MotionButton>
          </Link>
        )}
      </div>

      {records.length > 0 ? (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {records.map((item, i) => (
            <Link key={item.id} href={`/propiedades/${item.id}`} className="block h-full">
              <MotionCard index={i} className="group flex h-full flex-col justify-between cursor-pointer">
                <div>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <Badge tone={item.status === 'disponible' ? 'success' : item.status === 'reservada' ? 'warning' : 'neutral'}>
                      {getPropertyStatusLabel(item.status)}
                    </Badge>
                    <span className="rounded-full bg-white/5 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-slate-400 max-w-full truncate min-w-0 flex-shrink">
                      {getPropertyTypeLabel(item.property_type)}
                    </span>
                  </div>

                  <h3 className="mt-4 font-display text-lg font-semibold text-white group-hover:text-cyan-400">
                    {item.name || 'Propiedad sin nombre'}
                  </h3>

                  <div className="mt-3 flex items-center gap-2 text-sm text-slate-400">
                    <Building2 className="h-4 w-4 shrink-0 text-slate-500" />
                    <span className="truncate">{item.address || 'Sin dirección cargada'}</span>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-sm">
                    {item.price != null && (
                      <div className="font-bold text-white">
                        {item.currency === 'USD' ? 'u$s' : '$'} {item.price.toLocaleString('es-AR')}
                      </div>
                    )}
                    {item.surface_total_m2 != null && (
                      <div className="text-slate-400">
                        {item.surface_total_m2} m² totales
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-6 flex justify-end">
                  <ArrowRight className="h-4 w-4 text-cyan-400 opacity-0 transition-transform group-hover:translate-x-1 group-hover:opacity-100" />
                </div>
              </MotionCard>
            </Link>
          ))}
        </div>
      ) : (
        <div className="rounded-3xl border border-white/5 bg-white/[0.02] p-12 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-cyan-500/10">
            <Building2 className="h-8 w-8 text-cyan-400" />
          </div>
          <h3 className="mt-6 font-display text-xl font-semibold text-white">
            Todavía no cargaste propiedades…
          </h3>
          <p className="mt-2 text-sm text-slate-400 max-w-md mx-auto">
            Mantené organizada tu cartera sumando propiedades. Podrás gestionar su estado, valor y datos técnicos.
          </p>
          {canManage && (
            <div className="mt-8">
              <Link href="/propiedades/nueva">
                <button className="rounded-2xl border border-white/10 bg-white/5 px-6 py-3 font-bold text-white transition-colors hover:bg-white/10">
                  Cargar primera propiedad
                </button>
              </Link>
            </div>
          )}
        </div>
      )}
    </AppShell>
  );
}
