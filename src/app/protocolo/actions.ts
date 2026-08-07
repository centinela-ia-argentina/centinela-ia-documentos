'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getUserProfile } from '@/lib/auth/getUserProfile';
import { canUpdateCase, canDeleteDocument, isUserRole } from '@/lib/permissions/roles';

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

  const { data: numero, error } = await supabase.rpc('registrar_escritura_atomica', {
    p_anio: anio,
    p_fecha: fecha,
    p_tipo_acto: input.tipoActo?.trim() || null,
    p_comparecientes: input.comparecientes?.trim() || null,
    p_objeto: input.objeto?.trim() || null,
    p_folio_desde: input.folioDesde?.trim() || null,
    p_folio_hasta: input.folioHasta?.trim() || null,
    p_observaciones: input.observaciones?.trim() || null,
    p_case_id: input.caseId || null,
  });

  if (error) {
    console.error('Error al registrar escritura:', error);
    return { ok: false, motivo: 'error', mensaje: error.message };
  }

  revalidatePath('/protocolo');
  return { ok: true, numero: numero as number };
}

export async function eliminarEscritura(id: string): Promise<{ ok: boolean }> {
  const { user, profile } = await getUserProfile();
  if (!user || !profile || profile.status !== 'active') return { ok: false };
  // Usamos canDeleteDocument por analogía con la regla de casos/documentos.
  if (!isUserRole(profile.role) || !canDeleteDocument(profile.role)) return { ok: false };

  const supabase = await createClient();
  const { error } = await supabase
    .from('protocolo_escrituras')
    .delete()
    .eq('id', id)
    .eq('organization_id', profile.organization_id);

  if (error) {
    console.error('Error al eliminar escritura:', error);
  }

  revalidatePath('/protocolo');
  return { ok: !error };
}
