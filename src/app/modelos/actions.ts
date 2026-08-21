'use server';

import { getUserProfile } from '@/lib/auth/getUserProfile';
import { canUseAi } from '@/lib/permissions/roles';
import { createAuditLog } from '@/lib/audit/createAuditLog';
import { createClient } from '@/lib/supabase/server';

export type RedactarResult =
  | { ok: true; texto: string }
  | { ok: false; motivo: 'sin_key' | 'sin_permiso' | 'error' };

export async function redactarEscritoIA(input: {
  titulo: string;
  cuerpo: string;
  valores: Record<string, string>;
  instruccion: string;
  industria?: string;
}): Promise<RedactarResult> {
  const { user, profile } = await getUserProfile();
  if (!user || !profile) return { ok: false, motivo: 'sin_permiso' };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (!canUseAi(profile.role as any)) return { ok: false, motivo: 'sin_permiso' };

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return { ok: false, motivo: 'sin_key' };

  const modelo = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

  const datos = Object.entries(input.valores)
    .filter(([, v]) => v && v.trim())
    .map(([k, v]) => `- ${k}: ${v}`)
    .join('\n');

  const industriaModelo = input.industria || 'legal';
  const persona =
    industriaModelo === 'escribania'
      ? 'Sos un escribano/a argentino/a experto/a en redacción de instrumentos notariales. Redactá un documento formal, claro y bien estructurado, en español rioplatense con estilo notarial.'
      : industriaModelo === 'inmobiliaria'
      ? 'Sos un asesor/a inmobiliario/a argentino/a con experiencia en la redacción de instrumentos de la operación inmobiliaria (reservas, autorizaciones de venta, boletos de compraventa). Redactá un documento formal, claro y bien estructurado, en español rioplatense, con lenguaje profesional pero llano.'
      : 'Sos un asistente jurídico argentino experto. Redactá un escrito formal, claro y bien estructurado, en español rioplatense con estilo forense.';
  const tipoDoc = industriaModelo === 'legal' ? 'escrito' : 'documento';

  const prompt = [
    persona,
    'Tomá como base la siguiente plantilla: respetá su estructura y reemplazá las variables entre llaves dobles con los datos provistos.',
    '',
    `TÍTULO DEL MODELO: ${input.titulo}`,
    '',
    'PLANTILLA:',
    input.cuerpo,
    '',
    'DATOS DISPONIBLES DEL EXPEDIENTE:',
    datos || '(sin datos precargados)',
    '',
    'INSTRUCCIÓN DEL ABOGADO:',
    input.instruccion || '(sin instrucción adicional)',
    '',
    'REGLAS ESTRICTAS:',
    '- Completá los campos con los datos disponibles.',
    '- Donde falte información, dejá un marcador entre corchetes, ej: [COMPLETAR: domicilio].',
    '- NO inventes datos personales, montos, fechas ni artículos legales que no te hayan dado.',
    `- Devolvé SOLO el texto del ${tipoDoc}, sin explicaciones ni comentarios previos.`,
  ].join('\n');

  try {
    const resp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.4, maxOutputTokens: 2048 },
        }),
      }
    );

    if (!resp.ok) {
      console.error('Gemini error:', resp.status, await resp.text());
      return { ok: false, motivo: 'error' };
    }

    const data = await resp.json();
    const texto: string =
      data?.candidates?.[0]?.content?.parts
        ?.map((p: { text?: string }) => p.text ?? '')
        .join('') ?? '';

    if (!texto.trim()) return { ok: false, motivo: 'error' };

    await createAuditLog({
      organizationId: profile.organization_id,
      userId: user.id,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      action: 'ai_model_generated' as any,
      resourceType: 'organization',
      resourceId: profile.organization_id,
      metadata: { entity_id: input.titulo, details: { industria: input.industria } }
    });

    return { ok: true, texto: texto.trim() };
  } catch (e) {
    console.error('Gemini fetch error:', e);
    return { ok: false, motivo: 'error' };
  }
}

export type RevisionEscrito = {
  puntuacion: number; // 0-100
  semaforo: 'verde' | 'amarillo' | 'rojo';
  resumen: string;
  secciones_faltantes: string[];
  errores: string[];
  datos_incompletos: string[];
  sugerencias: string[];
  checklist: { item: string; ok: boolean }[];
};

export type RevisionResult =
  | { ok: true; revision: RevisionEscrito }
  | { ok: false; motivo: 'sin_key' | 'sin_permiso' | 'sin_texto' | 'error' };

