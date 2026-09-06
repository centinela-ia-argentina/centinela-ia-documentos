import 'server-only';

export type BorradorEscritura = {
  titulo: string;
  cuerpo: string;
  datos_faltantes: string[];
  advertencias: string[];
};

type DocInput = { nombre: string; tipo: string; resumen: string; alertas: string[]; datos: string[] };

import { parsearFechaCualquiera } from '@/lib/plazos/fechasCanonicas';

export const LEYENDA_ORIGEN_FONDOS_FALTANTE =
  '[COMPLETAR/VERIFICAR: declaración y documentación respaldatoria sobre medios y origen de fondos]';

export const CLAUSULA_AUTONOMA_UIF =
  'QUINTO: MEDIOS DE PAGO Y ORIGEN DE FONDOS. [COMPLETAR/VERIFICAR: declaración y documentación respaldatoria sobre medios y origen de fondos].';

export const LEYENDA_ITI_DEROGADO =
  'I.T.I.: No resulta aplicable por encontrarse derogado conforme Ley 27.743 para operaciones otorgadas a partir del 08/07/2024.';

export const PATRONES_AFIRMACION_FONDOS_LICITOS = [
  /manifiestan?\s+(?:bajo\s+juramento\s+)?que\s+los\s+fondos\s+(?:utilizados\s+)?provienen\s+de\s+(?:actividades\s+)?l[ií]citas/i,
  /los\s+fondos\s+(?:utilizados\s+)?provienen\s+de[^.;!\n]*/i,
  /origen\s+(?:de\s+los\s+fondos\s+es\s+)?l[ií]cito/i,
  /fondos\s+(?:son\s+)?(?:de\s+)?(?:origen\s+l[ií]cito|l[ií]cito\s+origen)/i,
  /declaran?\s+(?:que\s+)?los\s+fondos\s+(?:son\s+)?l[ií]citos/i,
  /fondos\s+l[ií]citos/i,
  /cumplimiento\s+(?:estricto\s+)?(?:de|a)\s+(?:las\s+(?:normas|disposiciones)\s+de\s+)?(?:la\s+)?(?:uif|unidad\s+de\s+informaci[oó]n\s+financiera)/i,
  /disposiciones\s+de\s+la\s+unidad\s+de\s+informaci[oó]n\s+financiera/i,
  /acreditando\s+(?:el\s+)?(?:origen\s+l[ií]cito|l[ií]cito\s+origen)/i,
  /justificaci[oó]n\s+(?:positiva\s+)?de\s+fondos/i,
  /l[ií]cito\s+origen/i,
  /origen\s+l[ií]cito/i,
];

export const PATRON_DISPARADOR_ORACION_UIF =
  /(?:fondos\s+(?:utilizados\s+)?(?:son\s+|provienen\s+de\s+)?(?:de\s+)?(?:l[ií]cito\s+origen|origen\s+l[ií]cito|actividades\s+l[ií]citas))|fondos\s+l[ií]citos|l[ií]cito\s+origen|origen\s+l[ií]cito|(?:cumplimiento\s+(?:estricto\s+)?(?:de\s+|a\s+)?(?:las\s+)?disposiciones\s+(?:de\s+la\s+)?(?:uif|unidad\s+de\s+informaci[oó]n\s+financiera))|(?:disposiciones\s+de\s+la\s+unidad\s+de\s+informaci[oó]n\s+financiera)|(?:acredit(?:ando|ado|an|a)\s+(?:el\s+)?(?:origen\s+l[ií]cito|l[ií]cito\s+origen))|(?:justificaci[oó]n\s+(?:positiva\s+)?de\s+fondos)|(?:los\s+fondos\s+provienen\s+de)/i;

const TERMINOS_NEGATIVOS_UIF =
  /\b(?:no\s+acredita|sin\s+acreditar|no\s+consta|falta(?:n)?|pendiente(?:s)?|insuficiente(?:s)?|no\s+verificado|no\s+se\s+acredita|sin\s+justificar|no\s+justifica)\b/i;

/**
 * Evaluación fail-closed de evidencia de origen de fondos.
 * Prioriza campo estructurado explícito con documento fuente.
 * Si falta o es ambiguo, asume false.
 * Descarta explícitamente términos negativos ("no acredita", "sin acreditar", etc.).
 */
