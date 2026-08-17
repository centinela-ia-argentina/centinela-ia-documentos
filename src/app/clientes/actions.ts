'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getUserProfile } from '@/lib/auth/getUserProfile';
import { createAuditLog } from '@/lib/audit/createAuditLog';
import { canManageClient, isUserRole } from '@/lib/permissions/roles';

export async function createClientRecord(formData: FormData) {
  const { user, profile } = await getUserProfile();
  if (!user || !profile || !isUserRole(profile.role) || !canManageClient(profile.role)) {
    redirect('/acceso-denegado?motivo=rol&accion=crear');
  }

  const supabase = await createClient();

  const name = String(formData.get('name') || '').trim();
  const email = String(formData.get('email') || '').trim();
  const phone = String(formData.get('phone') || '').trim();
  const client_type = String(formData.get('client_type') || '');
  const status = String(formData.get('status') || '');
  const operation_interest = String(formData.get('operation_interest') || '');
  const desired_property_type = String(formData.get('desired_property_type') || '');
  const zone = String(formData.get('zone') || '').trim();
  const budget_min_raw = formData.get('budget_min');
  const budget_max_raw = formData.get('budget_max');
  const currency = String(formData.get('currency') || '');
  const min_rooms_raw = formData.get('min_rooms');
  const desired_province = String(formData.get('desired_province') || '').trim();
  const desired_city = String(formData.get('desired_city') || '').trim();
  const desired_neighborhood = String(formData.get('desired_neighborhood') || '').trim();
  const desired_subzone = String(formData.get('desired_subzone') || '').trim();
  const notes = String(formData.get('notes') || '').trim();

  const budget_min = budget_min_raw ? Number(budget_min_raw) : null;
  const budget_max = budget_max_raw ? Number(budget_max_raw) : null;
  const min_rooms = min_rooms_raw ? Number(min_rooms_raw) : null;

  if (!name) {
    throw new Error('El nombre es requerido');
  }

  const { data, error } = await supabase
    .from('clients')
    .insert({
      organization_id: profile.organization_id,
      name,
      email: email || null,
      phone: phone || null,
      client_type: client_type || null,
      status: status || null,
      operation_interest: operation_interest || null,
      desired_property_type: desired_property_type || null,
      zone: zone || null,
      budget_min,
      budget_max,
      currency: currency || null,
      min_rooms,
      desired_province: desired_province || null,
      desired_city: desired_city || null,
      desired_neighborhood: desired_neighborhood || null,
      desired_subzone: desired_subzone || null,
      notes: notes || null,
      created_by: user.id,
    })
    .select('id')
    .single();

  if (error) {
    console.error('Error creando cliente:', error);
    throw new Error('No se pudo crear el cliente');
  }

  await createAuditLog({
    organizationId: profile.organization_id,
    userId: profile.id,
    action: 'client_created',
    resourceType: 'client',
    resourceId: data.id,
  });

  revalidatePath('/clientes');
  redirect('/clientes');
}

