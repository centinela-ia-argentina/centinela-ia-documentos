import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { ArrowLeft, User, DollarSign, Activity, FileText, CalendarClock, Building, AlertTriangle } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getUserProfile } from '@/lib/auth/getUserProfile';
import { AppShell } from '@/components/layout/AppShell';
import { FormSubmitButton } from '@/components/ui/FormSubmitButton';
import { Badge } from '@/components/ui/Badge';
import { canManageRental, isUserRole } from '@/lib/permissions/roles';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { updateRentalContract, aplicarAjusteAlquiler } from '../actions';
import type { RentalContract } from '@/types/rental';
import { getIndexTypeLabel, getRentalStatusLabel, calcularProximoAjuste } from '@/lib/rentals/labels';
import { calcularAjuste, periodoDeFecha } from '@/lib/rentals/calcularAjuste';
import { AplicarAjusteButton } from './AplicarAjusteButton';

export default async function RentalDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, profile } = await getUserProfile();

  if (!user) redirect('/login');
  if (!profile) redirect('/onboarding');
  if (profile.role === 'client') redirect('/acceso-denegado');

  const supabase = await createClient();

  const { data: rentalData, error } = await supabase
    .from('rental_contracts')
    .select('*')
    .eq('id', id)
    .eq('organization_id', profile.organization_id)
    .single();

  if (error || !rentalData) {
    notFound();
  }

  const record = rentalData as RentalContract;
  const canManage = isUserRole(profile.role) && canManageRental(profile.role);

  let propertyName = null;
  if (record.property_id) {
    const { data: propData } = await supabase
      .from('properties')
      .select('name')
      .eq('id', record.property_id)
      .single();
    if (propData) {
      propertyName = propData.name;
    }
  }

  const { data: propertiesData } = await supabase
    .from('properties')
    .select('id, name')
    .eq('organization_id', profile.organization_id)
    .is('archived_at', null)
    .order('name');

  const properties = propertiesData || [];
  
  const baseDateStr = record.last_adjustment_date || record.start_date;
  const proxAjuste = calcularProximoAjuste(record.start_date, record.last_adjustment_date, record.adjustment_period_months);

  const periodoBase = periodoDeFecha(baseDateStr);
  const periodoObjetivo = proxAjuste ? periodoDeFecha(proxAjuste.toISOString()) : '';

  let valorBase: number | null = null;
  let valorObjetivo: number | null = null;

  if (record.index_type !== 'FIJO' && periodoBase && periodoObjetivo) {
    const { data: indices } = await supabase
      .from('rent_index_values')
      .select('period, value')
      .eq('organization_id', profile.organization_id)
      .eq('index_type', record.index_type)
      .in('period', [periodoBase, periodoObjetivo]);
      
    if (indices) {
      const b = indices.find(i => i.period === periodoBase);
      const o = indices.find(i => i.period === periodoObjetivo);
      if (b) valorBase = b.value;
      if (o) valorObjetivo = o.value;
    }
  }

  let resAjuste = null;
  if (periodoBase && periodoObjetivo) {
    resAjuste = calcularAjuste({
      indexType: record.index_type,
      fixedPct: record.fixed_pct,
      montoActual: record.current_amount,
      periodoBase,
      periodoObjetivo,
      valorBase,
      valorObjetivo
    });
  }

  const inputStyle = "mt-2 w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white placeholder:text-slate-500 outline-none focus:ring-2 focus:ring-cyan-400";
  const selectStyle = "mt-2 w-full rounded-xl border border-white/10 bg-[#0C2340] px-4 py-3 text-sm text-white outline-none focus:ring-2 focus:ring-cyan-400";
  const labelStyle = "text-xs font-semibold text-slate-400";

  return (
    <AppShell>
      <div className="mb-8">
        <Link
          href="/alquileres"
          className="inline-flex items-center gap-2 text-sm font-semibold text-cyan-400 hover:text-cyan-300"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver a alquileres
        </Link>
        <div className="mt-4 flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
          <div>
            <h2 className="font-display text-3xl font-semibold tracking-tight text-white flex items-center gap-3">
              {record.tenant_name || 'Contrato sin inquilino'}
            </h2>
            <div className="mt-2 flex gap-2 items-center">
              <Badge tone={record.status === 'vigente' ? 'success' : 'neutral'}>
                {getRentalStatusLabel(record.status)}
              </Badge>
              <span className="rounded-full bg-white/5 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-slate-400">
                Alquiler
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {canManage ? (
            <div className="rounded-3xl border border-white/5 bg-white/[0.02] p-6 sm:p-8">
              <div className="mb-6">
                <h3 className="font-display text-xl font-bold text-white">Editar contrato</h3>
                <p className="mt-1 text-sm text-slate-400">Modificá los datos técnicos, montos e índices.</p>
              </div>

              <form action={updateRentalContract} className="space-y-8">
                <input type="hidden" name="rental_id" value={record.id} />
                
                <section>
                  <h4 className="mb-4 text-sm font-bold uppercase tracking-wide text-slate-500">Datos principales</h4>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="sm:col-span-2">
                      <label className={labelStyle}>Propiedad (opcional)</label>
                      <select name="property_id" defaultValue={record.property_id || ''} className={selectStyle}>
                        <option value="" className="bg-[#0C2340] text-white">Seleccionar propiedad...</option>
                        {properties.map(p => (
                          <option key={p.id} value={p.id} className="bg-[#0C2340] text-white">{p.name}</option>
                        ))}
                      </select>
                    </div>
                    
                    <div className="sm:col-span-2">
                      <label className={labelStyle}>Inquilino</label>
                      <input
                        name="tenant_name"
                        type="text"
                        defaultValue={record.tenant_name || ''}
                        className={inputStyle}
                      />
                    </div>

                    <div>
                      <label className={labelStyle}>Monto inicial del alquiler *</label>
                      <input
                        name="base_amount"
                        type="text"
                        inputMode="decimal"
                        placeholder="4,5"
                        required
                        defaultValue={record.base_amount || ''}
                        className={inputStyle}
                      />
                      <p className="mt-1 text-xs text-slate-400">Usá coma para decimales (ej: 4,5)</p>
                    </div>
                    
                    <div>
                      <label className={labelStyle}>Moneda</label>
                      <select name="currency" defaultValue={record.currency || 'ARS'} className={selectStyle}>
                        <option value="ARS" className="bg-[#0C2340] text-white">ARS ($)</option>
                        <option value="USD" className="bg-[#0C2340] text-white">USD (u$s)</option>
                      </select>
                    </div>
                  </div>
                </section>

                <section>
                  <h4 className="mb-4 text-sm font-bold uppercase tracking-wide text-slate-500">Condiciones de ajuste</h4>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className={labelStyle}>Índice de ajuste</label>
                      <select name="index_type" defaultValue={record.index_type || 'ICL'} className={selectStyle}>
                        <option value="ICL" className="bg-[#0C2340] text-white">ICL (BCRA)</option>
                        <option value="IPC" className="bg-[#0C2340] text-white">IPC (INDEC)</option>
                        <option value="CASA_PROPIA" className="bg-[#0C2340] text-white">Casa Propia</option>
                        <option value="FIJO" className="bg-[#0C2340] text-white">Porcentaje fijo</option>
                      </select>
                    </div>
                    
                    <div>
                      <label className={labelStyle}>% por período (si es fijo)</label>
                      <input
                        name="fixed_pct"
                        type="text"
                        inputMode="decimal"
                        placeholder="4,5"
                        defaultValue={record.fixed_pct || ''}
                        className={inputStyle}
                      />
                      <p className="mt-1 text-xs text-slate-400">Usá coma para decimales (ej: 4,5)</p>
                    </div>

                    <div>
                      <label className={labelStyle}>Periodicidad de ajuste (meses)</label>
                      <select name="adjustment_period_months" defaultValue={record.adjustment_period_months?.toString() || '12'} className={selectStyle}>
                        <option value="3" className="bg-[#0C2340] text-white">Cada 3 meses (Trimestral)</option>
                        <option value="4" className="bg-[#0C2340] text-white">Cada 4 meses (Cuatrimestral)</option>
                        <option value="6" className="bg-[#0C2340] text-white">Cada 6 meses (Semestral)</option>
                        <option value="12" className="bg-[#0C2340] text-white">Cada 12 meses (Anual)</option>
                      </select>
                    </div>
                  </div>
                </section>

                <section>
                  <h4 className="mb-4 text-sm font-bold uppercase tracking-wide text-slate-500">Fechas y Estado</h4>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className={labelStyle}>Inicio del contrato *</label>
                      <input
                        name="start_date"
                        type="date"
                        required
                        defaultValue={record.start_date ? record.start_date.split('T')[0] : ''}
                        className={inputStyle}
                      />
                    </div>

                    <div>
                      <label className={labelStyle}>Último ajuste (si ya tuvo)</label>
                      <input
                        name="last_adjustment_date"
                        type="date"
                        defaultValue={record.last_adjustment_date ? record.last_adjustment_date.split('T')[0] : ''}
                        className={inputStyle}
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className={labelStyle}>Estado</label>
                      <select name="status" defaultValue={record.status || 'vigente'} className={selectStyle}>
                        <option value="vigente" className="bg-[#0C2340] text-white">Vigente</option>
                        <option value="finalizado" className="bg-[#0C2340] text-white">Finalizado</option>
                      </select>
                    </div>

                    <div className="sm:col-span-2">
                      <label className={labelStyle}>Observaciones</label>
                      <textarea
                        name="notes"
                        rows={4}
                        defaultValue={record.notes || ''}
                        className={inputStyle}
                      ></textarea>
                    </div>
                  </div>
                </section>

                <div className="flex justify-end pt-4 border-t border-white/10">
                  <FormSubmitButton label="Guardar cambios" loadingLabel="Guardando..." />
                </div>
              </form>
            </div>
          ) : (
            <div className="rounded-3xl border border-white/5 bg-white/[0.02] p-8">
              <h3 className="mb-6 font-display text-xl font-bold text-white flex items-center gap-2">
                📋 Ficha del contrato
              </h3>
              <ul className="space-y-4">
                {record.property_id && propertyName && (
                  <li className="flex items-center gap-3">
                    <Building className="h-5 w-5 text-cyan-400" />
                    <span className="font-medium text-white">{propertyName}</span>
                  </li>
                )}
                {record.start_date && (
                  <li className="flex items-center gap-3">
                    <CalendarClock className="h-5 w-5 text-cyan-400" />
                    <span className="font-medium text-white">
                      Inicio: {new Date(record.start_date).toLocaleDateString('es-AR')}
                    </span>
                  </li>
                )}
                <li className="flex items-center gap-3">
                  <Activity className="h-5 w-5 text-cyan-400" />
                  <span className="font-medium text-white">
                    Índice: {getIndexTypeLabel(record.index_type)}
                  </span>
                </li>
                {record.notes && (
                  <li className="flex items-start gap-3 mt-4 pt-4 border-t border-white/5">
                    <FileText className="h-5 w-5 text-cyan-400 shrink-0" />
                    <div>
                      <p className="text-xs text-slate-500 mb-1">Observaciones</p>
                      <p className="text-sm text-white whitespace-pre-wrap">{record.notes}</p>
                    </div>
                  </li>
                )}
              </ul>
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="rounded-3xl border border-white/5 bg-gradient-to-b from-white/[0.05] to-transparent p-6">
            <h3 className="mb-4 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-slate-400">
              <DollarSign className="h-4 w-4" />
              Monto Actual
            </h3>
            <div className="text-3xl font-display font-bold text-white">
              <span className="text-xl text-slate-400 mr-1">{record.currency === 'USD' ? 'u$s' : '$'}</span>
              {record.current_amount ? record.current_amount.toLocaleString('es-AR') : '0'}
            </div>
            {record.base_amount && record.base_amount !== record.current_amount && (
              <p className="mt-2 text-xs text-slate-500">
                Monto inicial: {record.currency === 'USD' ? 'u$s' : '$'}{record.base_amount.toLocaleString('es-AR')}
              </p>
            )}
          </div>

          <div className="rounded-3xl border border-white/5 bg-white/[0.02] p-6">
            <h3 className="mb-4 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-slate-400">
              <CalendarClock className="h-4 w-4" />
              📅 Próximo ajuste
            </h3>
            {proxAjuste ? (
              <>
                <div className="text-2xl font-bold text-cyan-400 mb-2">
                  {proxAjuste.toLocaleDateString('es-AR')}
                </div>
                {resAjuste ? (
                  resAjuste.ok ? (
                    <div className="mt-4 rounded-xl border border-cyan-500/20 bg-cyan-950/30 p-4">
                      <p className="text-xs text-slate-400 mb-1">Monto sugerido</p>
                      <p className="font-display text-2xl font-bold text-white mb-2">
                        {record.currency === 'USD' ? 'u$s' : '$'}{resAjuste.montoSugerido?.toLocaleString('es-AR')}
                      </p>
                      <p className="text-xs text-cyan-200 mb-4">
                        Coeficiente: {resAjuste.coeficiente?.toFixed(4)} ({resAjuste.periodoBase} → {resAjuste.periodoObjetivo})
                      </p>
                      {canManage && (
                        <AplicarAjusteButton
                          rentalId={record.id}
                          montoLabel={`${record.currency === 'USD' ? 'u$s' : '$'}${resAjuste.montoSugerido?.toLocaleString('es-AR')}`}
                          expectedUpdatedAt={record.updated_at}
                        />
                      )}
                    </div>
                  ) : (
                    <div className="mt-4 rounded-xl border border-yellow-500/20 bg-yellow-950/30 p-4">
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="h-4 w-4 text-yellow-500 mt-0.5 shrink-0" />
                        <div>
                          <p className="text-sm text-yellow-200">{resAjuste.motivo}</p>
                          {canManage && (
                            <Link href="/alquileres/indices" className="mt-2 inline-block text-xs font-semibold text-yellow-400 hover:text-yellow-300 transition underline underline-offset-2">
                              Cargar índice faltante
                            </Link>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                ) : null}
              </>
            ) : (
              <p className="text-sm text-slate-500">Faltan datos de fecha o periodicidad para calcular.</p>
            )}
          </div>

          {record.property_id && propertyName && (
            <div className="rounded-3xl border border-white/5 bg-white/[0.02] p-6">
              <h3 className="mb-4 text-sm font-bold uppercase tracking-wider text-slate-400">
                Propiedad vinculada
              </h3>
              <Link
                href={`/propiedades/${record.property_id}`}
                className="group block rounded-xl border border-white/10 bg-[#0C2340] px-4 py-3 transition hover:border-cyan-500/50 hover:bg-cyan-500/10"
              >
                <span className="font-semibold text-white group-hover:text-cyan-400 transition-colors">
                  {propertyName}
                </span>
              </Link>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