export function evaluarEvidenciaOrigenFondosFailClosed(doc: {
  document_type?: string | null;
  file_name?: string | null;
  tipo_documental_detectado?: string | null;
  resumen?: string | null;
  datos_clave?: unknown;
  datos_relevantes?: unknown;
  origen_fondos_acreditado?: boolean | null;
  documento_fuente_uif?: string | null;
  [key: string]: unknown;
} | null | undefined): boolean {
  if (!doc) return false;

  // 1. Si está explícitamente negado
  if (doc.origen_fondos_acreditado === false) {
    return false;
  }

  const resumen = String(doc.resumen || '');
  const datos = JSON.stringify([
    ...(Array.isArray(doc.datos_clave) ? doc.datos_clave : []),
    ...(Array.isArray(doc.datos_relevantes) ? doc.datos_relevantes : []),
  ]);
  const combinedText = `${resumen} ${datos}`.toLowerCase();

  // 2. Descarte explícito de términos negativos (fail-closed)
  if (TERMINOS_NEGATIVOS_UIF.test(combinedText)) {
    return false;
  }

  // 3. Campo estructurado explícito con documento fuente trazable
  if (doc.origen_fondos_acreditado === true && Boolean(doc.documento_fuente_uif || doc.document_type || doc.file_name)) {
    return true;
  }

  // 4. Si no tiene flag estructurado afirmativo, fail-closed por defecto
  return false;
}

export function aplicarGuardrailOrigenFondos(
  borrador: BorradorEscritura,
  tieneEvidencia: boolean
): BorradorEscritura {
  let cuerpo = borrador.cuerpo;
  const datosFaltantes = [...borrador.datos_faltantes];
  const advertencias = [...borrador.advertencias];

  if (!tieneEvidencia) {
    // 1. Reemplazo de cualquier cláusula u oración que mencione licitud / origen de fondos / UIF
    // por la cláusula autónoma estandarizada
    const lineas = cuerpo.split('\n');
    let clausulaInsertada = false;

    const lineasProcesadas = lineas.map((linea) => {
      if (!PATRON_DISPARADOR_ORACION_UIF.test(linea) && !/origen\s+de\s+fondos/i.test(linea)) {
        return linea;
      }

      if (!clausulaInsertada) {
        clausulaInsertada = true;
        return CLAUSULA_AUTONOMA_UIF;
      }
      return '';
    });

    cuerpo = lineasProcesadas.filter((l, i, arr) => l !== '' || (i > 0 && arr[i - 1] !== '')).join('\n');

    // 2. Barrido secundario fail-safe: eliminar cualquier fragmento residual de afirmación positiva de licitud o UIF
    for (const pat of PATRONES_AFIRMACION_FONDOS_LICITOS) {
      if (pat.test(cuerpo)) {
        cuerpo = cuerpo.replace(pat, '');
      }
    }

    // 3. Limpieza de residuos sintácticos producidos por la remoción
    cuerpo = cuerpo
      .replace(/,\s*,/g, ',')
      .replace(/\.\s*\./g, '.')
      .replace(/dando cumplimiento a las disposiciones[^.]*\./gi, '')
      .replace(/con fondos de lícito origen[^.]*\./gi, '')
      .replace(/los\s+fondos\s+provienen\s+de[^.\n;]*[.\n;]?/gi, '')
      .replace(/[ \t]{2,}/g, ' ');

    // 4. Si el cuerpo aún no contiene la cláusula autónoma, incorporarla en la sección de precio/pago o al final
    if (!cuerpo.includes(CLAUSULA_AUTONOMA_UIF) && !cuerpo.includes(LEYENDA_ORIGEN_FONDOS_FALTANTE)) {
      if (/(precio|pago|forma\s+de\s+pago)/i.test(cuerpo)) {
        cuerpo = cuerpo.replace(
          /((?:precio|pago|forma\s+de\s+pago)[^\n]*)(?:\n|$)/i,
          `$1\n\n${CLAUSULA_AUTONOMA_UIF}\n`
        );
      }
      if (!cuerpo.includes(CLAUSULA_AUTONOMA_UIF)) {
        cuerpo += `\n\n${CLAUSULA_AUTONOMA_UIF}`;
      }
    }

    // 5. Registrar en datos_faltantes si no figura
    const itemFaltante = LEYENDA_ORIGEN_FONDOS_FALTANTE;
    if (!datosFaltantes.some((d) => d.toLowerCase().includes('origen de fondos'))) {
      datosFaltantes.push(itemFaltante);
    }

    // 6. Advertencia de revisión profesional y entorno controlado
    const advUif =
      'Revisión profesional requerida: no consta documentación respaldatoria estructurada sobre origen y licitud de fondos. Las operaciones y personas de prueba son ficticias (entorno controlado).';
    if (!advertencias.some((a) => a.toLowerCase().includes('origen y licitud de fondos'))) {
      advertencias.push(advUif);
    }
  }

  return {
    ...borrador,
    cuerpo,
    datos_faltantes: datosFaltantes,
    advertencias,
  };
}

