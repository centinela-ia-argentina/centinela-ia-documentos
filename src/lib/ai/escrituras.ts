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

export const TITULO_CLAUSULA_UIF = 'MEDIOS DE PAGO Y ORIGEN DE FONDOS';

export const CLAUSULA_AUTONOMA_UIF =
  'MEDIOS DE PAGO Y ORIGEN DE FONDOS. [COMPLETAR/VERIFICAR: declaración y documentación respaldatoria sobre medios y origen de fondos].';

export const LEYENDA_ITI_DEROGADO =
  'I.T.I.: No resulta aplicable por encontrarse derogado conforme Ley 27.743 para operaciones otorgadas a partir del 08/07/2024.';

export const LEYENDA_ITI_VERIFICAR_FECHA =
  'I.T.I.: [VERIFICAR: régimen tributario aplicable según la fecha efectiva de otorgamiento].';

export const DATO_FALTANTE_ITI_VERIFICAR_FECHA =
  '[VERIFICAR: régimen tributario aplicable según la fecha efectiva de otorgamiento]';

export const ORDINALES_NOTARIALES = [
  'PRIMERO',
  'SEGUNDO',
  'TERCERO',
  'CUARTO',
  'QUINTO',
  'SEXTO',
  'SÉPTIMO',
  'OCTAVO',
  'NOVENO',
  'DÉCIMO',
  'DÉCIMO PRIMERO',
  'DÉCIMO SEGUNDO',
  'DÉCIMO TERCERO',
  'DÉCIMO CUARTO',
  'DÉCIMO QUINTO',
  'DÉCIMO SEXTO',
  'DÉCIMO SÉPTIMO',
  'DÉCIMO OCTAVO',
  'DÉCIMO NOVENO',
  'VIGÉSIMO',
] as const;

