import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { AppShell } from '@/components/layout/AppShell';
import { createClient } from '@/lib/supabase/server';
import { getUserProfile } from '@/lib/auth/getUserProfile';
import { canManageClient } from '@/lib/permissions/roles';
import { updateClientRecord } from '../actions';
import { ArrowLeft, User, Phone, Mail, FileText, Search, MapPin, DollarSign, Home } from 'lucide-react';
import { FormSubmitButton } from '@/components/ui/FormSubmitButton';
import { Badge } from '@/components/ui/Badge';
import { getClientStatusLabel, getClientTypeLabel, getOperationInterestLabel, getDesiredPropertyTypeLabel } from '@/lib/clients/labels';
import type { ClientRecord } from '@/types/client';
import type { PropertyRecord } from '@/types/property';
import { evaluarMatch, ordenarPorMatch } from '@/lib/matching/match';
import { canUseAi } from '@/lib/permissions/roles';
import { ClientMatchAiButton } from './ClientMatchAiButton';

export default async function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, profile } = await getUserProfile();

  if (!user) redirect('/login');
  if (!profile) redirect('/onboarding');
  if (profile.role === 'client') redirect('/acceso-denegado');

  const supabase = await createClient();

  const { data: clientData, error } = await supabase
    .from('clients')
    .select('*')
    .eq('id', id)
    .eq('organization_id', profile.organization_id)
    .single();

  if (error || !clientData) {
    notFound();
  }

  const record = clientData as ClientRecord;
  const canManage = canManageClient(profile.role);

  // MATCHING FLEXIBLE: Buscar propiedades que encajen
  const { data: propertiesData } = await supabase
    .from('properties')
    .select('*')
    .eq('organization_id', profile.organization_id)
    .is('archived_at', null)
    .eq('status', 'disponible');

  const properties = (propertiesData || []) as PropertyRecord[];
  
  const matches = properties
    .map(p => ({ item: p, match: evaluarMatch(record, p) }))
    .filter(m => m.match.elegible);
  
  const sortedMatches = ordenarPorMatch(matches);

  const darkOptionStyle = { backgroundColor: '#0C2340', color: '#FFFFFF' };
  const inputStyle = "mt-2 w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-white placeholder:text-slate-500 outline-none focus:ring-2 focus:ring-cyan-400";
  const selectStyle = "mt-2 w-full rounded-2xl border border-white/10 bg-[#0C2340] px-4 py-3 text-white outline-none focus:ring-2 focus:ring-cyan-400";
  const labelStyle = "text-sm font-semibold text-slate-400";

  return (
    <AppShell>
      <div className="mb-8">
        <Link
          href="/clientes"
          className="inline-flex items-center gap-2 text-sm font-semibold text-cyan-400 hover:text-cyan-300"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver a clientes
        </Link>
        <div className="mt-4 flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
          <div>
            <h2 className="font-display text-3xl font-semibold tracking-tight text-white flex items-center gap-3">
              {record.name}
            </h2>
            <div className="mt-2 flex gap-2 items-center">
              <Badge tone={record.status === 'activo' ? 'success' : record.status === 'en_seguimiento' ? 'warning' : 'neutral'}>
                {getClientStatusLabel(record.status)}
              </Badge>
              <span className="rounded-full bg-white/5 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-slate-400">
                {getClientTypeLabel(record.client_type)}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-3xl border border-white/5 bg-white/[0.02] p-8">
          <h3 className="mb-6 font-display text-xl font-bold text-white flex items-center gap-2">
            👤 Datos de contacto
          </h3>
          <ul className="space-y-4">
            {record.phone && (
              <li className="flex items-center gap-3">
                <Phone className="h-5 w-5 text-cyan-400" />
                <span className="font-medium text-white">{record.phone}</span>
              </li>
            )}
            {record.email && (
              <li className="flex items-center gap-3">
                <Mail className="h-5 w-5 text-cyan-400" />
                <span className="font-medium text-white">{record.email}</span>
              </li>
            )}
            <li className="flex items-start gap-3 mt-4 pt-4 border-t border-white/5">
              <FileText className="h-5 w-5 text-cyan-400 shrink-0" />
              <div>
                <p className="text-xs text-slate-500 mb-1">Notas</p>
                <p className="text-sm text-white whitespace-pre-wrap">{record.notes || 'Sin observaciones'}</p>
              </div>
            </li>
          </ul>
        </div>

        <div className="rounded-3xl border border-white/5 bg-white/[0.02] p-8">
          <h3 className="mb-6 font-display text-xl font-bold text-white flex items-center gap-2">
            🔎 Qué busca
          </h3>
          <ul className="space-y-4">
            <li className="flex items-center gap-3">
              <Search className="h-5 w-5 text-cyan-400" />
              <span className="font-medium text-white">
                Operación: {getOperationInterestLabel(record.operation_interest)}
              </span>
            </li>
            <li className="flex items-center gap-3">
              <Home className="h-5 w-5 text-cyan-400" />
              <span className="font-medium text-white">
                Tipo: {getDesiredPropertyTypeLabel(record.desired_property_type)}
              </span>
            </li>
            <li className="flex items-center gap-3">
              <MapPin className="h-5 w-5 text-cyan-400" />
              <span className="font-medium text-white">
                Zona: {record.zone || 'Cualquiera'}
              </span>
            </li>
            <li className="flex items-center gap-3">
              <DollarSign className="h-5 w-5 text-cyan-400" />
              <span className="font-medium text-white">
                Presupuesto: {record.budget_min ? `${record.currency === 'USD' ? 'u$s' : '$'}${record.budget_min.toLocaleString('es-AR')}` : '0'} 
                {record.budget_max ? ` - ${record.currency === 'USD' ? 'u$s' : '$'}${record.budget_max.toLocaleString('es-AR')}` : ' sin límite'}
              </span>
            </li>
            {record.min_rooms && (
              <li className="flex items-center gap-3">
                <span className="text-cyan-400 font-bold px-1.5">{record.min_rooms}+</span>
                <span className="font-medium text-white">
                  Ambientes mínimos
                </span>
              </li>
            )}
          </ul>
        </div>
      </div>

      <div className="mt-8 rounded-3xl border border-white/5 bg-white/[0.02] p-8">
        <h3 className="mb-6 font-display text-xl font-bold text-white flex items-center gap-2">
          🏠 Propiedades que encajan con su búsqueda
        </h3>

        {canUseAi(profile.role) && sortedMatches.length > 0 && (
          <ClientMatchAiButton clientId={id} />
        )}

        
        {sortedMatches.length > 0 ? (
          <ul className="space-y-4">
            {sortedMatches.map(({ item: p, match }) => (
              <li key={p.id}>
                <Link
                  href={`/propiedades/${p.id}`}
                  className="group block rounded-2xl border border-white/10 bg-[#0C2340] p-5 transition hover:border-cyan-500/50 hover:bg-cyan-500/10 outline-none"
                >
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <h4 className="font-display text-lg font-bold text-white group-hover:text-cyan-400 transition-colors">
                        {p.name}
                      </h4>
                      <p className="mt-1 text-sm font-medium text-slate-300">
                        {p.price != null ? `${p.currency === 'USD' ? 'u$s' : '$'}${p.price.toLocaleString('es-AR')}` : 'Sin precio'}
                        {p.surface_total_m2 ? ` · ${p.surface_total_m2} m²` : ''}
                      </p>
                    </div>
                    <Badge tone={match.coincidencias === match.aplicables && match.aplicables > 0 ? 'success' : match.coincidencias > 0 ? 'warning' : 'neutral'}>
                      {match.coincidencias}/{match.aplicables} criterios
                    </Badge>
                  </div>
                  
                  {match.aplicables > 0 && (
                    <div className="mt-4 flex flex-wrap gap-2 pt-4 border-t border-white/5">
                      {match.criterios.filter(c => c.aplica).map(c => (
                        <span 
                          key={c.key} 
                          className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold uppercase tracking-wider ${
                            c.cumple 
                              ? 'bg-green-500/10 text-green-400 border border-green-500/20' 
                              : 'bg-white/5 text-slate-500 border border-white/10 line-through decoration-slate-500/50'
                          }`}
                        >
                          {c.cumple ? '✓' : '✗'} {c.label}
                        </span>
                      ))}
                    </div>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <div className="rounded-2xl border border-dashed border-white/10 p-8 text-center">
            <p className="text-sm text-slate-400">
              No hay propiedades disponibles para cruzar todavía.
            </p>
          </div>
        )}
      </div>

      {canManage && (
        <details className="mt-8 group">
          <summary className="list-none cursor-pointer text-sm font-bold text-cyan-400 hover:text-cyan-300 flex items-center gap-2 select-none outline-none">
            <span>✏️ Editar datos del cliente</span>
            <span className="transition-transform group-open:rotate-90">▸</span>
          </summary>
          <div className="mt-6">
            <form action={updateClientRecord} className="space-y-6">
              <input type="hidden" name="client_id" value={record.id} />
              <div className="rounded-3xl border border-white/5 bg-white/[0.02] p-8">
                <div className="grid gap-6 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <label className={labelStyle}>Nombre del interesado *</label>
                    <input name="name" defaultValue={record.name} required className={inputStyle} />
                  </div>
                  
                  <div>
                    <label className={labelStyle}>Email</label>
                    <input type="email" name="email" defaultValue={record.email || ''} className={inputStyle} />
                  </div>
                  
                  <div>
                    <label className={labelStyle}>Teléfono</label>
                    <input type="text" name="phone" defaultValue={record.phone || ''} className={inputStyle} />
                  </div>

                  <div>
                    <label className={labelStyle}>Tipo de cliente</label>
                    <select name="client_type" defaultValue={record.client_type || ''} className={selectStyle}>
                      <option value="comprador" style={darkOptionStyle}>Comprador</option>
                      <option value="inquilino" style={darkOptionStyle}>Inquilino</option>
                      <option value="vendedor" style={darkOptionStyle}>Vendedor</option>
                      <option value="propietario" style={darkOptionStyle}>Propietario</option>
                      <option value="otro" style={darkOptionStyle}>Otro</option>
                    </select>
                  </div>

                  <div>
                    <label className={labelStyle}>Estado</label>
                    <select name="status" defaultValue={record.status || 'activo'} className={selectStyle}>
                      <option value="activo" style={darkOptionStyle}>Activo</option>
                      <option value="en_seguimiento" style={darkOptionStyle}>En seguimiento</option>
                      <option value="cerrado" style={darkOptionStyle}>Cerrado</option>
                      <option value="descartado" style={darkOptionStyle}>Descartado</option>
                    </select>
                  </div>

                  <div>
                    <label className={labelStyle}>Interés</label>
                    <select name="operation_interest" defaultValue={record.operation_interest || ''} className={selectStyle}>
                      <option value="" style={darkOptionStyle}>No especificado</option>
                      <option value="compra" style={darkOptionStyle}>Compra</option>
                      <option value="alquiler" style={darkOptionStyle}>Alquiler</option>
                    </select>
                  </div>

                  <div>
                    <label className={labelStyle}>Tipo de propiedad buscada</label>
                    <select name="desired_property_type" defaultValue={record.desired_property_type || ''} className={selectStyle}>
                      <option value="" style={darkOptionStyle}>No especificado</option>
                      <option value="casa" style={darkOptionStyle}>Casa</option>
                      <option value="departamento" style={darkOptionStyle}>Departamento</option>
                      <option value="lote" style={darkOptionStyle}>Lote/Terreno</option>
                      <option value="local" style={darkOptionStyle}>Local</option>
                      <option value="oficina" style={darkOptionStyle}>Oficina</option>
                      <option value="cochera" style={darkOptionStyle}>Cochera</option>
                      <option value="cualquiera" style={darkOptionStyle}>Cualquiera</option>
                    </select>
                  </div>

                  <div className="sm:col-span-2">
                    <label className={labelStyle}>Zona / barrio buscado</label>
                    <input name="zone" defaultValue={record.zone || ''} className={inputStyle} />
                  </div>

                  <div className="sm:col-span-2">
                    <label className={labelStyle}>Presupuesto</label>
                    <div className="mt-2 flex gap-3">
                      <select name="currency" defaultValue={record.currency || 'USD'} className="w-24 rounded-2xl border border-white/10 bg-[#0C2340] px-4 py-3 text-white outline-none focus:ring-2 focus:ring-cyan-400">
                        <option value="USD" style={darkOptionStyle}>u$s</option>
                        <option value="ARS" style={darkOptionStyle}>$ (ARS)</option>
                      </select>
                      <input type="number" name="budget_min" defaultValue={record.budget_min || ''} placeholder="Desde" className={inputStyle + " !mt-0 flex-1"} />
                      <input type="number" name="budget_max" defaultValue={record.budget_max || ''} placeholder="Hasta" className={inputStyle + " !mt-0 flex-1"} />
                    </div>
                  </div>

                  <div>
                    <label className={labelStyle}>Ambientes mínimos</label>
                    <input type="number" name="min_rooms" defaultValue={record.min_rooms || ''} className={inputStyle} />
                  </div>
                  
                  <div className="sm:col-span-2">
                    <label className={labelStyle}>Observaciones</label>
                    <textarea name="notes" defaultValue={record.notes || ''} rows={3} className={inputStyle}></textarea>
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-4">
                <FormSubmitButton label="Guardar cambios" loadingLabel="Guardando..." />
              </div>
            </form>
          </div>
        </details>
      )}
    </AppShell>
  );
}