/**
 * Aplica el guardrail jurídico sobre el Impuesto a la Transferencia de Inmuebles (I.T.I.).
 * Conforme Ley 27.743, para operaciones a título oneroso otorgadas a partir del 08/07/2024,
 * el I.T.I. se encuentra derogado y no puede presentarse como retención o exención aplicable.
 * Respeta y preserva de forma estricta el C.O.T.I. (Código de Oferta de Transferencia de Inmuebles).
 */
export function aplicarGuardrailIti(
  borrador: BorradorEscritura,
  fechaOperacion?: string
): BorradorEscritura {
  let cuerpo = borrador.cuerpo;
  let datosFaltantes = [...borrador.datos_faltantes];
  let advertencias = [...borrador.advertencias];

  // Determinar si la operación es posterior al 08/07/2024 (derogación Ley 27.743)
  let esPostDerogacion = true; // Por defecto true para instrumentos actuales (2026)
  if (fechaOperacion) {
    const parsed = parsearFechaCualquiera(fechaOperacion);
    if (parsed) {
      esPostDerogacion = parsed.iso >= '2024-07-08';
    }
  }

  if (esPostDerogacion) {
    // Regex para identificar menciones de ITI asegurando que NO toque COTI / C.O.T.I.
    const patronMencionIti = /(?<!c\.?o\.?\s*)(?<!coti\s*)\b(?:i\.?t\.?i\.?|impuesto\s+a\s+la\s+transferencia\s+de\s+inmuebles)\b/i;

    if (patronMencionIti.test(cuerpo)) {
      const lineas = cuerpo.split('\n');
      const lineasProcesadas = lineas.map((linea) => {
        if (!patronMencionIti.test(linea)) return linea;

        // Si la línea contiene COTI, preservar COTI intacto y solo neutralizar las menciones de ITI
        if (/\b(?:c\.?o\.?t\.?i\.?|coti)\b/i.test(linea)) {
          return linea
            .replace(/(?:se\s+(?:retiene|deja\s+constancia\s+de\s+la\s+retenci[oó]n|abona)\s+(?:el\s+|la\s+|del\s+)?|retenci[oó]n\s+(?:del\s+)?|exenci[oó]n\s+(?:del\s+)?)(?:i\.?t\.?i\.?|impuesto\s+a\s+la\s+transferencia\s+de\s+inmuebles)(?:\s*\([^\)]*\))?(?:\s+del\s+[\d.,]+%)?(?:\s+correspondiente)?/gi, 'I.T.I. (no aplicable por Ley 27.743)')
            .replace(/(?<!c\.?o\.?\s*)(?<!coti\s*)(?:\bi\.t\.i\.|\biti\b|impuesto\s+a\s+la\s+transferencia\s+de\s+inmuebles)/gi, 'I.T.I. (no aplicable, derogado Ley 27.743)')
            .replace(/[ \t]{2,}/g, ' ')
            .trim();
        }

        // Si la línea NO contiene COTI y habla de retención/exención/alícuota de ITI:
        if (/(?:retenci[oó]n|exenci[oó]n|al[ií]cuota|pago|afip|no\s+retenci[oó]n)/i.test(linea)) {
          const ordinalMatch = linea.match(/^([A-ZÁÉÍÓÚÑ]+:\s*)/i);
          const prefijo = ordinalMatch ? ordinalMatch[1] : '';
          return `${prefijo}${LEYENDA_ITI_DEROGADO}`;
        }

        return linea
          .replace(/(?<!c\.?o\.?\s*)(?<!coti\s*)(?:\bi\.t\.i\.|\biti\b|impuesto\s+a\s+la\s+transferencia\s+de\s+inmuebles)/gi, 'I.T.I. (no aplicable, derogado Ley 27.743)')
          .replace(/[ \t]{2,}/g, ' ')
          .trim();
      });

      cuerpo = lineasProcesadas.join('\n');
    }

    // Filtrar requerimientos de ITI de datos_faltantes
    datosFaltantes = datosFaltantes.filter(
      (d) => !/(?<!c\.?o\.?\s*)(?<!coti\s*)\b(?:i\.?t\.?i\.?|impuesto\s+a\s+la\s+transferencia\s+de\s+inmuebles)\b/i.test(d)
    );

    // Ajustar advertencias que indiquen retención aplicable de ITI
    advertencias = advertencias.filter(
      (a) => !/(?:retenci[oó]n|aplicar|calcular)\s+(?:del?\s+)?(?:i\.?t\.?i\.?|impuesto\s+a\s+la\s+transferencia\s+de\s+inmuebles)/i.test(a)
    );
  }

  return {
    ...borrador,
    cuerpo,
    datos_faltantes: datosFaltantes,
    advertencias,
  };
}

