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
  let resolvedCaseId = input.caseId ?? null;

  if (!resolvedCaseId && input.detalle) {
    const docMatch = input.detalle.match(/(?:documento:\s*|en\s+el\s+documento\s+)([^\r\n,]+)/i);
    if (docMatch) {
      const fileNameCandidate = docMatch[1].trim();
      const supabase = await createClient();
      const { profile } = await getUserProfile();
      if (profile) {
        const { data: docData } = await supabase
          .from('documents')
          .select('case_id')
          .eq('organization_id', profile.organization_id)
          .ilike('file_name', fileNameCandidate)
          .not('case_id', 'is', null)
          .limit(1)
          .maybeSingle();

        if (docData?.case_id) {
          resolvedCaseId = docData.case_id;
        }
      }
    }
  }

  return deduplicateAndInsert({
    titulo: input.titulo,
    fecha: input.fecha,
    detalle: input.detalle?.trim() || null,
    categoria: 'plazo',
    hora: null,
    caseId: resolvedCaseId,
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

export async function eliminarEventoAgenda(id: string): Promise<{ ok: boolean; mensaje?: string }> {
  const { user, profile } = await getUserProfile();
  if (!user || !profile) return { ok: false, mensaje: 'No autenticado' };
  if (!isUserRole(profile.role) || !canUpdateCase(profile.role)) {
    return { ok: false, mensaje: 'Sin permisos para eliminar' };
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from('agenda_plazos')
    .delete()
    .eq('id', id)
    .eq('organization_id', profile.organization_id);

  if (error) {
    return { ok: false, mensaje: error.message };
  }

  await createAuditLog({
    organizationId: profile.organization_id,
    userId: user.id,
    action: 'agenda_event_deleted',
    resourceType: 'organization',
    resourceId: profile.organization_id,
    metadata: { id },
  });

  revalidatePath('/agenda');
  return { ok: true };
}

export type EditarEventoAgendaInput = {
  id: string;
  titulo: string;
  fecha: string;
  hora?: string | null;
  categoria?: 'manual' | 'plazo' | 'turno' | 'firma';
  detalle?: string | null;
  caseId?: string | null;
};

export type EditarEventoAgendaResult = {
  ok: boolean;
  motivo?: 'no_auth' | 'no_encontrado' | 'error';
  mensaje?: string;
};

export async function editarEventoAgenda(input: EditarEventoAgendaInput): Promise<EditarEventoAgendaResult> {
  const { user, profile } = await getUserProfile();
  if (!user || !profile) return { ok: false, motivo: 'no_auth', mensaje: 'No autenticado.' };
  if (!isUserRole(profile.role) || !canUpdateCase(profile.role)) {
    return { ok: false, motivo: 'no_auth', mensaje: 'Sin permisos para editar eventos.' };
  }

  const id = input.id?.trim();
  if (!id) return { ok: false, motivo: 'error', mensaje: 'ID de evento requerido.' };

  const tituloInput = input.titulo?.trim();
  if (!tituloInput) return { ok: false, motivo: 'error', mensaje: 'El título es obligatorio.' };

  const fechaNorm = normalizeDateLocal(input.fecha);
  if (!fechaNorm) return { ok: false, motivo: 'error', mensaje: 'Fecha inválida.' };

  let horaValida: string | null = null;
  try {
    horaValida = validateTime(input.hora ?? null);
  } catch (err: any) {
    return { ok: false, motivo: 'error', mensaje: err.message };
  }

  const supabase = await createClient();

  const caseId = input.caseId?.trim() || null;
  if (caseId) {
    const { data: caseData } = await supabase
      .from('cases')
      .select('id')
      .eq('id', caseId)
      .eq('organization_id', profile.organization_id)
      .maybeSingle();

    if (!caseData) {
      return { ok: false, motivo: 'error', mensaje: 'Expediente no encontrado o sin acceso.' };
    }
  }

  const categoria = input.categoria || 'manual';

  const { data: existing, error: findError } = await supabase
    .from('agenda_plazos')
    .select('id, case_id')
    .eq('id', id)
    .eq('organization_id', profile.organization_id)
    .maybeSingle();

  if (findError) {
    return { ok: false, motivo: 'error', mensaje: findError.message };
  }
  if (!existing) {
    return { ok: false, motivo: 'no_encontrado', mensaje: 'Evento no encontrado o sin acceso.' };
  }

  const { error: updateError, data: updated } = await supabase
    .from('agenda_plazos')
    .update({
      titulo: tituloInput,
      fecha: fechaNorm,
      hora: horaValida,
      categoria,
      detalle: input.detalle?.trim() || null,
      case_id: caseId,
    })
    .eq('id', id)
    .eq('organization_id', profile.organization_id)
    .select('id')
    .single();

  if (updateError || !updated) {
    return { ok: false, motivo: 'error', mensaje: updateError?.message || 'Error al persistir cambios.' };
  }

  await createAuditLog({
    organizationId: profile.organization_id,
    userId: user.id,
    action: 'agenda_event_updated',
    resourceType: caseId ? 'case' : 'organization',
    resourceId: caseId || profile.organization_id,
    metadata: {
      id,
      titulo: tituloInput,
      fecha: fechaNorm,
      hora: horaValida,
      categoria,
      caseId,
    },
  });

  revalidatePath('/agenda');
  if (caseId) revalidatePath(`/expedientes/${caseId}`);
  if (existing.case_id && existing.case_id !== caseId) {
    revalidatePath(`/expedientes/${existing.case_id}`);
  }

  return { ok: true };
}
