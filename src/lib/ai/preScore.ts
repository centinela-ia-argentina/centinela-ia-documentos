import 'server-only';

export type NivelCalificacion = 'apto' | 'condicional' | 'no_apto' | 'insuficiente_info' | 'indeterminado';

export type PreScoreInquilino = {
  nivel_calificacion: NivelCalificacion;
  ingreso_neto_mensual_estimado: number | null;
  moneda_ingreso: string | null;
  alquiler_mensual: number;
  veces_alquiler: number | null;
  regla_recomendada: string;
  observaciones_ingresos: string[];
  garantias: string[];
  gravamenes_detectados: string[];
  senales_alerta: string[];
  verificaciones_pendientes: string[];
  fundamento: string;
};

type DocInput = { nombre: string; tipo: string; resumen: string; alertas: string[]; datos: string[] };

export async function calificarInquilinoConIA(input: {
  titulo: string;
  alquilerMensual: number;
  moneda: string;
  documentos: DocInput[];
}): Promise<
  | { ok: false; motivo: 'sin_api_key' | 'sin_datos' | 'error' }
  | { ok: true; prescore: PreScoreInquilino; model: string }
> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return { ok: false, motivo: 'sin_api_key' };
  if (input.documentos.length === 0) return { ok: false, motivo: 'sin_datos' };
  
  const modelo = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
  const docsTexto = input.documentos.map((d, i) =>
    `Documento ${i + 1}: ${d.nombre} (${d.tipo})\nResumen: ${d.resumen}\nDatos clave: ${d.datos.join('; ') || '-'}\nAlertas: ${d.alertas.join('; ') || '-'}`
  ).join('\n\n');
  
  const prompt = [
    'Sos un analista de riesgo crediticio especializado en evaluar postulantes a alquileres residenciales en Argentina. Vas a evaluar la aptitud de un inquilino y la solidez de sus garantías a partir de los documentos ya analizados (recibos de sueldo, DNI, informe de dominio de la garantía, contrato laboral, etc.).',
    'Tu tarea es EXTRAER datos, NO calcular el veredicto final (eso lo hace el sistema con una regla fija).',
    'Estimá el INGRESO NETO MENSUAL del inquilino promediando los recibos de sueldo disponibles (si hay varios, usá el promedio; si es monotributista u otro, estimá con lo que haya). Identificá también la MONEDA en la que está expresado ese ingreso (ARS o USD). Evaluá las garantías presentadas (propietaria, recibo de sueldo, seguro de caución) y, si hay informe de dominio de una garantía propietaria, detectá gravámenes como usufructo, hipoteca, embargo o inhibición.',
    'Respondé SOLO un objeto JSON válido (sin texto adicional) con esta forma exacta:',
    '{',
    '  "ingreso_neto_mensual_estimado": number | null,',
    '  "moneda_ingreso": "ARS" | "USD" | null,',
    '  "observaciones_ingresos": ["cómo estimaste el ingreso, cantidad de recibos, antigüedad, tipo de relación laboral"],',
    '  "garantias": ["tipo y estado de cada garantía presentada"],',
    '  "gravamenes_detectados": ["usufructo/hipoteca/embargo/inhibición sobre la garantía propietaria, con detalle si surge"],',
    '  "senales_alerta": ["señales de alerta relevantes (recibos inconsistentes, garantía sin cobertura, etc.)"],',
    '  "verificaciones_pendientes": ["controles que faltan, ej: recibo de sueldo faltante, informe de dominio actualizado, DNI del garante"],',
    '  "fundamento": "explicación breve del análisis"',
    '}',
    'Reglas CRÍTICAS: NO inventes montos ni datos. Si no podés estimar el ingreso, poné null en "ingreso_neto_mensual_estimado" y explicá por qué en "verificaciones_pendientes". Devolvé los montos como números planos, sin símbolo $ ni separadores de miles. Este es un apoyo ORIENTATIVO al criterio del corredor, no un dictamen financiero.',
    '',
    `POSTULACIÓN: ${input.titulo}`,
    `Alquiler mensual pretendido: ${input.alquilerMensual} ${input.moneda || 'ARS'}`,
    '',
    'DOCUMENTOS ANALIZADOS:',
    docsTexto || '(sin documentos analizados)',
  ].join('\n');
  
  try {
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
    if (!resp.ok) { console.error('PreScore Gemini error:', resp.status, await resp.text()); return { ok: false, motivo: 'error' }; }
    const data = await resp.json();
    const raw: string = data?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? '').join('') ?? '';
    if (!raw.trim()) return { ok: false, motivo: 'error' };
    const parsed = JSON.parse(raw);
    const arr = (v: unknown): string[] => (Array.isArray(v) ? v.map((x) => String(x)) : []);
    const ingreso = typeof parsed.ingreso_neto_mensual_estimado === 'number' && isFinite(parsed.ingreso_neto_mensual_estimado)
      ? parsed.ingreso_neto_mensual_estimado
      : null;
    const monedaIngreso = typeof parsed.moneda_ingreso === 'string' && (parsed.moneda_ingreso === 'ARS' || parsed.moneda_ingreso === 'USD') ? parsed.moneda_ingreso : null;
    const alquiler = input.alquilerMensual > 0 ? input.alquilerMensual : 0;
    const monedaAlquiler = typeof input.moneda === 'string' && (input.moneda === 'ARS' || input.moneda === 'USD') ? input.moneda : null;
    const gravamenes = arr(parsed.gravamenes_detectados);
    
    let nivel: NivelCalificacion;
    let veces: number | null = null;
    let regla: string = 'Ingresos netos ≥ 3x el valor del alquiler';

    const monedasIncompatibles = !monedaIngreso || !monedaAlquiler || monedaIngreso !== monedaAlquiler;

    if (ingreso != null && alquiler > 0 && monedasIncompatibles) {
      nivel = 'indeterminado';
      regla = 'No se puede comparar el ingreso con el alquiler porque las monedas no coinciden o no están identificadas. Verificá los importes antes de continuar.';
    } else {
      veces = ingreso != null && alquiler > 0 ? Number((ingreso / alquiler).toFixed(2)) : null;
      if (veces == null) {
        nivel = 'insuficiente_info';
      } else if (veces >= 3) {
        nivel = 'apto';
      } else if (veces >= 2) {
        nivel = 'condicional';
      } else {
        nivel = 'no_apto';
      }
      
      // Con gravámenes sobre la garantía no puede quedar "apto" solo por ingresos.
      if (nivel === 'apto' && gravamenes.length > 0) {
        nivel = 'condicional';
      }
    }
    
    return {
      ok: true, model: `prescore-${modelo}`,
      prescore: {
        nivel_calificacion: nivel,
        ingreso_neto_mensual_estimado: ingreso,
        moneda_ingreso: monedaIngreso,
        alquiler_mensual: alquiler,
        veces_alquiler: veces,
        regla_recomendada: regla,
        observaciones_ingresos: arr(parsed.observaciones_ingresos),
        garantias: arr(parsed.garantias),
        gravamenes_detectados: gravamenes,
        senales_alerta: arr(parsed.senales_alerta),
        verificaciones_pendientes: arr(parsed.verificaciones_pendientes),
        fundamento: String(parsed.fundamento ?? ''),
      },
    };
  } catch (e) { console.error('PreScore parse error:', e); return { ok: false, motivo: 'error' }; }
}
