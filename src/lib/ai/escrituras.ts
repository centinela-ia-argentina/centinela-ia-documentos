import 'server-only';

export type BorradorEscritura = {
  titulo: string;
  cuerpo: string;
  datos_faltantes: string[];
  advertencias: string[];
};

type DocInput = { nombre: string; tipo: string; resumen: string; alertas: string[]; datos: string[] };

export const LEYENDA_ORIGEN_FONDOS_FALTANTE =
  '[COMPLETAR/VERIFICAR: declaración y documentación respaldatoria sobre medios y origen de fondos]';

export const PATRONES_AFIRMACION_FONDOS_LICITOS = [
  /manifiestan?\s+(?:bajo\s+juramento\s+)?que\s+los\s+fondos\s+(?:utilizados\s+)?provienen\s+de\s+(?:actividades\s+)?l[ií]citas/i,
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
  /(?:fondos\s+(?:utilizados\s+)?(?:son\s+|provienen\s+de\s+)?(?:de\s+)?(?:l[ií]cito\s+origen|origen\s+l[ií]cito|actividades\s+l[ií]citas))|fondos\s+l[ií]citos|l[ií]cito\s+origen|origen\s+l[ií]cito|(?:cumplimiento\s+(?:estricto\s+)?(?:de\s+|a\s+)?(?:las\s+)?disposiciones\s+(?:de\s+la\s+)?(?:uif|unidad\s+de\s+informaci[oó]n\s+financiera))|(?:disposiciones\s+de\s+la\s+unidad\s+de\s+informaci[oó]n\s+financiera)|(?:acredit(?:ando|ado|an|a)\s+(?:el\s+)?(?:origen\s+l[ií]cito|l[ií]cito\s+origen))|(?:justificaci[oó]n\s+(?:positiva\s+)?de\s+fondos)/i;

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
    // 1. Reemplazo a nivel de oración completa de cualquier cláusula o afirmación positiva de licitud / UIF
    const lineas = cuerpo.split('\n');
    let placeholderInsertado = false;

    const lineasProcesadas = lineas.map((linea) => {
      if (!PATRON_DISPARADOR_ORACION_UIF.test(linea)) return linea;

      // Descomponer la línea en oraciones delimitadas por punto, punto y coma o signo de cierre
      const oraciones = linea.match(/[^.;!?]+(?:[.;!?]|$)/g) || [linea];
      const oracionesResultado: string[] = [];

      for (const oracion of oraciones) {
        if (PATRON_DISPARADOR_ORACION_UIF.test(oracion)) {
          if (!placeholderInsertado) {
            oracionesResultado.push(` ORIGEN DE FONDOS Y PLA/FT: ${LEYENDA_ORIGEN_FONDOS_FALTANTE}.`);
            placeholderInsertado = true;
          }
          // Si ya se insertó el reemplazo, descartar oraciones subsiguientes que afirmen licitud para no duplicar
        } else {
          oracionesResultado.push(oracion);
        }
      }

      return oracionesResultado.join('').replace(/[ \t]{2,}/g, ' ').trim();
    });

    cuerpo = lineasProcesadas.join('\n');

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
      .replace(/[ \t]{2,}/g, ' ');

    // 4. Si el cuerpo aún no contiene la leyenda obligatoria, incorporarla en la cláusula de pago/fondos
    if (!cuerpo.includes(LEYENDA_ORIGEN_FONDOS_FALTANTE)) {
      if (/(precio|pago|forma\s+de\s+pago)/i.test(cuerpo)) {
        cuerpo = cuerpo.replace(
          /((?:precio|pago|forma\s+de\s+pago)[^\n]*)(?:\n|$)/i,
          `$1\nORIGEN DE FONDOS Y PLA/FT: ${LEYENDA_ORIGEN_FONDOS_FALTANTE}\n`
        );
      }
      if (!cuerpo.includes(LEYENDA_ORIGEN_FONDOS_FALTANTE)) {
        cuerpo += `\n\nORIGEN DE FONDOS Y PLA/FT: ${LEYENDA_ORIGEN_FONDOS_FALTANTE}`;
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

    const borradorFinal = aplicarGuardrailOrigenFondos(
      rawBorrador,
      Boolean(input.tieneEvidenciaOrigenFondos)
    );

    return {
      ok: true,
      model: `escritura-${modelo}`,
      borrador: borradorFinal,
    };
  } catch (e) { console.error('Escritura parse error:', e); return { ok: false, motivo: 'error' }; }
}
