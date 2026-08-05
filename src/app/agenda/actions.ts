'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getUserProfile } from '@/lib/auth/getUserProfile';
import { canUpdateCase } from '@/lib/permissions/roles';

export type GuardarEventoResult =
  | { ok: true; created?: boolean; existing?: boolean; mensaje?: string }
  | { ok: false; motivo: 'no_auth' | 'error'; mensaje?: string };

function normalizeDateLocal(dateStr: string | undefined): string | null {
  if (!dateStr) return null;
  const str = dateStr.trim();
  if (!str) return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    return str;
  }

  try {
    const d = new Date(str);
    if (Number.isNaN(d.getTime())) return null;

    const formatter = new Intl.DateTimeFormat('es-AR', {
      timeZone: 'America/Argentina/Buenos_Aires',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    const parts = formatter.formatToParts(d);
    let y = '', m = '', day = '';
    for (const p of parts) {
      if (p.type === 'year') y = p.value;
      if (p.type === 'month') m = p.value;
      if (p.type === 'day') day = p.value;
    }
    if (y && m && day) return `${y}-${m}-${day}`;
    return null;
  } catch {
    return null;
  }
}

function normalizeTitle(title: string): string {
  return title
    .normalize('NFC')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

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

  if (!canUpdateCase(profile.role as any)) {
    return { ok: false, motivo: 'no_auth', mensaje: 'No tenés permisos para esta acción.' };
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
    .select('id, titulo')
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
    const exists = candidates.some((c) => normalizeTitle(c.titulo || '') === tituloNorm);
    if (exists) {
      return { ok: true, created: false, existing: true };
    }
  }

  const { error } = await supabase.from('agenda_plazos').insert({
    organization_id: profile.organization_id,
    titulo: tituloInput,
    fecha: fechaNorm,
    hora: input.hora,
    detalle: input.detalle,
    categoria: input.categoria,
    created_by: user.id,
    case_id: input.caseId,
  });

  if (error) return { ok: false, motivo: 'error', mensaje: error.message };

  revalidatePath('/agenda');
  if (input.caseId) revalidatePath(`/expedientes/${input.caseId}`);
  return { ok: true, created: true };
}

export async function guardarEventoManual(input: {
  titulo: string;
  fecha: string;
  detalle?: string;
  caseId?: string;
}): Promise<GuardarEventoResult> {
  return deduplicateAndInsert({
    titulo: input.titulo,
    fecha: input.fecha,
    detalle: input.detalle?.trim() || null,
    categoria: 'manual',
    hora: null,
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
