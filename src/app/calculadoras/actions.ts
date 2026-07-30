'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getUserProfile } from '@/lib/auth/getUserProfile';
import { canUpdateCase } from '@/lib/permissions/roles';

export type GuardarPlazoResult =
  | { ok: true }
  | { ok: false; motivo: 'no_auth' | 'error'; mensaje?: string };

export async function guardarPlazoEnAgenda(input: {
  titulo: string;
  fecha: string; // 'YYYY-MM-DD'
  detalle?: string;
}): Promise<GuardarPlazoResult> {
  const { user, profile } = await getUserProfile();
  if (!user || !profile) return { ok: false, motivo: 'no_auth' };

  const titulo = input.titulo?.trim();
  const fecha = input.fecha?.trim();
  if (!titulo || !fecha) return { ok: false, motivo: 'error', mensaje: 'Faltan datos.' };

  if (!canUpdateCase(profile.role as any)) return { ok: false, motivo: 'no_auth', mensaje: 'No tenés permisos para esta acción.' };

  const supabase = await createClient();
  const { error } = await supabase.from('agenda_plazos').insert({
    organization_id: profile.organization_id,
    titulo,
    fecha,
    detalle: input.detalle?.trim() || null,
    created_by: user.id,
  });

  if (error) return { ok: false, motivo: 'error', mensaje: error.message };

  revalidatePath('/agenda');
  return { ok: true };
}
