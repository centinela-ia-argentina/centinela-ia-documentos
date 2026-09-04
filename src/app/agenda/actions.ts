'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getUserProfile } from '@/lib/auth/getUserProfile';
import { canUpdateCase, isUserRole } from '@/lib/permissions/roles';
import { createAuditLog } from '@/lib/audit/createAuditLog';
import { normalizeDateLocal, normalizeTitle, validateTime } from './helpers';

export type GuardarEventoResult =
  | { ok: true; created?: boolean; existing?: boolean; mensaje?: string }
  | { ok: false; motivo: 'no_auth' | 'error'; mensaje?: string };

// Imported from helpers.ts
// export function normalizeDateLocal...
// export function normalizeTitle...
// export function validateTime...

async function deduplicateAndInsert(input: {
  titulo: string;
  fecha: string;
  detalle: string | null;
  categoria: 'manual' | 'plazo' | 'turno' | 'firma';
  hora: string | null;
  caseId: string | null;
}): Promise<GuardarEventoResult> {
  const { user, profile } = await getUserProfile();
  if (!user || !profile) return { ok: false, motivo: 'no_auth' };

  const fechaNorm = normalizeDateLocal(input.fecha);
  if (!fechaNorm) return { ok: false, motivo: 'error', mensaje: 'Fecha inválida' };
  const tituloInput = input.titulo?.trim();
  if (!tituloInput) {
    return { ok: false, motivo: 'error', mensaje: 'Faltan datos.' };
  }

  if (!isUserRole(profile.role) || !canUpdateCase(profile.role)) {
    return { ok: false, motivo: 'no_auth', mensaje: 'No tenés permisos para esta acción.' };
  }

  let horaValida: string | null = null;
  try {
    horaValida = validateTime(input.hora);
  } catch (err: any) {
    return { ok: false, motivo: 'error', mensaje: err.message };
  }

  const supabase = await createClient();

  if (input.caseId) {
    const { data: caseData } = await supabase
      .from('cases')
      .select('id')
      .eq('id', input.caseId)
      .eq('organization_id', profile.organization_id)
      .maybeSingle();
    
    if (!caseData) {
      return { ok: false, motivo: 'error', mensaje: 'Expediente no encontrado o sin acceso.' };
    }
  }

  const tituloNorm = normalizeTitle(tituloInput);

  let query = supabase
    .from('agenda_plazos')
    .select('id, titulo, hora')
    .eq('organization_id', profile.organization_id)
    .eq('fecha', fechaNorm)
    .eq('categoria', input.categoria);

  if (input.caseId) {
    query = query.eq('case_id', input.caseId);
  } else {
    query = query.is('case_id', null);
  }

  const { data: candidates } = await query;

  if (candidates && candidates.length > 0) {
    const exists = candidates.some((c) => normalizeTitle(c.titulo || '') === tituloNorm && (c.hora || null) === horaValida);
    if (exists) {
      await createAuditLog({
        organizationId: profile.organization_id,
        userId: user.id,
        action: 'agenda_event_duplicate_prevented',
        resourceType: input.caseId ? 'case' : 'organization',
        resourceId: input.caseId || profile.organization_id,
        metadata: { titulo: tituloInput, fecha: fechaNorm, hora: horaValida, categoria: input.categoria },
      });
      return { ok: true, created: false, existing: true };
    }
  }

  const { error } = await supabase.from('agenda_plazos').insert({
    organization_id: profile.organization_id,
    titulo: tituloInput,
    fecha: fechaNorm,
    hora: horaValida,
    detalle: input.detalle,
    categoria: input.categoria,
    created_by: user.id,
    case_id: input.caseId,
  });

  if (error) {
    if (error.code === '23505') {
      await createAuditLog({
        organizationId: profile.organization_id,
        userId: user.id,
        action: 'agenda_event_duplicate_prevented',
        resourceType: input.caseId ? 'case' : 'organization',
        resourceId: input.caseId || profile.organization_id,
        metadata: { titulo: tituloInput, fecha: fechaNorm, hora: horaValida, categoria: input.categoria },
      });
      return { ok: true, created: false, existing: true };
    }
    return { ok: false, motivo: 'error', mensaje: error.message };
  }

  await createAuditLog({
    organizationId: profile.organization_id,
    userId: user.id,
    action: 'agenda_event_created',
    resourceType: input.caseId ? 'case' : 'organization',
    resourceId: input.caseId || profile.organization_id,
    metadata: {
      titulo: tituloInput,
      fecha: fechaNorm,
      hora: horaValida,
      categoria: input.categoria,
    },
  });

  revalidatePath('/agenda');
  if (input.caseId) revalidatePath(`/expedientes/${input.caseId}`);
  return { ok: true, created: true };
}

export async function guardarEventoManual(input: {
  titulo: string;
  fecha: string;
  hora?: string;
  detalle?: string;
  caseId?: string;
}): Promise<GuardarEventoResult> {
  return deduplicateAndInsert({
    titulo: input.titulo,
    fecha: input.fecha,
    detalle: input.detalle?.trim() || null,
    categoria: 'manual',
    hora: input.hora?.trim() || null,
    caseId: input.caseId ?? null,
  });
}

export async function guardarPlazoDetectado(input: {
  titulo: string;
  fecha: string;
  detalle?: string;
  caseId?: string;
}): Promise<GuardarEventoResult> {
  return deduplicateAndInsert({
    titulo: input.titulo,
    fecha: input.fecha,
    detalle: input.detalle?.trim() || null,
    categoria: 'plazo',
    hora: null,
    caseId: input.caseId ?? null,
  });
}

export async function guardarTurno(input: {
  titulo: string;
  fecha: string;
  hora?: string;
  tipo: 'turno' | 'firma';
  detalle?: string;
  caseId?: string;
}): Promise<GuardarEventoResult> {
  return deduplicateAndInsert({
    titulo: input.titulo,
    fecha: input.fecha,
    hora: input.hora?.trim() || null,
    detalle: input.detalle?.trim() || null,
    categoria: input.tipo === 'firma' ? 'firma' : 'turno',
    caseId: input.caseId ?? null,
  });
}