export async function updateClientRecord(formData: FormData) {
  const { user, profile } = await getUserProfile();
  if (!user || !profile || !isUserRole(profile.role) || !canManageClient(profile.role)) {
    redirect('/acceso-denegado?motivo=rol&accion=editar');
  }

  const id = String(formData.get('client_id') || '');
  if (!id) {
    throw new Error('ID de cliente requerido');
  }

  const supabase = await createClient();

  const name = String(formData.get('name') || '').trim();
  const email = String(formData.get('email') || '').trim();
  const phone = String(formData.get('phone') || '').trim();
  const client_type = String(formData.get('client_type') || '');
  const status = String(formData.get('status') || '');
  const operation_interest = String(formData.get('operation_interest') || '');
  const desired_property_type = String(formData.get('desired_property_type') || '');
  const zone = String(formData.get('zone') || '').trim();
  const budget_min_raw = formData.get('budget_min');
  const budget_max_raw = formData.get('budget_max');
  const currency = String(formData.get('currency') || '');
  const min_rooms_raw = formData.get('min_rooms');
  const desired_province = String(formData.get('desired_province') || '').trim();
  const desired_city = String(formData.get('desired_city') || '').trim();
  const desired_neighborhood = String(formData.get('desired_neighborhood') || '').trim();
  const desired_subzone = String(formData.get('desired_subzone') || '').trim();
  const notes = String(formData.get('notes') || '').trim();

  const budget_min = budget_min_raw ? Number(budget_min_raw) : null;
  const budget_max = budget_max_raw ? Number(budget_max_raw) : null;
  const min_rooms = min_rooms_raw ? Number(min_rooms_raw) : null;

  if (!name) {
    throw new Error('El nombre es requerido');
  }

  const { error } = await supabase
    .from('clients')
    .update({
      name,
      email: email || null,
      phone: phone || null,
      client_type: client_type || null,
      status: status || null,
      operation_interest: operation_interest || null,
      desired_property_type: desired_property_type || null,
      zone: zone || null,
      budget_min,
      budget_max,
      currency: currency || null,
      min_rooms,
      desired_province: desired_province || null,
      desired_city: desired_city || null,
      desired_neighborhood: desired_neighborhood || null,
      desired_subzone: desired_subzone || null,
      notes: notes || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('organization_id', profile.organization_id);

  if (error) {
    console.error('Error actualizando cliente:', error);
    throw new Error('No se pudo actualizar el cliente');
  }

  await createAuditLog({
    organizationId: profile.organization_id,
    userId: profile.id,
    action: 'client_updated',
    resourceType: 'client',
    resourceId: id,
  });

  revalidatePath('/clientes');
  revalidatePath(`/clientes/${id}`);
  redirect(`/clientes/${id}`);
}

import { canUseAi } from '@/lib/permissions/roles';
import { analizarMatchConIA } from '@/lib/ai/analizarMatch';
import { evaluarMatch, ordenarPorMatch } from '@/lib/matching/match';
import type { PropertyRecord } from '@/types/property';
import type { ClientRecord } from '@/types/client';
import { getPropertyTypeLabel } from '@/lib/properties/labels';

export async function analizarMatchClienteIA(clientId: string): Promise<{ ok: boolean; text?: string; error?: string }> {
  const { profile } = await getUserProfile();
  if (!profile || !isUserRole(profile.role) || !canUseAi(profile.role)) {
    return { ok: false, error: 'Sin permiso de IA' };
  }

  const supabase = await createClient();

  const { data: clientData, error: clientErr } = await supabase
    .from('clients')
    .select('*')
    .eq('id', clientId)
    .eq('organization_id', profile.organization_id)
    .single();

  if (clientErr || !clientData) {
    return { ok: false, error: 'Cliente no encontrado' };
  }

  const client = clientData as ClientRecord;

  const { data: propsData } = await supabase
    .from('properties')
    .select('*')
    .eq('organization_id', profile.organization_id)
    .is('archived_at', null)
    .eq('status', 'disponible');

  const properties = (propsData || []) as PropertyRecord[];

  const matches = properties
    .map(p => ({ item: p, match: evaluarMatch(client, p) }))
    .filter(m => m.match.elegible && m.match.coincidencias >= 1);

  const topMatches = ordenarPorMatch(matches).slice(0, 5);

  let contexto = `BÚSQUEDA DEL CLIENTE:
Interés: ${client.operation_interest || 'Cualquiera'}
Tipo: ${client.desired_property_type || 'Cualquiera'}
Zona: ${client.zone || 'Cualquiera'}
Presupuesto: ${client.budget_min || 0} - ${client.budget_max || 'Sin límite'} ${client.currency || ''}
Ambientes: ${client.min_rooms || 'Cualquiera'}+

PROPIEDADES CANDIDATAS (Top ${topMatches.length}):
`;

  topMatches.forEach((m, idx) => {
    const p = m.item;
    contexto += `
[Opción ${idx + 1}]
Nombre: ${p.name}
Tipo: ${getPropertyTypeLabel(p.property_type)}
Precio: ${p.price || 'S/N'} ${p.currency || ''}
Superficie: ${p.surface_total_m2 || 'S/N'} m²
Ambientes: ${p.rooms || 'S/N'}
Dirección: ${p.address || 'S/N'}
Puntaje de Match: ${m.match.coincidencias}/${m.match.aplicables} criterios
`;
    m.match.criterios.filter(c => c.aplica).forEach(c => {
      contexto += `- Criterio "${c.label}": ${c.cumple ? 'CUMPLE' : 'NO CUMPLE'}\n`;
    });
  });

  const textoIA = await analizarMatchConIA(contexto);

  if (!textoIA) {
    return { ok: false, error: 'No se pudo generar el análisis.' };
  }

  await createAuditLog({
    organizationId: profile.organization_id,
    userId: profile.id,
    action: 'client_match_ai',
    resourceType: 'client',
    resourceId: clientId,
  });

  return { ok: true, text: textoIA };
}
