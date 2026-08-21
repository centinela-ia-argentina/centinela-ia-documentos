import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { AppShell } from '@/components/layout/AppShell';
import { createClient } from '@/lib/supabase/server';
import { getUserProfile } from '@/lib/auth/getUserProfile';
import { getPropertyStatusLabel, getPropertyTypeLabel } from '@/lib/properties/labels';
import { canManageProperty, isUserRole, canUseAi } from '@/lib/permissions/roles';
import { updateProperty } from '../actions';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { ArrowLeft, Building2, MapPin, DollarSign, Home, Tag, Info, ScrollText, Users } from 'lucide-react';
import { FormSubmitButton } from '@/components/ui/FormSubmitButton';
import { PropertyAiAssistant } from './PropertyAiAssistant';
import { Badge } from '@/components/ui/Badge';
import type { PropertyRecord } from '@/types/property';
import { getCaseStatusLabel } from '@/lib/industries/caseConfig';
import { normalizeIndustryType } from '@/lib/industries/documentTypes';
import type { ClientRecord } from '@/types/client';
import { evaluarMatch, ordenarPorMatch } from '@/lib/matching/match';
import { getDesiredPropertyTypeLabel, getOperationInterestLabel } from '@/lib/clients/labels';
import { PropertyMatchAiButton } from './PropertyMatchAiButton';
import { GenerarAvisoButton } from './GenerarAvisoButton';
import { DescargarFichaPdfButton } from './DescargarFichaPdfButton';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { TasarButton } from './TasarButton';
import { TasacionPanel } from './TasacionPanel';
import { PublicacionAsistidaPanel } from './PublicacionAsistidaPanel';
import { WhatsAppIntentBuilder } from '@/components/WhatsAppIntentBuilder';
import { generatePropertyMessage } from '@/lib/whatsapp';

interface PropertyDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function PropertyDetailPage({ params }: PropertyDetailPageProps) {
  const { id } = await params;
  const { user, profile } = await getUserProfile();

  if (!user) redirect('/login');
  if (!profile) redirect('/onboarding');
  if (profile.role === 'client') redirect('/acceso-denegado');

  const supabase = await createClient();

  const { data: property, error } = await supabase
    .from('properties')
    .select('*')
    .eq('id', id)
    .eq('organization_id', profile.organization_id)
    .single();

  if (error || !property) {
    notFound();
  }

  const record = property as PropertyRecord;
  const canManage = isUserRole(profile.role) && canManageProperty(profile.role);
  const useAi = isUserRole(profile.role) && canUseAi(profile.role);

  const { data: documentsData } = await supabase
    .from('documents')
    .select('id, file_name')
    .eq('organization_id', profile.organization_id)
    .is('archived_at', null)
    .limit(50);

  const documents = documentsData || [];

  const { data: organization } = await supabase
    .from('organizations')
    .select('industry_type')
    .eq('id', profile.organization_id)
    .maybeSingle();
  const industry = normalizeIndustryType(organization?.industry_type);

  const { data: operationsData } = await supabase
    .from('cases')
    .select('id, title, status')
    .eq('property_id', record.id)
    .eq('organization_id', profile.organization_id)
    .order('created_at', { ascending: false });

  const operations = operationsData || [];

  const { data: comparablesData } = await supabase
    .from('property_comparables')
    .select('*')
    .eq('property_id', record.id)
    .eq('organization_id', profile.organization_id)
    .order('created_at', { ascending: false });
    
  const comparables = comparablesData || [];