export async function redactarEscrituraConIA(input: {
  titulo: string;
  tipoActo: string;
  comparecientes: string;
  registroProtocolo: string;
  fechaOtorgamiento: string;
  resumenGeneral: string;
  documentos: DocInput[];
  tieneEvidenciaOrigenFondos?: boolean;
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
    'Estructura sugerida del cuerpo (adaptala al tipo de acto): encabezado y número, lugar y fecha, comparecencia e identificación de los comparecientes, antecedentes de dominio/título, objeto del acto, precio y forma de pago (si corresponde), medios de pago y origen de fondos, estado de ocupación y entrega de posesión (si corresponde), certificados y libre de gravámenes/inhibiciones, cláusulas especiales, y cierre/otorgamiento.',
    'Respondé SOLO un objeto JSON válido (sin texto adicional) con esta forma exacta:',
    '{',
    '  "titulo": "título breve del borrador, ej: Borrador de escritura de compraventa",',
    '  "cuerpo": "el texto completo del borrador de escritura, con saltos de línea",',
    '  "datos_faltantes": ["datos que faltan y hay que completar antes de otorgar"],',
    '  "advertencias": ["riesgos, certificados vencidos o puntos a revisar"]',
    '}',
    'Reglas CRÍTICAS:',
    '1. NO inventes datos, nombres, DNI/CUIT, matrículas ni montos. SI el dato se encuentra en el legajo o en los "DOCUMENTOS ANALIZADOS", DEBÉS COMPLETARLO en la escritura (usá los DNI, nombres, inmuebles, fechas y montos extraídos). SÓLO usá un marcador entre corchetes como [COMPLETAR: dato] cuando la información realmente falte. Basate SOLO en la información aportada.',
    '2. ORIGEN DE FONDOS Y PLA/FT (UIF): PROHIBIDO terminantemente afirmar que los fondos son de origen lícito ni dar por cumplida la justificación sin respaldo documental estructurado y trazable en los documentos aportados. Prohibido inferir cumplimiento por el monto, el tipo de operación o la ausencia de alertas. Si NO consta documentación respaldatoria específica de origen de fondos, DEBÉS colocar obligatoriamente en la cláusula de medios y origen de fondos: "[COMPLETAR/VERIFICAR: declaración y documentación respaldatoria sobre medios y origen de fondos]", e incluir esa misma leyenda en "datos_faltantes".',
    '3. Este es un BORRADOR de trabajo sujeto a revisión y control notarial profesional; no es un instrumento definitivo.',
    '',
    `LEGAJO NOTARIAL: ${input.titulo}`,
    `Tipo de acto: ${input.tipoActo || '-'}`,
    `Comparecientes (dato del legajo): ${input.comparecientes || '-'}`,
    `Registro / protocolo: ${input.registroProtocolo || '-'}`,
    `Fecha de otorgamiento: ${input.fechaOtorgamiento || '-'}`,
    '',
    'RESUMEN DEL LEGAJO:',
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

    const rawBorrador: BorradorEscritura = {
      titulo: String(parsed.titulo ?? 'Borrador de escritura'),
      cuerpo: String(parsed.cuerpo ?? ''),
      datos_faltantes: arr(parsed.datos_faltantes),
      advertencias: arr(parsed.advertencias),
    };

    const conUif = aplicarGuardrailOrigenFondos(
      rawBorrador,
      Boolean(input.tieneEvidenciaOrigenFondos)
    );

    const borradorFinal = aplicarGuardrailIti(
      conUif,
      input.fechaOtorgamiento
    );

    return {
      ok: true,
      model: `escritura-${modelo}`,
      borrador: borradorFinal,
    };
  } catch (e) { console.error('Escritura parse error:', e); return { ok: false, motivo: 'error' }; }
}
