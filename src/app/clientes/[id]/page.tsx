import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { AppShell } from '@/components/layout/AppShell';
import { createClient } from '@/lib/supabase/server';
import { getUserProfile } from '@/lib/auth/getUserProfile';
import { canManageClient } from '@/lib/permissions/roles';
import { updateClientRecord } from '../actions';
import { ArrowLeft, User } from 'lucide-react';
import { ClientDetailMode } from '@/components/approved/ClientDetailMode';
import { ClientDetailReadView } from '@/components/approved/ClientDetailReadView';
import styles from '@/components/approved/ApprovedDetail.module.css';
import { FormSubmitButton } from '@/components/ui/FormSubmitButton';
import { getClientStatusLabel, getClientTypeLabel } from '@/lib/clients/labels';
import type { ClientRecord } from '@/types/client';
import type { PropertyRecord } from '@/types/property';
import { evaluarMatch, ordenarPorMatch } from '@/lib/matching/match';
import { canUseAi } from '@/lib/permissions/roles';
import { ClientMatchAiButton } from './ClientMatchAiButton';
import { WhatsAppIntentBuilder } from '@/components/WhatsAppIntentBuilder';
import { generateClientMessage } from '@/lib/whatsapp';

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
      <Link href="/clientes" className="mb-5 inline-flex min-h-11 items-center gap-2 text-sm text-slate-300 hover:text-white"><ArrowLeft size={16} aria-hidden="true" />Volver a clientes</Link>
      <ClientDetailMode name={record.name} canManage={canManage}
        identity={<div className={styles.identity}><span className={styles.avatar}><User size={32} aria-hidden="true" /></span><div><p className={styles.eyebrow}>Ficha de cliente</p><h1>{record.name}</h1><div className={styles.identityTags}><span>{getClientStatusLabel(record.status)}</span><span>{getClientTypeLabel(record.client_type)}</span></div></div></div>}
        editForm={canManage ? (
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

                  <div className="sm:col-span-2 grid gap-6 sm:grid-cols-2">
                    <div>
                      <label className={labelStyle}>Provincia buscada</label>
                      <input name="desired_province" defaultValue={record.desired_province || ''} className={inputStyle} />
                    </div>
                    <div>
                      <label className={labelStyle}>Localidad / Ciudad buscada</label>
                      <input name="desired_city" defaultValue={record.desired_city || ''} className={inputStyle} />
                    </div>
                    <div>
                      <label className={labelStyle}>Barrio / Zona buscada</label>
                      <input name="desired_neighborhood" defaultValue={record.desired_neighborhood || ''} className={inputStyle} />
                    </div>
                    <div>
                      <label className={labelStyle}>Subzona buscada (opcional)</label>
                      <input name="desired_subzone" defaultValue={record.desired_subzone || ''} className={inputStyle} />
                    </div>
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
        ) : null}
      >
        <ClientDetailReadView record={record} matches={sortedMatches}
          aiAction={canUseAi(profile.role) && sortedMatches.length > 0 ? <ClientMatchAiButton clientId={id} /> : null}
          contactMessage={<WhatsAppIntentBuilder compact phone={record.phone} context="client" resourceId={record.id} defaultMessage={generateClientMessage(record)} />}
        />
      </ClientDetailMode>
    </AppShell>
  );
}