  {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
  let sortedMatches: { item: ClientRecord; match: any }[] = [];
  if (record.status === 'disponible') {
    const { data: clientsData } = await supabase
      .from('clients')
      .select('*')
      .eq('organization_id', profile.organization_id)
      .is('archived_at', null)
      .in('status', ['activo', 'en_seguimiento']);
      
    const clients = (clientsData || []) as ClientRecord[];
    
    const matches = clients
      .map(c => ({ item: c, match: evaluarMatch(c, record) }))
      .filter(m => m.match.elegible);
      
    sortedMatches = ordenarPorMatch(matches);
  }

  return (
    <AppShell>
      <div className="mb-8">
        <Link
          href="/propiedades"
          className="inline-flex items-center gap-2 text-sm font-semibold text-slate-400 transition-colors hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" /> Volver a propiedades
        </Link>
      </div>

      <div className="mb-8 flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <Badge tone={record.status === 'disponible' ? 'success' : record.status === 'reservada' ? 'warning' : 'neutral'}>
              {getPropertyStatusLabel(record.status)}
            </Badge>
            <span className="rounded-full bg-white/5 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-slate-400">
              {getPropertyTypeLabel(record.property_type)}
            </span>
          </div>
          <h1 className="font-display text-3xl font-bold tracking-tight text-white sm:text-4xl">
            {record.name}
          </h1>
          <div className="mt-2 flex items-center gap-2 text-slate-400">
            <MapPin className="h-4 w-4" />
            <span>{record.address || 'Sin dirección cargada'}</span>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {useAi && (
            <PropertyAiAssistant propertyId={record.id} documents={documents} />
          )}

          {canManage ? (
            <div className="rounded-3xl border border-white/5 bg-white/[0.02] p-6 sm:p-8">
              <div className="mb-6">
                <h2 className="text-xl font-bold text-white">Editar propiedad</h2>
                <p className="mt-1 text-sm text-slate-400">Modificá los datos técnicos, comerciales y legales.</p>
              </div>

              <form action={updateProperty} className="space-y-8">
                <input type="hidden" name="property_id" value={record.id} />

                <section>
                  <h3 className="mb-4 text-sm font-bold uppercase tracking-wide text-slate-500">Datos principales</h3>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="sm:col-span-2">
                      <label className="mb-1.5 block text-xs font-semibold text-slate-400">Identificación *</label>
                      <input
                        name="name"
                        type="text"
                        required
                        defaultValue={record.name}
                        className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white placeholder:text-slate-500 outline-none focus:ring-2 focus:ring-sky-400"
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs font-semibold text-slate-400">Tipo</label>
                      <select
                        name="property_type"
                        defaultValue={record.property_type ?? ''}
                        className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white outline-none focus:ring-2 focus:ring-sky-400"
                      >
                        <option value="" className="bg-[#0C2340] text-white">Seleccionar...</option>
                        <option value="casa" className="bg-[#0C2340] text-white">Casa</option>
                        <option value="departamento" className="bg-[#0C2340] text-white">Departamento</option>
                        <option value="lote/terreno" className="bg-[#0C2340] text-white">Lote/Terreno</option>
                        <option value="local" className="bg-[#0C2340] text-white">Local</option>
                        <option value="oficina" className="bg-[#0C2340] text-white">Oficina</option>
                        <option value="cochera" className="bg-[#0C2340] text-white">Cochera</option>
                        <option value="otro" className="bg-[#0C2340] text-white">Otro</option>
                      </select>
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs font-semibold text-slate-400">Estado</label>
                      <select
                        name="status"
                        defaultValue={record.status ?? 'disponible'}
                        className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white outline-none focus:ring-2 focus:ring-sky-400"
                      >
                        <option value="disponible" className="bg-[#0C2340] text-white">Disponible</option>
                        <option value="reservada" className="bg-[#0C2340] text-white">Reservada</option>
                        <option value="vendida" className="bg-[#0C2340] text-white">Vendida</option>
                        <option value="alquilada" className="bg-[#0C2340] text-white">Alquilada</option>
                        <option value="no_disponible" className="bg-[#0C2340] text-white">No disponible</option>
                      </select>
                    </div>
                  </div>
                </section>

                <section>
                  <h3 className="mb-4 text-sm font-bold uppercase tracking-wide text-slate-500">Ubicación</h3>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="sm:col-span-2">
                      <label className="mb-1.5 block text-xs font-semibold text-slate-400">Dirección (calle, número, piso, depto)</label>
                      <input
                        name="address"
                        type="text"
                        defaultValue={record.address ?? ''}
                        className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white placeholder:text-slate-500 outline-none focus:ring-2 focus:ring-sky-400"
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs font-semibold text-slate-400">Barrio / Zona</label>
                      <input
                        name="neighborhood"
                        type="text"
                        defaultValue={record.neighborhood ?? ''}
                        className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white placeholder:text-slate-500 outline-none focus:ring-2 focus:ring-sky-400"
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs font-semibold text-slate-400">Subzona (opcional)</label>
                      <input
                        name="subzone"
                        type="text"
                        defaultValue={record.subzone ?? ''}
                        className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white placeholder:text-slate-500 outline-none focus:ring-2 focus:ring-sky-400"
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs font-semibold text-slate-400">Localidad / Ciudad</label>
                      <input
                        name="city"
                        type="text"
                        defaultValue={record.city ?? ''}
                        className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white placeholder:text-slate-500 outline-none focus:ring-2 focus:ring-sky-400"
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs font-semibold text-slate-400">Provincia</label>
                      <input
                        name="province"
                        type="text"
                        defaultValue={record.province ?? ''}
                        className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white placeholder:text-slate-500 outline-none focus:ring-2 focus:ring-sky-400"
                      />
                    </div>
                  </div>
                </section>

                <section>
                  <h3 className="mb-4 text-sm font-bold uppercase tracking-wide text-slate-500">Datos técnicos</h3>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="mb-1.5 block text-xs font-semibold text-slate-400">Matrícula / Catastro</label>
                      <input
                        name="matricula"
                        type="text"
                        defaultValue={record.matricula ?? ''}
                        className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white placeholder:text-slate-500 outline-none focus:ring-2 focus:ring-sky-400"
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs font-semibold text-slate-400">Titular(es)</label>
                      <input
                        name="owners"
                        type="text"
                        defaultValue={record.owners ?? ''}
                        className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white placeholder:text-slate-500 outline-none focus:ring-2 focus:ring-sky-400"
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs font-semibold text-slate-400">Superficie total (m²)</label>
                      <input
                        name="surface_total_m2"
                        type="number"
                        step="0.01"
                        defaultValue={record.surface_total_m2 ?? ''}
                        className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white placeholder:text-slate-500 outline-none focus:ring-2 focus:ring-sky-400"
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs font-semibold text-slate-400">Sup. cubierta (m²)</label>
                      <input
                        name="surface_covered_m2"
                        type="number"
                        step="0.01"
                        defaultValue={record.surface_covered_m2 ?? ''}
                        className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white placeholder:text-slate-500 outline-none focus:ring-2 focus:ring-sky-400"
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs font-semibold text-slate-400">Ambientes</label>
                      <input
                        name="rooms"
                        type="number"
                        defaultValue={record.rooms ?? ''}
                        className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white placeholder:text-slate-500 outline-none focus:ring-2 focus:ring-sky-400"
                      />
                    </div>
                  </div>
                </section>

                <section>
                  <h3 className="mb-4 text-sm font-bold uppercase tracking-wide text-slate-500">Comercial y Legal</h3>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="mb-1.5 block text-xs font-semibold text-slate-400">Moneda</label>
                      <select
                        name="currency"
                        defaultValue={record.currency ?? 'USD'}
                        className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white outline-none focus:ring-2 focus:ring-sky-400"
                      >
                        <option value="USD" className="bg-[#0C2340] text-white">USD (Dólares)</option>
                        <option value="ARS" className="bg-[#0C2340] text-white">ARS (Pesos)</option>
                      </select>
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs font-semibold text-slate-400">Valor</label>
                      <input
                        name="price"
                        type="number"
                        step="0.01"
                        defaultValue={record.price ?? ''}
                        className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white placeholder:text-slate-500 outline-none focus:ring-2 focus:ring-sky-400"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="mb-1.5 block text-xs font-semibold text-slate-400">Gravámenes / inhibiciones</label>
                      <input
                        name="gravamenes"
                        type="text"
                        defaultValue={record.gravamenes ?? ''}
                        className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white placeholder:text-slate-500 outline-none focus:ring-2 focus:ring-sky-400"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="mb-1.5 block text-xs font-semibold text-slate-400">Observaciones</label>
                      <textarea
                        name="notes"
                        rows={4}
                        defaultValue={record.notes ?? ''}
                        className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white placeholder:text-slate-500 outline-none focus:ring-2 focus:ring-sky-400"
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
            <div className="rounded-3xl border border-white/5 bg-white/[0.02] p-6 sm:p-8">
              <h2 className="mb-6 text-xl font-bold text-white">Ficha técnica</h2>
              <div className="grid gap-6 sm:grid-cols-2">
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">Matrícula / Catastro</h4>
                  <p className="mt-1 font-medium text-white">{record.matricula || '-'}</p>
                </div>
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">Titular(es)</h4>
                  <p className="mt-1 font-medium text-white">{record.owners || '-'}</p>
                </div>
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">Superficie Total</h4>
                  <p className="mt-1 font-medium text-white">{record.surface_total_m2 ? `${record.surface_total_m2} m²` : '-'}</p>
                </div>
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">Sup. Cubierta</h4>
                  <p className="mt-1 font-medium text-white">{record.surface_covered_m2 ? `${record.surface_covered_m2} m²` : '-'}</p>
                </div>
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">Ambientes</h4>
                  <p className="mt-1 font-medium text-white">{record.rooms || '-'}</p>
                </div>
                <div className="sm:col-span-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">Gravámenes / inhibiciones</h4>
                  <p className="mt-1 font-medium text-white">{record.gravamenes || '-'}</p>
                </div>
                <div className="sm:col-span-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">Observaciones</h4>
                  <p className="mt-1 font-medium text-white whitespace-pre-wrap">{record.notes || '-'}</p>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="rounded-3xl border border-white/5 bg-gradient-to-b from-white/[0.05] to-transparent p-6">
            <h3 className="mb-4 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-slate-400">
              <DollarSign className="h-4 w-4" />
              Valor de mercado
            </h3>
            {record.price != null ? (
              <div className="text-3xl font-display font-bold text-white">
                <span className="text-xl text-slate-400 mr-1">{record.currency === 'USD' ? 'u$s' : '$'}</span>
                {record.price.toLocaleString('es-AR')}
              </div>
            ) : (
              <p className="text-slate-400">No especificado</p>
            )}
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 sm:p-5">
            <h3 className="mb-4 text-sm font-bold uppercase tracking-wider text-slate-400">
              🛠️ Herramientas Comerciales
            </h3>
            <div className="space-y-2">
              {useAi && (
                <GenerarAvisoButton propertyId={record.id} />
              )}
              <WhatsAppIntentBuilder
                context="property"
                resourceId={record.id}
                defaultMessage={generatePropertyMessage(record)}
              />
              <DescargarFichaPdfButton
                name={record.name}
                propertyType={getPropertyTypeLabel(record.property_type)}
                status={getPropertyStatusLabel(record.status)}
                address={record.address}
                matricula={record.matricula}
                owners={record.owners}
                surfaceTotal={record.surface_total_m2}
                surfaceCovered={record.surface_covered_m2}
                rooms={record.rooms}
                gravamenes={record.gravamenes}
                notes={record.notes}
                price={record.price}
                currency={record.currency}
              />
            </div>
          </div>
          
          <div className="rounded-3xl border border-white/5 bg-white/[0.02] p-6">
            <h3 className="mb-4 text-sm font-bold uppercase tracking-wider text-slate-400">Resumen rápido</h3>
            <ul className="space-y-4">
              <li className="flex items-start gap-3">
                <Home className="h-5 w-5 text-cyan-400 shrink-0" />
                <div>
                  <p className="text-xs text-slate-500">Tipo</p>
                  <p className="font-semibold text-white">{getPropertyTypeLabel(record.property_type)}</p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <Tag className="h-5 w-5 text-cyan-400 shrink-0" />
                <div>
                  <p className="text-xs text-slate-500">Estado actual</p>
                  <p className="font-semibold text-white">{getPropertyStatusLabel(record.status)}</p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <Info className="h-5 w-5 text-cyan-400 shrink-0" />
                <div>
                  <p className="text-xs text-slate-500">Creado</p>
                  <p className="font-semibold text-white">{new Date(record.created_at).toLocaleDateString('es-AR')}</p>
                </div>
              </li>
            </ul>
          </div>

          <TasacionPanel propertyId={record.id} propertyType={record.property_type ?? ''} comparables={comparables} />

          <PublicacionAsistidaPanel key={record.id} property={record} canManage={canManage} />

          <div className="rounded-3xl border border-white/5 bg-white/[0.02] p-6 mt-6">
            <h3 className="mb-4 text-sm font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
              🤝 Operaciones de esta propiedad
            </h3>
            {operations.length > 0 ? (
              <ul className="space-y-3">
                {operations.map((op) => (
                  <li key={op.id}>
                    <Link
                      href={`/expedientes/${op.id}`}
                      className="group flex items-center justify-between rounded-xl border border-white/10 bg-[#0C2340] px-4 py-3 transition hover:border-cyan-500/50 hover:bg-cyan-500/10"
                    >
                      <span className="font-semibold text-white group-hover:text-cyan-400 transition-colors">
                        {op.title}
                      </span>
                      <Badge tone={op.status === 'new' ? 'neutral' : op.status === 'archived' ? 'neutral' : op.status === 'waiting_client' ? 'warning' : 'success'}>
                        {getCaseStatusLabel(op.status, industry)}
                      </Badge>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-slate-400">
                Todavía no hay operaciones vinculadas a esta propiedad.
              </p>
            )}
          </div>

          <div className="rounded-3xl border border-white/5 bg-white/[0.02] p-6 mt-6">
            <h3 className="mb-4 text-sm font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
              👥 Clientes que podrían estar interesados
            </h3>
            
            {useAi && record.status === 'disponible' && sortedMatches.length > 0 && (
              <PropertyMatchAiButton propertyId={record.id} />
            )}

            {record.status !== 'disponible' ? (
              <p className="text-sm text-slate-400 border border-dashed border-white/10 rounded-xl p-4 text-center">
                El matching se activa cuando la propiedad está en estado Disponible.
              </p>
            ) : sortedMatches.length > 0 ? (
              <ul className="space-y-4">
                {sortedMatches.map(({ item: c, match }) => (
                  <li key={c.id}>
                    <Link
                      href={`/clientes/${c.id}`}
                      className="group block rounded-2xl border border-white/10 bg-[#0C2340] p-5 transition hover:border-cyan-500/50 hover:bg-cyan-500/10 outline-none"
                    >
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <h4 className="font-display text-base font-bold text-white group-hover:text-cyan-400 transition-colors">
                            {c.name}
                          </h4>
                          <p className="mt-1 text-xs font-medium text-slate-300">
                            {getOperationInterestLabel(c.operation_interest)} · {getDesiredPropertyTypeLabel(c.desired_property_type)}
                          </p>
                        </div>
                        <Badge tone={match.coincidencias === match.aplicables && match.aplicables > 0 ? 'success' : match.coincidencias > 0 ? 'warning' : 'neutral'}>
                          {match.coincidencias}/{match.aplicables} criterios
                        </Badge>
                      </div>
                      
                      {match.aplicables > 0 && (
                         
                        <div className="mt-4 flex flex-wrap gap-2 pt-4 border-t border-white/5">
                          { }
                          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                          {match.criterios.filter((crit: any) => crit.aplica).map((crit: any) => (
                            <span 
                              key={crit.key} 
                              className={`inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                                crit.cumple 
                                  ? 'bg-green-500/10 text-green-400 border border-green-500/20' 
                                  : 'bg-white/5 text-slate-500 border border-white/10 line-through decoration-slate-500/50'
                              }`}
                            >
                              {crit.cumple ? '✓' : '✗'} {crit.label}
                            </span>
                          ))}
                        </div>
                      )}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-slate-400 border border-dashed border-white/10 rounded-xl p-4 text-center">
                Aún no hay clientes activos con criterios que encajen.
              </p>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