export async function revisarEscritoIA(input: { texto: string }): Promise<RevisionResult> {
  const { user, profile } = await getUserProfile();
  if (!user || !profile) return { ok: false, motivo: 'sin_permiso' };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (!canUseAi(profile.role as any)) return { ok: false, motivo: 'sin_permiso' };

  const texto = input.texto?.trim();
  if (!texto || texto.length < 40) return { ok: false, motivo: 'sin_texto' };

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return { ok: false, motivo: 'sin_key' };

  const modelo = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

  const prompt = [
    'Sos un abogado senior argentino, revisor de escritos judiciales. Revisá el ESCRITO que te paso y devolvé una auditoría profesional, clara y accionable, para que un abogado lo mejore antes de presentarlo.',
    'Respondé SOLO un objeto JSON válido (sin texto adicional) con esta forma exacta:',
    '{',
    '  "puntuacion": número 0-100 (qué tan listo está para presentar),',
    '  "semaforo": "verde" | "amarillo" | "rojo",',
    '  "resumen": "2-3 oraciones con la valoración general",',
    '  "secciones_faltantes": ["secciones formales que faltan o están flojas: encabezado/carátula, objeto, hechos, derecho, prueba, petitorio, firma, etc."],',
    '  "errores": ["errores, contradicciones o inconsistencias concretas del texto"],',
    '  "datos_incompletos": ["datos o marcadores sin completar: nombre, domicilio, monto, fecha, número de expediente, etc."],',
    '  "sugerencias": ["mejoras de redacción, claridad y fundamentación"],',
    '  "checklist": [{"item": "requisito de presentación", "ok": true/false}]',
    '}',
    'Reglas ESTRICTAS:',
    '- NO inventes ni corrijas datos personales, montos, fechas ni números de expediente: si faltan, marcalos en "datos_incompletos".',
    '- Referite solo a artículos o normativa que YA aparezcan en el escrito; NO inventes citas legales. Si una cita parece dudosa, señalala en "errores" como "verificar cita".',
    '- Si algo no aplica, devolvé un array vacío. Basate SOLO en el texto aportado.',
    '',
    'ESCRITO A REVISAR:',
    texto,
  ].join('\n');

  try {
    // Usá EXACTAMENTE la misma URL de fetch que ya usa redactarEscritoIA en este archivo.
    const resp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.2, responseMimeType: 'application/json' },
        }),
      }
    );

    if (!resp.ok) {
      console.error('Revisión Gemini error:', resp.status, await resp.text());
      return { ok: false, motivo: 'error' };
    }

    const data = await resp.json();
    const raw: string =
      data?.candidates?.[0]?.content?.parts
        ?.map((p: { text?: string }) => p.text ?? '')
        .join('') ?? '';
    if (!raw.trim()) return { ok: false, motivo: 'error' };

    const parsed = JSON.parse(raw);
    const arr = (v: unknown): string[] => (Array.isArray(v) ? v.map((x) => String(x)) : []);
    const semaforo: RevisionEscrito['semaforo'] =
      parsed.semaforo === 'verde' || parsed.semaforo === 'rojo' ? parsed.semaforo : 'amarillo';
    const punt = Number(parsed.puntuacion);
    const checklist = Array.isArray(parsed.checklist)
      ? parsed.checklist
          .map((c: { item?: unknown; ok?: unknown }) => ({ item: String(c?.item ?? ''), ok: Boolean(c?.ok) }))
          .filter((c: { item: string }) => c.item)
      : [];

    const supabase = await createClient();
    await supabase.from('audit_logs').insert({
      organization_id: profile.organization_id,
      user_id: user.id,
      action: 'AI_ESCRITO_REVISADO',
      entity_type: 'escrito',
      entity_id: 'revision',
      details: { longitud: texto.length, puntuacion: punt },
      ip_address: null
    });

    return {
      ok: true,
      revision: {
        puntuacion: Number.isFinite(punt) ? Math.max(0, Math.min(100, Math.round(punt))) : 0,
        semaforo,
        resumen: String(parsed.resumen ?? ''),
        secciones_faltantes: arr(parsed.secciones_faltantes),
        errores: arr(parsed.errores),
        datos_incompletos: arr(parsed.datos_incompletos),
        sugerencias: arr(parsed.sugerencias),
        checklist,
      },
    };
  } catch (e) {
    console.error('Revisión parse error:', e);
    return { ok: false, motivo: 'error' };
  }
}
