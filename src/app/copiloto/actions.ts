'use server';

import { createClient } from '@/lib/supabase/server';
import { getUserProfile } from '@/lib/auth/getUserProfile';
import { calcularProximoAjuste, estadoVencimiento, getIndexTypeLabel, getRentalStatusLabel } from '@/lib/rentals/labels';
import { getPropertyStatusLabel, getPropertyTypeLabel } from '@/lib/properties/labels';
import { getClientStatusLabel, getClientTypeLabel, getOperationInterestLabel, getDesiredPropertyTypeLabel } from '@/lib/clients/labels';
import { getCaseStatusLabel } from '@/lib/industries/caseConfig';
import { generarBriefingInmobiliaria, responderPreguntaInmobiliaria } from '@/lib/ai/copilotoInmobiliaria';
import type { RentalContract } from '@/types/rental';

export async function generarBriefing() {
  const { user, profile } = await getUserProfile();
  if (!user || !profile) return { ok: false as const, motivo: 'sin_sesion' as const };

  const supabase = await createClient();
  const orgId = profile.organization_id;

  const [propsRes, casesRes, clientsRes, rentalsRes] = await Promise.all([
    supabase.from('properties').select('status').eq('organization_id', orgId).is('archived_at', null),
    supabase.from('cases').select('status').eq('organization_id', orgId),
    supabase.from('clients').select('status').eq('organization_id', orgId).is('archived_at', null),
    supabase.from('rental_contracts').select('*').eq('organization_id', orgId).is('archived_at', null),
  ]);

  const countBy = (arr: Array<{ status?: string | null }> | null) => {
    const m: Record<string, number> = {};
    for (const x of arr || []) {
      const k = x.status || 'sin_estado';
      m[k] = (m[k] || 0) + 1;
    }
    return m;
  };

  const rentals = (rentalsRes.data || []) as RentalContract[];
  const rentalAlerts = rentals.map((r) => {
    const prox = calcularProximoAjuste(r.start_date, r.last_adjustment_date, r.adjustment_period_months);
    const est = estadoVencimiento(prox, r.status);
    return {
      tenant: r.tenant_name || 'Contrato sin inquilino',
      fecha: prox ? prox.toLocaleDateString('es-AR') : '-',
      estado: est,
    };
  });

  const snapshot = {
    propiedades: { total: (propsRes.data || []).length, porEstado: countBy(propsRes.data) },
    operaciones: { total: (casesRes.data || []).length, porEstado: countBy(casesRes.data) },
    clientes: { total: (clientsRes.data || []).length, porEstado: countBy(clientsRes.data) },
    alquileres: {
      total: rentals.length,
      vencidos: rentalAlerts.filter((r) => r.estado.tipo === 'vencido').map((r) => `${r.tenant} (${r.estado.label})`),
      proximos: rentalAlerts.filter((r) => r.estado.tipo === 'proximo').map((r) => `${r.tenant} — ${r.fecha} (${r.estado.label})`),
    },
  };

  return generarBriefingInmobiliaria(snapshot);
}

export async function preguntarCopiloto(pregunta: string) {
  const { user, profile } = await getUserProfile();
  if (!user || !profile) return { ok: false as const, motivo: 'sin_sesion' as const };

  const limpia = (pregunta || '').trim();
  if (!limpia) return { ok: false as const, motivo: 'sin_pregunta' as const };

  const supabase = await createClient();
  const orgId = profile.organization_id;

  const [propsRes, casesRes, clientsRes, rentalsRes] = await Promise.all([
    supabase.from('properties').select('name, address, property_type, status, price, currency, surface_total_m2, rooms').eq('organization_id', orgId).is('archived_at', null).order('created_at', { ascending: false }).limit(60),
    supabase.from('cases').select('title, client_name, case_type, status').eq('organization_id', orgId).not('status', 'in', '("archived","Archivado")').order('created_at', { ascending: false }).limit(60),
    supabase.from('clients').select('name, client_type, operation_interest, desired_property_type, zone, budget_min, budget_max, currency, min_rooms, status').eq('organization_id', orgId).is('archived_at', null).order('created_at', { ascending: false }).limit(60),
    supabase.from('rental_contracts').select('*').eq('organization_id', orgId).is('archived_at', null).order('created_at', { ascending: false }).limit(60),
  ]);

  const money = (v: number | null | undefined, cur: string | null | undefined) =>
    v != null ? `${cur === 'USD' ? 'u$s' : '$'}${Number(v).toLocaleString('es-AR')}` : 's/precio';

  const props = (propsRes.data || []) as any[];
  const propsTxt = props.length
    ? props.map((p, i) => `${i + 1}. ${p.name || 'Sin nombre'} — ${getPropertyTypeLabel(p.property_type)}, ${getPropertyStatusLabel(p.status)}, ${money(p.price, p.currency)}${p.rooms != null ? `, ${p.rooms} amb` : ''}${p.surface_total_m2 != null ? `, ${p.surface_total_m2} m²` : ''}${p.address ? `, ${p.address}` : ''}`).join('\n')
    : '(sin propiedades cargadas)';

  const clients = (clientsRes.data || []) as any[];
  const clientsTxt = clients.length
    ? clients.map((c, i) => `${i + 1}. ${c.name || 'Sin nombre'} — ${getClientTypeLabel(c.client_type)}, ${getClientStatusLabel(c.status)}, busca ${getDesiredPropertyTypeLabel(c.desired_property_type)}${c.operation_interest ? ` (${getOperationInterestLabel(c.operation_interest)})` : ''}${c.zone ? ` en ${c.zone}` : ''}, presupuesto ${money(c.budget_min, c.currency)}–${money(c.budget_max, c.currency)}${c.min_rooms != null ? `, ${c.min_rooms}+ amb` : ''}`).join('\n')
    : '(sin clientes cargados)';

  const cases = (casesRes.data || []) as any[];
  const casesTxt = cases.length
    ? cases.map((c, i) => `${i + 1}. ${c.title || 'Sin título'} — ${getCaseStatusLabel(c.status, 'inmobiliaria')}${c.case_type ? `, ${c.case_type}` : ''}${c.client_name ? `, cliente: ${c.client_name}` : ''}`).join('\n')
    : '(sin operaciones cargadas)';

  const rentals = (rentalsRes.data || []) as RentalContract[];
  const rentalsTxt = rentals.length
    ? rentals.map((r, i) => {
        const prox = calcularProximoAjuste(r.start_date, r.last_adjustment_date, r.adjustment_period_months);
        const est = estadoVencimiento(prox, r.status);
        return `${i + 1}. ${r.tenant_name || 'Sin inquilino'} — ${getRentalStatusLabel(r.status)}, ${money(r.current_amount, r.currency)}, índice ${getIndexTypeLabel(r.index_type)}, próximo ajuste ${prox ? prox.toLocaleDateString('es-AR') : '-'} (${est.label})`;
      }).join('\n')
    : '(sin alquileres cargados)';

  const contexto = [
    `PROPIEDADES (${props.length}):`, propsTxt, '',
    `CLIENTES/INTERESADOS (${clients.length}):`, clientsTxt, '',
    `OPERACIONES (${cases.length}):`, casesTxt, '',
    `ALQUILERES (${rentals.length}):`, rentalsTxt,
  ].join('\n');

  return responderPreguntaInmobiliaria({ pregunta: limpia, contexto });
}
