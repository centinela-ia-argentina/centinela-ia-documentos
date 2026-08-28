'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getUserProfile } from '@/lib/auth/getUserProfile';
import { canUpdateCase, isUserRole, canDeleteDocument } from '@/lib/permissions/roles';
import { createAuditLog } from '@/lib/audit/createAuditLog';

export type RegistrarEscrituraResult =
  | { ok: true; numero: number }
  | { ok: false; motivo: 'no_auth' | 'sin_permiso' | 'error'; mensaje?: string };

export async function registrarEscritura(input: {
  fechaOtorgamiento: string; // 'YYYY-MM-DD'
  tipoActo?: string;
  comparecientes?: string;
  objeto?: string;
  folioDesde?: string;
  folioHasta?: string;
  observaciones?: string;
  caseId?: string;
  anio?: number;
}): Promise<RegistrarEscrituraResult> {
  const { user, profile } = await getUserProfile();
  if (!user || !profile || profile.status !== 'active') return { ok: false, motivo: 'no_auth' };
  if (!isUserRole(profile.role) || !canUpdateCase(profile.role)) return { ok: false, motivo: 'sin_permiso' };

  const fecha = input.fechaOtorgamiento?.trim();
  if (!fecha) return { ok: false, motivo: 'error', mensaje: 'Falta la fecha de otorgamiento.' };

  const anio = input.anio ?? Number(fecha.slice(0, 4));
  const supabase = await createClient();

  const { data: org } = await supabase
    .from('organizations')
    .select('industry_type')
    .eq('id', profile.organization_id)
    .maybeSingle();

  if (!org || org.industry_type !== 'escribania') return { ok: false, motivo: 'sin_permiso', mensaje: 'Industria no autorizada.' };

  const { data: ultima } = await supabase
    .from('protocolo_escrituras')
    .select('numero')
    .eq('organization_id', profile.organization_id)
    .eq('anio', anio)
    .order('numero', { ascending: false })
    .limit(1)
    .maybeSingle();

  const numero = (ultima?.numero ?? 0) + 1;

  const { error } = await supabase.from('protocolo_escrituras').insert({
    organization_id: profile.organization_id,
    numero,
    anio,
    fecha_otorgamiento: fecha,
    tipo_acto: input.tipoActo?.trim() || null,
    comparecientes: input.comparecientes?.trim() || null,
    objeto: input.objeto?.trim() || null,
    folio_desde: input.folioDesde?.trim() || null,
    folio_hasta: input.folioHasta?.trim() || null,
    observaciones: input.observaciones?.trim() || null,
    case_id: input.caseId || null,
    created_by: user.id,
  });

  if (error) return { ok: false, motivo: 'error', mensaje: error.message };

  await createAuditLog({
    organizationId: profile.organization_id,
    userId: user.id,
    action: 'crear_escritura',
    resourceType: 'protocolo_escrituras',
    resourceId: numero.toString(),
    metadata: { anio, numero, case_id: input.caseId },
  });

  revalidatePath('/protocolo');
  return { ok: true, numero };
}

export async function eliminarEscritura(id: string): Promise<{ ok: boolean }> {
  const { user, profile } = await getUserProfile();
  if (!user || !profile || profile.status !== 'active') return { ok: false };
  if (!isUserRole(profile.role) || !canDeleteDocument(profile.role)) return { ok: false };

  const supabase = await createClient();

  const { data: org } = await supabase
    .from('organizations')
    .select('industry_type')
    .eq('id', profile.organization_id)
    .maybeSingle();

  if (!org || org.industry_type !== 'escribania') return { ok: false };

  const { error } = await supabase
    .from('protocolo_escrituras')
    .delete()
    .eq('id', id)
    .eq('organization_id', profile.organization_id);

  if (error) {
    console.error('Error deleting escritura:', error);
    return { ok: false };
  }

  await createAuditLog({
    organizationId: profile.organization_id,
    userId: user.id,
    action: 'eliminar_escritura',
    resourceType: 'protocolo_escrituras',
    resourceId: id,
    metadata: {},
  });

  revalidatePath('/protocolo');
  return { ok: true };
}
