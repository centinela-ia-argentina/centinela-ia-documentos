'use server';

import { createClient } from '@/lib/supabase/server';
import { getUserProfile } from '@/lib/auth/getUserProfile';
import { normalizeIndustryType } from '@/lib/industries/documentTypes';
import { canUseAi } from '@/lib/permissions/roles';
import {
  responderAgenteLegajo,
  type MensajeChat,
  type AccionPropuesta,
} from '@/lib/ai/agente';

function diasDesdeHoy(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return NaN;
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const f = new Date(y, m - 1, d);
  f.setHours(0, 0, 0, 0);
  return Math.round((f.getTime() - hoy.getTime()) / 86_400_000);
}

export async function preguntarAgenteGlobal(input: {
  historial: MensajeChat[];
  pregunta: string;
}): Promise<
  | { ok: false; motivo: string }
  | { ok: true; respuesta: string; acciones: AccionPropuesta[] }
> {
  const pregunta = (input.pregunta ?? '').trim();
  if (!pregunta) return { ok: false, motivo: 'Escribí una pregunta.' };

  const { user, profile } = await getUserProfile();
  if (!user || !profile) return { ok: false, motivo: 'Sesión no válida.' };
  if (!canUseAi(profile.role))
    return { ok: false, motivo: 'No tenés permiso para usar la IA.' };

  const supabase = await createClient();

  const { data: organization } = await supabase
    .from('organizations')
    .select('industry_type')
    .eq('id', profile.organization_id)
    .maybeSingle();
  const industry = normalizeIndustryType(organization?.industry_type);

  const [casesResult, docsResult, plazosResult] = await Promise.all([
    supabase
      .from('cases')
      .select('id, title, client_name, case_type, status')
      .eq('organization_id', profile.organization_id)
      .neq('status', 'archived')
      .neq('status', 'Archivado'),
    supabase
      .from('documents')
      .select('file_name, expires_at, case_id')
      .eq('organization_id', profile.organization_id)
      .not('expires_at', 'is', null),
    supabase
      .from('agenda_plazos')
      .select('titulo, fecha, detalle, case_id')
      .eq('organization_id', profile.organization_id),
  ]);

  const cases = casesResult.data ?? [];
  const documents = docsResult.data ?? [];
  const plazos = plazosResult.data ?? [];

  const caseTitleById = new Map<string, string>();
  for (const c of cases) caseTitleById.set(c.id, c.title || 'Expediente sin título');

  const partes: string[] = [];
  partes.push('VISTA GLOBAL DE LA ORGANIZACIÓN (todos los legajos activos).');
  partes.push(`Total de legajos activos: ${cases.length}.`);

  if (cases.length) {
    partes.push('\nLEGAJOS ACTIVOS:');
    partes.push(
      cases
        .slice(0, 40)
        .map(
          (c) =>
            `- ${c.title ?? 'Sin título'} | Cliente: ${c.client_name ?? '-'} | Tipo: ${c.case_type ?? '-'} | Estado: ${c.status ?? '-'}`
        )
        .join('\n')
    );
  }

  const alertas: string[] = [];
  for (const d of documents) {
    if (!d.expires_at) continue;
    const f = String(d.expires_at).slice(0, 10);
    const n = diasDesdeHoy(f);
    if (Number.isNaN(n) || n < -90 || n > 30) continue;
    const ctx = d.case_id ? caseTitleById.get(d.case_id) ?? 'Documento' : 'Documento suelto';
    alertas.push(
      `- ${f} (${n < 0 ? `vencido hace ${Math.abs(n)}d` : `en ${n}d`}) Vence documento "${d.file_name}" — ${ctx}`
    );
  }
  for (const p of plazos) {
    if (!p.fecha) continue;
    const f = String(p.fecha).slice(0, 10);
    const n = diasDesdeHoy(f);
    if (Number.isNaN(n) || n < -90 || n > 30) continue;
    const ctx = p.case_id ? caseTitleById.get(p.case_id) ?? 'Agenda' : 'Agenda general';
    alertas.push(
      `- ${f} (${n < 0 ? `vencido hace ${Math.abs(n)}d` : `en ${n}d`}) ${p.titulo ?? 'Plazo'} — ${ctx}`
    );
  }

  if (alertas.length) {
    partes.push(
      '\nALERTAS TEMPRANAS (vencimientos y plazos; vencidos recientes y próximos 30 días):'
    );
    partes.push(alertas.join('\n'));
  } else {
    partes.push('\nNo hay vencimientos ni plazos próximos (30 días).');
  }

  const contextoLegajo = partes.join('\n');

  const historial = Array.isArray(input.historial)
    ? input.historial
        .filter(
          (m) =>
            m && (m.rol === 'user' || m.rol === 'model') && typeof m.texto === 'string'
        )
        .slice(-12)
    : [];

  const res = await responderAgenteLegajo({
    industry,
    contextoLegajo,
    historial,
    pregunta,
  });

  if (!res.ok) {
    const motivo =
      res.motivo === 'sin_api_key'
        ? 'La IA no está configurada (falta la API key).'
        : 'No pude generar una respuesta. Probá de nuevo.';
    return { ok: false, motivo };
  }
  // Blindaje para agente global: las propuestas de acciones se eliminan de esta vista
  return { ok: true, respuesta: res.respuesta, acciones: [] };
}