function normalizarOrdinal(txt: string): string {
  return txt
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

const SET_ORDINALES_NORM = new Set(ORDINALES_NOTARIALES.map((o) => normalizarOrdinal(o)));
SET_ORDINALES_NORM.add('CLAUSULA');

export function validarOrdinalesNotariales(cuerpo: string): { ok: boolean; duplicados: string[] } {
  const lineas = cuerpo.split('\n');
  const duplicados: string[] = [];
  const vistos = new Set<string>();

  for (const linea of lineas) {
    const match = linea.match(/^\s*([A-ZÁÉÍÓÚÑ]+(?:\s+[A-ZÁÉÍÓÚÑ]+)?)\s*:\s*/i);
    if (match) {
      const norm = normalizarOrdinal(match[1]);
      if (SET_ORDINALES_NORM.has(norm) && norm !== 'CLAUSULA') {
        if (vistos.has(norm)) {
          duplicados.push(match[1]);
        } else {
          vistos.add(norm);
        }
      }
    }
  }

  return {
    ok: duplicados.length === 0,
    duplicados,
  };
}

export function recalcularOrdinalesNotariales(cuerpo: string): string {
  const lineas = cuerpo.split('\n');
  let idx = 0;

  const procesadas = lineas.map((linea) => {
    const match = linea.match(/^(\s*)([A-ZÁÉÍÓÚÑ]+(?:\s+[A-ZÁÉÍÓÚÑ]+)?)\s*:\s*(.*)$/i);
    if (!match) return linea;

    const spaces = match[1];
    const rawWord = match[2];
    const resto = match[3];
    const norm = normalizarOrdinal(rawWord);

    if (SET_ORDINALES_NORM.has(norm)) {
      const ordinalCorrecto = ORDINALES_NOTARIALES[idx] || rawWord.toUpperCase();
      idx++;
      return `${spaces}${ordinalCorrecto}: ${resto}`;
    }

    return linea;
  });

  return procesadas.join('\n');
}

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
 * Protege acrónimos legales (C.O.T.I., I.T.I., N°) y cifras para evitar
 * que sus puntos internos sean confundidos con finales de oración.
 */
export function protegerAcronimosYNumeros(texto: string): {
  protegido: string;
  restaurar: (s: string) => string;
} {
  const mapa = new Map<string, string>();
  let c = 0;

  let res = texto.replace(/\bC\.O\.T\.I\./gi, (m) => {
    const k = `___COTI_${c++}___`;
    mapa.set(k, m);
    return k;
  });

  res = res.replace(/\bI\.T\.I\./gi, (m) => {
    const k = `___ITI_${c++}___`;
    mapa.set(k, m);
    return k;
  });

  res = res.replace(/\b\d+(?:[.,]\d+)+\b/g, (m) => {
    const k = `___NUM_${c++}___`;
    mapa.set(k, m);
    return k;
  });

  res = res.replace(/\b(?:N[°º]|No\.|Art\.|Inc\.)/gi, (m) => {
    const k = `___ABR_${c++}___`;
    mapa.set(k, m);
    return k;
  });

  const restaurar = (s: string) => {
    let out = s;
    for (const [k, v] of mapa.entries()) {
      out = out.split(k).join(v);
    }
    return out;
  };

  return { protegido: res, restaurar };
}

/**
 * Evaluación fail-closed de evidencia de origen de fondos.
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

  const resumen = String(doc.resumen || '');
  const datos = JSON.stringify([
    ...(Array.isArray(doc.datos_clave) ? doc.datos_clave : []),
    ...(Array.isArray(doc.datos_relevantes) ? doc.datos_relevantes : []),
  ]);
  const combinedText = `${resumen} ${datos}`.toLowerCase();

  if (TERMINOS_NEGATIVOS_UIF.test(combinedText)) {
    return false;
  }

  if (doc.origen_fondos_acreditado === true && Boolean(doc.documento_fuente_uif || doc.document_type || doc.file_name)) {
    return true;
  }

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
    const { protegido, restaurar } = protegerAcronimosYNumeros(cuerpo);
    const lineas = protegido.split('\n');
    let clausulaInsertada = false;

    const lineasProcesadas = lineas.map((linea) => {
      if (!PATRON_DISPARADOR_ORACION_UIF.test(linea) && !/origen\s+de\s+fondos/i.test(linea)) {
        return linea;
      }

      const oraciones = linea.match(/[^.;!?]+(?:[.;!?]+|$)/g) || [linea];
      const oracionesProcesadas = oraciones.map((oracion) => {
        if (!PATRON_DISPARADOR_ORACION_UIF.test(oracion) && !/origen\s+de\s+fondos/i.test(oracion)) {
          return oracion;
        }

        const subClausulas = oracion.match(/[^,;]+(?:[,;]+|$)/g) || [oracion];
        if (subClausulas.length > 1) {
          const subProcesadas = subClausulas.map((sub) => {
            if (!PATRON_DISPARADOR_ORACION_UIF.test(sub) && !/origen\s+de\s+fondos/i.test(sub)) {
              return sub;
            }
            if (!clausulaInsertada) {
              clausulaInsertada = true;
              return ` ${CLAUSULA_AUTONOMA_UIF} `;
            }
            return '';
          });
          return subProcesadas.join('').replace(/[ \t]{2,}/g, ' ');
        }

        if (!clausulaInsertada) {
          clausulaInsertada = true;
          return ` ${CLAUSULA_AUTONOMA_UIF} `;
        }
        return '';
      });

      return oracionesProcesadas.join('').replace(/[ \t]{2,}/g, ' ').trim();
    });

    cuerpo = restaurar(lineasProcesadas.join('\n'));

    for (const pat of PATRONES_AFIRMACION_FONDOS_LICITOS) {
      if (pat.test(cuerpo)) {
        cuerpo = cuerpo.replace(pat, '');
      }
    }

    cuerpo = cuerpo
      .replace(/,\s*,/g, ',')
      .replace(/\.\s*\./g, '.')
      .replace(/dando cumplimiento a las disposiciones[^.]*\./gi, '')
      .replace(/con fondos de lícito origen[^.]*\./gi, '')
      .replace(/los\s+fondos\s+provienen\s+de[^.\n;]*[.\n;]?/gi, '')
      .replace(/[ \t]{2,}/g, ' ');

    if (!cuerpo.includes(CLAUSULA_AUTONOMA_UIF) && !cuerpo.includes(LEYENDA_ORIGEN_FONDOS_FALTANTE)) {
      if (/(precio|pago|forma\s+de\s+pago)/i.test(cuerpo)) {
        cuerpo = cuerpo.replace(
          /((?:precio|pago|forma\s+de\s+pago)[^\n]*)(?:\n|$)/i,
          `$1\n\nCLAUSULA: ${CLAUSULA_AUTONOMA_UIF}\n`
        );
      }
      if (!cuerpo.includes(CLAUSULA_AUTONOMA_UIF)) {
        cuerpo += `\n\nCLAUSULA: ${CLAUSULA_AUTONOMA_UIF}`;
      }
    }

    cuerpo = recalcularOrdinalesNotariales(cuerpo);

    const itemFaltante = LEYENDA_ORIGEN_FONDOS_FALTANTE;
    if (!datosFaltantes.some((d) => d.toLowerCase().includes('origen de fondos'))) {
      datosFaltantes.push(itemFaltante);
    }

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

function reemplazarSubclausulaItiUnica(
  cuerpoOriginal: string,
  leyenda: string
): string {
  const { protegido, restaurar } = protegerAcronimosYNumeros(cuerpoOriginal);
  const lineas = protegido.split('\n');
  let leyendaAplicada = false;

  const patronMencionIti = /(?:___ITI_\d+___|(?<!c\.?o\.?\s*)(?<!coti\s*)(?:\bi\.t\.i\.|\biti\b|impuesto\s+a\s+la\s+transferencia\s+de\s+inmuebles))/i;

  const regexReemplazoItiEnFrase = /(?:se\s+(?:retiene|deja\s+constancia\s+de\s+la\s+retenci[oó]n|abona)\s+(?:el\s+|la\s+|del\s+)?|retenci[oó]n\s+(?:del\s+)?|exenci[oó]n\s+(?:del\s+)?)(?:___ITI_\d+___|i\.?t\.?i\.?|impuesto\s+a\s+la\s+transferencia\s+de\s+inmuebles)(?:\s*\([^\)]*\))?(?:\s+(?:por\s+el|del)\s+[\d.,]+%)?(?:\s+correspondiente)?(?:\s+(?:y|,)\s*)?/gi;

  const procesadas = lineas.map((linea) => {
    if (!patronMencionIti.test(linea)) return linea;

    const ordinalMatch = linea.match(/^(\s*[A-ZÁÉÍÓÚÑ]+(?:\s+[A-ZÁÉÍÓÚÑ]+)?\s*:\s*)(.*)$/i);
    const prefijo = ordinalMatch ? ordinalMatch[1] : '';
    const resto = ordinalMatch ? ordinalMatch[2] : linea;

    // Segmentar siempre por oraciones o delimitadores para preservar cláusulas o menciones conexas
    // (Impuesto a las Ganancias, precio, pago, posesión, COTI, etc.)
    const oraciones = resto.split(/(?<=[.;])\s+/);

    const oracionesProcesadas = oraciones.map((oracion) => {
      if (!patronMencionIti.test(oracion)) return oracion;

      if (!leyendaAplicada) {
        leyendaAplicada = true;

        // Si la oración contiene otros conceptos clave (Ganancias, COTI, precio, etc.), reemplazar solo el segmento de ITI
        if (
          /ganancias|___COTI_\d+___|precio|pago|posesi[oó]n/i.test(oracion) &&
          regexReemplazoItiEnFrase.test(oracion)
        ) {
          const reemplazada = oracion.replace(regexReemplazoItiEnFrase, `${leyenda}. `).replace(/[ \t]{2,}/g, ' ').trim();
          return reemplazada;
        }

        // Si la oración es fundamentalmente sobre ITI, sustituir por la leyenda
        return leyenda;
      }

      // Si la leyenda ya fue aplicada en una oración previa de la misma cláusula:
      if (/ganancias|___COTI_\d+___|precio|pago|posesi[oó]n/i.test(oracion)) {
        return oracion.replace(regexReemplazoItiEnFrase, '').replace(/[ \t]{2,}/g, ' ').trim();
      }

      return '';
    });

    const contenidoFinalLinea = oracionesProcesadas.filter((o) => o.trim().length > 0).join(' ').replace(/[ \t]{2,}/g, ' ').trim();
    if (!contenidoFinalLinea) return '';
    return `${prefijo}${contenidoFinalLinea}`;
  });

  let out = restaurar(procesadas.filter((l) => l.trim().length > 0).join('\n'));

  // Asegurar que no quede ningún fragmento residual duplicado de la leyenda
  const primeraPos = out.indexOf(leyenda);
  if (primeraPos !== -1) {
    const antes = out.slice(0, primeraPos + leyenda.length);
    const despues = out.slice(primeraPos + leyenda.length).split(leyenda).join('');
    out = antes + despues;
  }

  return out;
}

export function aplicarGuardrailIti(
  borrador: BorradorEscritura,
  fechaOperacion?: string | null
): BorradorEscritura {
  let cuerpo = borrador.cuerpo;
  let datosFaltantes = [...borrador.datos_faltantes];
  let advertencias = [...borrador.advertencias];

  let estadoIti: 'post_derogacion' | 'pre_derogacion' | 'ambigua_o_ausente' = 'ambigua_o_ausente';

  if (fechaOperacion && typeof fechaOperacion === 'string' && fechaOperacion.trim().length > 0) {
    const parsed = parsearFechaCualquiera(fechaOperacion.trim());
    if (parsed && parsed.iso && parsed.iso.length === 10) {
      if (parsed.iso >= '2024-07-08') {
        estadoIti = 'post_derogacion';
      } else {
        estadoIti = 'pre_derogacion';
      }
    } else {
      estadoIti = 'ambigua_o_ausente';
    }
  } else {
    estadoIti = 'ambigua_o_ausente';
  }

  const patronMencionIti = /(?:___ITI_\d+___|(?<!c\.?o\.?\s*)(?<!coti\s*)(?:\bi\.t\.i\.|\biti\b|impuesto\s+a\s+la\s+transferencia\s+de\s+inmuebles))/i;

  if (patronMencionIti.test(cuerpo)) {
    if (estadoIti === 'post_derogacion') {
      cuerpo = reemplazarSubclausulaItiUnica(cuerpo, LEYENDA_ITI_DEROGADO);

      datosFaltantes = datosFaltantes.filter(
        (d) => !/(?<!c\.?o\.?\s*)(?<!coti\s*)\b(?:i\.?t\.?i\.?|impuesto\s+a\s+la\s+transferencia\s+de\s+inmuebles)\b/i.test(d)
      );
      advertencias = advertencias.filter(
        (a) => !/(?:retenci[oó]n|aplicar|calcular)\s+(?:del?\s+)?(?:i\.?t\.?i\.?|impuesto\s+a\s+la\s+transferencia\s+de\s+inmuebles)/i.test(a)
      );
    } else if (estadoIti === 'ambigua_o_ausente') {
      cuerpo = reemplazarSubclausulaItiUnica(cuerpo, LEYENDA_ITI_VERIFICAR_FECHA);

      datosFaltantes = datosFaltantes.filter(
        (d) => !/(?<!c\.?o\.?\s*)(?<!coti\s*)\b(?:i\.?t\.?i\.?|impuesto\s+a\s+la\s+transferencia\s+de\s+inmuebles|régimen tributario)\b/i.test(d)
      );
      datosFaltantes.push(LEYENDA_ITI_VERIFICAR_FECHA);

      advertencias = advertencias.filter(
        (a) => !a.includes('régimen tributario aplicable')
      );
      const advTrib =
        'Revisión profesional requerida: fecha de otorgamiento no determinada o ambigua. Debe verificarse el régimen tributario aplicable según la fecha efectiva del acto.';
      advertencias.push(advTrib);
    }
  }

  // Recalcular y validar ordinales notariales en el cuerpo final
  cuerpo = recalcularOrdinalesNotariales(cuerpo);

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
