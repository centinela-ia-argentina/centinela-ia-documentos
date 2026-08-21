import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { getUserProfile } from '@/lib/auth/getUserProfile';
import { AppShell } from '@/components/layout/AppShell';
import { canManageRental, isUserRole } from '@/lib/permissions/roles';
import { normalizeIndustryType } from '@/lib/industries/documentTypes';
import { Plus, KeyRound, CalendarClock, Activity, TrendingUp } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { MotionCard } from '@/components/ui/MotionCard';
import type { RentalContract } from '@/types/rental';
import { getIndexTypeLabel, getRentalStatusLabel, calcularProximoAjuste, estadoVencimiento } from '@/lib/rentals/labels';

export default async function RentalsPage() {
  const { user, profile } = await getUserProfile();
  if (!user) redirect('/login');
  if (!profile) redirect('/onboarding');
  if (profile.role === 'client') redirect('/acceso-denegado');

  const supabase = await createClient();
  const { data: org } = await supabase
    .from('organizations')
    .select('industry_type')
    .eq('id', profile.organization_id)
    .single();

  const industry = normalizeIndustryType(org?.industry_type);
  if (industry !== 'inmobiliaria') {
    redirect('/dashboard');
  }

  const { data, error } = await supabase
    .from('rental_contracts')
    .select('*')
    .eq('organization_id', profile.organization_id)
    .is('archived_at', null)
    .order('created_at', { ascending: false });

  const rentals = (data || []) as RentalContract[];
  const canManage = isUserRole(profile.role) && canManageRental(profile.role);

  const rentalsData = rentals.map(r => {
    const proxAjuste = calcularProximoAjuste(r.start_date, r.last_adjustment_date, r.adjustment_period_months);
    const estado = estadoVencimiento(proxAjuste, r.status);
    return { ...r, proxAjuste, estado };
  });

  const vencidosCount = rentalsData.filter(r => r.estado.tipo === 'vencido').length;
  const proximosCount = rentalsData.filter(r => r.estado.tipo === 'proximo').length;
  const alDiaCount = rentalsData.filter(r => r.estado.tipo === 'al_dia').length;

  const orderMap = { vencido: 0, proximo: 1, al_dia: 2, sin_dato: 3 };
  rentalsData.sort((a, b) => {
    const diffTipo = orderMap[a.estado.tipo] - orderMap[b.estado.tipo];
    if (diffTipo !== 0) return diffTipo;
    
    if (a.proxAjuste && b.proxAjuste) {
      return a.proxAjuste.getTime() - b.proxAjuste.getTime();
    }
    return 0;
  });

  return (
    <AppShell>
      <div className="mb-8 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Radar de alquileres
          </h1>
          <p className="mt-2 text-sm text-slate-400">
            Gestioná los contratos vigentes, sus términos y próximos ajustes.
          </p>
        </div>
        {canManage && (
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/alquileres/indices"
              className="group relative inline-flex items-center gap-2 overflow-hidden rounded-xl bg-white/5 border border-white/10 px-5 py-2.5 text-sm font-bold text-white transition-all hover:bg-white/10 hover:border-white/20"
            >
              <TrendingUp className="h-4 w-4" />
              <span>Índices de ajuste</span>
            </Link>
            <Link
              href="/alquileres/nuevo"
              className="group relative inline-flex items-center gap-2 overflow-hidden rounded-xl bg-gradient-to-r from-cyan-600 to-[#1E9BF0] px-5 py-2.5 text-sm font-bold text-white shadow-lg transition-all hover:scale-105 hover:shadow-cyan-500/25"
            >
              <div className="absolute inset-0 bg-white/20 opacity-0 transition-opacity group-hover:opacity-100"></div>
              <Plus className="h-4 w-4" />
              <span>Nuevo contrato</span>
            </Link>
          </div>
        )}
      </div>

      <div className="mb-8 flex flex-wrap gap-4">
        <div className={`rounded-xl border px-4 py-2 text-sm font-bold ${vencidosCount > 0 ? 'bg-red-500/10 text-red-300 border-red-500/30' : 'bg-white/5 text-slate-500 border-white/10'}`}>
          🔴 Vencidos: {vencidosCount}
        </div>
        <div className={`rounded-xl border px-4 py-2 text-sm font-bold ${proximosCount > 0 ? 'bg-amber-500/10 text-amber-300 border-amber-500/30' : 'bg-white/5 text-slate-500 border-white/10'}`}>
          🟡 Próximos (30 días): {proximosCount}
        </div>
        <div className={`rounded-xl border px-4 py-2 text-sm font-bold ${alDiaCount > 0 ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30' : 'bg-white/5 text-slate-500 border-white/10'}`}>
          🟢 Al día: {alDiaCount}
        </div>
      </div>

      {rentalsData.length === 0 ? (
        <div className="flex min-h-[400px] flex-col items-center justify-center rounded-3xl border border-dashed border-white/10 bg-white/[0.02] px-6 py-12 text-center">
          <div className="mb-4 rounded-full bg-cyan-500/10 p-4">
            <KeyRound className="h-8 w-8 text-cyan-400" />
          </div>
          <h3 className="mb-2 font-display text-xl font-bold text-white">No hay alquileres registrados</h3>
          <p className="mb-6 max-w-sm text-sm text-slate-400">
            Mantené un seguimiento de los contratos, vencimientos y actualizaciones de alquiler.
          </p>
          {canManage && (
            <Link
              href="/alquileres/nuevo"
              className="inline-flex items-center gap-2 rounded-xl bg-white/5 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-white/10"
            >
              <Plus className="h-4 w-4" />
              <span>Registrar primer alquiler</span>
            </Link>
          )}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rentalsData.map((rental) => {
            return (
              <MotionCard key={rental.id}>
                <Link
                  href={`/alquileres/${rental.id}`}
                  className={`group flex h-full flex-col rounded-3xl border border-white/5 bg-white/[0.02] p-6 transition-all hover:border-cyan-500/30 hover:bg-white/[0.04] ${rental.status !== 'vigente' ? 'opacity-60' : ''}`}
                >
                  <div className="mb-4 flex items-start justify-between gap-4">
                    <h3 className="font-display text-lg font-bold text-white group-hover:text-cyan-400 transition-colors line-clamp-2">
                      {rental.tenant_name || 'Contrato sin inquilino asignado'}
                    </h3>
                    <Badge tone={rental.status === 'vigente' ? 'success' : 'neutral'}>
                      {getRentalStatusLabel(rental.status)}
                    </Badge>
                  </div>

                  <div className="mb-4 flex flex-col gap-1">
                    <span className="text-2xl font-bold text-white">
                      {rental.currency === 'USD' ? 'u$s' : '$'}
                      {rental.current_amount ? rental.current_amount.toLocaleString('es-AR') : '0'}
                    </span>
                    <span className="text-xs text-slate-400">Monto actual</span>
                  </div>

                  <div className="mt-auto space-y-3 border-t border-white/5 pt-4">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-500">Índice</span>
                      <span className="font-medium text-slate-300">
                        {getIndexTypeLabel(rental.index_type)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-500">Ajuste</span>
                      <span className="font-medium text-slate-300">
                        Cada {rental.adjustment_period_months || '-'} meses
                      </span>
                    </div>
                    
                    {rental.proxAjuste && (
                      <div className="flex flex-col gap-2 rounded-lg bg-white/5 px-3 py-2 text-sm">
                        <div className="flex items-center justify-between">
                          <span className="flex items-center gap-1.5 text-slate-400">
                            <CalendarClock className="h-4 w-4" />
                            Próximo ajuste
                          </span>
                          <span className="font-bold text-slate-300">
                            {rental.proxAjuste.toLocaleDateString('es-AR')}
                          </span>
                        </div>
                        {rental.estado.tipo === 'vencido' && (
                          <div className="rounded border border-red-500/30 bg-red-500/10 px-2 py-1 text-xs font-bold text-red-300">
                            ⚠️ {rental.estado.label}
                          </div>
                        )}
                        {rental.estado.tipo === 'proximo' && (
                          <div className="rounded border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-xs font-bold text-amber-300">
                            ⏰ {rental.estado.label}
                          </div>
                        )}
                        {rental.estado.tipo === 'al_dia' && (
                          <div className="rounded border border-emerald-500/20 bg-emerald-500/5 px-2 py-1 text-xs font-semibold text-emerald-400">
                            ✓ {rental.estado.label}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </Link>
              </MotionCard>
            );
          })}
        </div>
      )}
    </AppShell>
  );
}
