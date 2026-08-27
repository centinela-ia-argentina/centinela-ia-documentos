import 'server-only';

export type BorradorEscritura = {
  titulo: string;
  cuerpo: string;
  datos_faltantes: string[];
  advertencias: string[];
};

type DocInput = { nombre: string; tipo: string; resumen: string; alertas: string[]; datos: string[] };

export async function redactarEscrituraConIA(input: {
  titulo: string;
  tipoActo: string;
  comparecientes: string;
  registroProtocolo: string;
  fechaOtorgamiento: string;
  resumenGeneral: string;
  documentos: DocInput[];
}): Promise<
  | { ok: false; motivo: 'sin_api_key' | 'sin_datos' | 'error' }
  | { ok: true; borrador: BorradorEscritura; model: string }
> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return { ok: false, motivo: 'sin_api_key' };
  if (input.documentos.length === 0 && !input.resumenGeneral.trim()) {
    return { ok: false, motivo: 'sin_datos' };
  }

  const modelo = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

  const docsTexto = input.documentos.map((d, i) =>
    `Documento ${i + 1}: ${d.nombre} (${d.tipo})\nResumen: ${d.resumen}\nDatos clave: ${d.datos.join('; ') || '-'}\nAlertas: ${d.alertas.join('; ') || '-'}`
  ).join('\n\n');

  const prompt = [
    'Sos un escribano público argentino con amplia experiencia en redacción de escrituras y actos notariales. En base a los datos del legajo y a los documentos ya analizados, redactá un BORRADOR de escritura pública, claro y con estructura notarial profesional en español rioplatense.',
    'Estructura sugerida del cuerpo (adaptala al tipo de acto): encabezado y número, lugar y fecha, comparecencia e identificación de los comparecientes, antecedentes de dominio/título, objeto del acto, precio y forma de pago (si corresponde), estado de ocupación y entrega de posesión (si corresponde), certificados y libre de gravámenes/inhibiciones, cláusulas especiales, y cierre/otorgamiento.',
    'Respondé SOLO un objeto JSON válido (sin texto adicional) con esta forma exacta:',
    '{',
    '  "titulo": "título breve del borrador, ej: Borrador de escritura de compraventa",',
    '  "cuerpo": "el texto completo del borrador de escritura, con saltos de línea",',
    '  "datos_faltantes": ["datos que faltan y hay que completar antes de otorgar"],',
    '  "advertencias": ["riesgos, certificados vencidos o puntos a revisar"]',
    '}',
    'Reglas CRÍTICAS: NO inventes datos, nombres, DNI/CUIT, matrículas ni montos. SI el dato se encuentra en el legajo o en los "DOCUMENTOS ANALIZADOS", DEBÉS COMPLETARLO en la escritura (usá los DNI, nombres, inmuebles, fechas y montos extraídos). SÓLO usá un marcador entre corchetes como [COMPLETAR: dato] cuando la información realmente falte. Basate SOLO en la información aportada. Este es un BORRADOR de trabajo que el escribano debe revisar y completar; no es un instrumento definitivo.',
    '',
    `LEGAJO: ${input.titulo}`,
    `Tipo de acto: ${input.tipoActo || '-'}`,
    `Comparecientes (dato del legajo): ${input.comparecientes || '-'}`,
    `Registro / protocolo: ${input.registroProtocolo || '-'}`,
    `Fecha de otorgamiento: ${input.fechaOtorgamiento || '-'}`,
    '',
    'RESUMEN DEL EXPEDIENTE:',
    input.resumenGeneral || '(sin resumen)',
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
          generationConfig: { temperature: 0.3, responseMimeType: 'application/json' },
        }),
      }
    );
    if (!resp.ok) { console.error('Escritura Gemini error:', resp.status, await resp.text()); return { ok: false, motivo: 'error' }; }
    const data = await resp.json();
    const raw: string = data?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? '').join('') ?? '';
    if (!raw.trim()) return { ok: false, motivo: 'error' };
    const parsed = JSON.parse(raw);
    const arr = (v: unknown): string[] => (Array.isArray(v) ? v.map((x) => String(x)) : []);
    return {
      ok: true, model: `escritura-${modelo}`,
      borrador: {
        titulo: String(parsed.titulo ?? 'Borrador de escritura'),
        cuerpo: String(parsed.cuerpo ?? ''),
        datos_faltantes: arr(parsed.datos_faltantes),
        advertencias: arr(parsed.advertencias),
      },
    };
  } catch (e) { console.error('Escritura parse error:', e); return { ok: false, motivo: 'error' }; }
}
