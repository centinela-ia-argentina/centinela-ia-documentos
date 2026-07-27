import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getUserProfile } from '@/lib/auth/getUserProfile';
import { AppShell } from '@/components/layout/AppShell';
import { normalizeIndustryType } from '@/lib/industries/documentTypes';
import { calcularProximoAjuste, estadoVencimiento } from '@/lib/rentals/labels';
import type { RentalContract } from '@/types/rental';
import { Sparkles } from 'lucide-react';
import { CopilotoClient } from './CopilotoClient';

export default async function CopilotoPage() {
  const { user, profile } = await getUserProfile();
  if (!user) redirect('/login');
  if (!profile) redirect('/onboarding');

  const supabase = await createClient();
  const { data: org } = await supabase
    .from('organizations')
    .select('industry_type')
    .eq('id', profile.organization_id)
    .single();

  const industry = normalizeIndustryType(org?.industry_type);
  if (industry !== 'inmobiliaria') redirect('/dashboard');

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

  const stats = {
    propiedades: (propsRes.data || []).length,
    operaciones: (casesRes.data || []).length,
    clientes: (clientsRes.data || []).length,
    alquileres: rentals.length,
    ajustesVencidos: rentalEstados.filter((e) => e.tipo === 'vencido').length,
    ajustesProximos: rentalEstados.filter((e) => e.tipo === 'proximo').length,
  };

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-5xl px-4 py-8">
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-gradient-to-br from-cyan-500/20 to-violet-500/20">
              <Sparkles className="h-6 w-6 text-cyan-300" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-white">Panel inmobiliario</h1>
              <p className="text-sm text-slate-400">Centro de control de operaciones inmobiliarias de tu organización: casos activos, vencimientos y alertas.</p>
            </div>
          </div>
          <div className="rounded-xl border border-cyan-500/20 bg-slate-900/50 px-4 py-2.5 text-xs text-slate-300">
            ℹ️ Este panel trabaja sobre la cartera y la actividad general de la inmobiliaria. Para consultar documentos o ejecutar acciones sobre una operación específica, abrila y usá su Agente IA.
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <StatCard label="Propiedades" value={stats.propiedades} />
          <StatCard label="Operaciones" value={stats.operaciones} />
          <StatCard label="Clientes" value={stats.clientes} />
          <StatCard label="Alquileres" value={stats.alquileres} />
          <StatCard label="Ajustes vencidos" value={stats.ajustesVencidos} accent="red" />
          <StatCard label="Ajustes próximos" value={stats.ajustesProximos} accent="amber" />
        </div>

        <div className="mt-6">
          <CopilotoClient />
        </div>
      </div>
    </AppShell>
  );
}

function StatCard({ label, value, accent }: { label: string; value: number; accent?: 'red' | 'amber' }) {
  const color = accent === 'red' ? 'text-red-300' : accent === 'amber' ? 'text-amber-300' : 'text-cyan-300';
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className={`text-2xl font-semibold ${color}`}>{value}</div>
      <div className="mt-1 text-xs text-slate-400">{label}</div>
    </div>
  );
}
