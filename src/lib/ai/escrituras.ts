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

export const ORDINALES_NOTARIALES_FEMENINOS = [
  'PRIMERA',
  'SEGUNDA',
  'TERCERA',
  'CUARTA',
  'QUINTA',
  'SEXTA',
  'SÉPTIMA',
  'OCTAVA',
  'NOVENA',
  'DÉCIMA',
  'DÉCIMA PRIMERA',
  'DÉCIMA SEGUNDA',
  'DÉCIMA TERCERA',
  'DÉCIMA CUARTA',
  'DÉCIMA QUINTA',
  'DÉCIMA SEXTA',
  'DÉCIMA SÉPTIMA',
  'DÉCIMA OCTAVA',
  'DÉCIMA NOVENA',
  'VIGÉSIMA',
] as const;

function normalizarOrdinal(txt: string): string {
  return txt
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

export const SET_ORDINALES_MASC_NORM = new Set(ORDINALES_NOTARIALES.map((o) => normalizarOrdinal(o)));
export const SET_ORDINALES_FEM_NORM = new Set(ORDINALES_NOTARIALES_FEMENINOS.map((o) => normalizarOrdinal(o)));
export const SET_ORDINALES_NORM = new Set([
  ...SET_ORDINALES_MASC_NORM,
  ...SET_ORDINALES_FEM_NORM,
  'CLAUSULA',
]);

export function detectarEstiloOrdinales(cuerpo: string): 'femenino' | 'masculino' {
  const lineas = cuerpo.split('\n');
  for (const linea of lineas) {
    const match = linea.match(/^\s*([A-ZÁÉÍÓÚÑ]+(?:\s+[A-ZÁÉÍÓÚÑ]+)?)\s*:\s*/i);
    if (match) {
      const norm = normalizarOrdinal(match[1]);
      if (norm === 'PRIMERA' || norm === 'SEGUNDA' || SET_ORDINALES_FEM_NORM.has(norm)) {
        return 'femenino';
      }
      if (norm === 'PRIMERO' || norm === 'SEGUNDO' || SET_ORDINALES_MASC_NORM.has(norm)) {
        return 'masculino';
      }
    }
  }
  return 'femenino';
}

export function validarOrdinalesNotariales(cuerpo: string): { ok: boolean; duplicados: string[] } {
  const lineas = cuerpo.split('\n');
  const duplicados: string[] = [];
  const vistos = new Set<string>();

  for (const linea of lineas) {
    const match = linea.match(/^\s*([A-ZÁÉÍÓÚÑ]+(?:\s+[A-ZÁÉÍÓÚÑ]+)?)\s*:\s*/i);
    if (match) {
      const norm = normalizarOrdinal(match[1]);
      if (norm === 'CLAUSULA') {
        duplicados.push('CLAUSULA');
      } else if (SET_ORDINALES_NORM.has(norm)) {
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
  const estilo = detectarEstiloOrdinales(cuerpo);
  const listaOrdinales = estilo === 'femenino' ? ORDINALES_NOTARIALES_FEMENINOS : ORDINALES_NOTARIALES;
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
      const ordinalCorrecto = listaOrdinales[idx] || rawWord.toUpperCase();
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

export const FORMULA_FAIL_CLOSED_UIF =
  '[VERIFICAR: cumplimiento de las obligaciones que resulten aplicables conforme Ley 25.246 y resoluciones UIF vigentes].';

export const REGEX_EXCLUSION_UIF =
  /(?:(?:las\s+partes\s+)?(?:declaran|manifiestan)\s+(?:bajo\s+juramento\s+)?que\s+)?no\s+(?:se\s+encuentran|resultan)\s+(?:comprendidas?|alcanzadas?)\s+(?:en|por)\s+[^.;!\n]*(?:Ley\s+25\.246|UIF|Unidad\s+de\s+Informaci[oó]n\s+Financiera)[^.;!\n]*/i;

export const REGEX_AFIRMACION_CUMPLIMIENTO_UIF =
  /(?:(?:las\s+partes\s+)?(?:manifiestan|declaran|dejan\s+constancia\s+que)?\s*(?:haber\s+cumplido|han\s+cumplido|haber\s+dado\s+cumplimiento|dan\s+cumplimiento|cumplen)\s+(?:con\s+|a\s+)?(?:las\s+)?(?:declaraciones\s+juradas|normas?|normativas?|disposiciones|resoluciones)[^.;!\n]*(?:uif|pla\/?ft|lavado|terrorismo|fiscales?)|declaraciones\s+juradas\s+exigidas\s+por\s+(?:las\s+)?(?:normas|normativas)[^.;!\n]*(?:lavado|uif|pla\/?ft|terrorismo|fiscales?)|(?:manifiestan|declaran)\s+haber\s+cumplido|(?:han|haber)\s+cumplido\s+con\s+(?:las\s+)?declaraciones\s+juradas|declaran\s+haber\s+dado\s+cumplimiento|cumplen\s+con\s+la\s+normativa\s+(?:pla\/?ft|fiscal|tributaria)|han\s+cumplido\s+con\s+las\s+resoluciones\s+uif)/i;

export function limpiarSubordinadasOrigenFondos(texto: string): string {
  let limpia = texto;

  const patronesSubordinadas = [
    /(?:,\s*)?(?:y\s+)?(?:que\s+)?(?:las\s+partes\s+)?(?:declaran|manifiestan)\s+(?:bajo\s+juramento\s+)?que\s+los\s+fondos\s+(?:utilizados\s+)?provienen\s+de\s+(?:actividades\s+)?l[ií]citas[^.;!\n]*/gi,
    /(?:,\s*)?(?:y\s+)?(?:que\s+)?(?:las\s+partes\s+)?(?:declaran|manifiestan)\s+(?:bajo\s+juramento\s+)?que\s+los\s+fondos\s+(?:utilizados\s+)?(?:son\s+|provienen\s+de\s+)(?:de\s+)?(?:l[ií]cito\s+origen|origen\s+l[ií]cito|actividades\s+l[ií]citas|l[ií]citos)[^.;!\n]*/gi,
    /(?:,\s*)?(?:y\s+)?(?:que\s+)?los\s+fondos\s+(?:utilizados\s+)?(?:en\s+esta\s+operaci[oó]n\s+)?(?:son\s+|provienen\s+de\s+)(?:de\s+)?(?:l[ií]cito\s+origen|origen\s+l[ií]cito|actividades\s+l[ií]citas|l[ií]citos)[^.;!\n]*/gi,
    /(?:,\s*)?(?:y\s+)?(?:que\s+)?los\s+fondos\s+(?:utilizados\s+)?(?:son\s+de|provienen\s+de)[^.;!\n]*/gi,
    /(?:,\s*)?(?:con|de|mediante)\s+fondos\s+(?:de\s+)?(?:l[ií]cito\s+origen|origen\s+l[ií]cito|actividades\s+l[ií]citas|l[ií]citos)[^.;!\n]*/gi,
    /(?:,\s*)?siendo\s+(?:los\s+fondos\s+utilizados\s+)?(?:de\s+)?(?:l[ií]cito\s+origen|origen\s+l[ií]cito|actividades\s+l[ií]citas)[^.;!\n]*/gi,
    /(?:,\s*)?(?:y\s+)?(?:que\s+)?(?:las\s+partes\s+)?(?:manifiestan|declaran)\s+haber\s+cumplido[^.;!\n]*/gi,
    /(?:,\s*)?(?:y\s+)?(?:que\s+)?(?:las\s+partes\s+)?(?:han|haber)\s+cumplido\s+con\s+(?:las\s+)?declaraciones\s+juradas[^.;!\n]*/gi,
    /(?:,\s*)?(?:y\s+)?(?:que\s+)?cumplen\s+con\s+la\s+normativa\s+(?:pla\/?ft|fiscal|tributaria)[^.;!\n]*/gi,
    /(?:,\s*)?(?:y\s+)?(?:que\s+)?declaran\s+haber\s+dado\s+cumplimiento[^.;!\n]*/gi,
    /(?:,\s*)?(?:y\s+)?(?:que\s+)?han\s+cumplido\s+con\s+las\s+resoluciones\s+uif[^.;!\n]*/gi,
    /(?:,\s*)?(?:y\s+)?(?:que\s+)?declaraciones\s+juradas\s+exigidas\s+por\s+normas\s+de\s+prevenci[oó]n\s+de\s+lavado[^.;!\n]*/gi,
    /(?:,\s*)?dando\s+cumplimiento\s+a\s+las\s+disposiciones\s+(?:de\s+la\s+)?(?:uif|unidad\s+de\s+informaci[oó]n\s+financiera)[^.;!\n]*/gi,
    /(?:,\s*)?en\s+cumplimiento\s+(?:de\s+|a\s+)(?:las\s+)?disposiciones\s+(?:de\s+la\s+)?(?:uif|unidad\s+de\s+informaci[oó]n\s+financiera)[^.;!\n]*/gi,
    /(?:,\s*)?acreditando\s+(?:el\s+)?(?:origen\s+l[ií]cito|l[ií]cito\s+origen)[^.;!\n]*/gi,
    /(?:,\s*)?justificaci[oó]n\s+(?:positiva\s+)?de\s+fondos[^.;!\n]*/gi,
    /fondos\s+(?:son\s+)?(?:de\s+)?(?:origen\s+l[ií]cito|l[ií]cito\s+origen)/gi,
    /l[ií]cito\s+origen/gi,
    /origen\s+l[ií]cito/gi,
    /fondos\s+l[ií]citos/gi,
  ];

  for (const pat of patronesSubordinadas) {
    limpia = limpia.replace(pat, '');
  }

  limpia = limpia
    .replace(/(?:,\s*)?y\s+que\s*(?=[.;!\n]|$)/gi, '')
    .replace(/(?:,\s*)?(?:que\s+)?los\s+fondos\s+(?:utilizados\s+)?(?:son\s+de|provienen\s+de)?\s*(?=[.;!\n]|$)/gi, '')
    .replace(/(?:,\s*)?son\s+de\s*(?=[.;!\n]|$)/gi, '')
    .replace(/(?:,\s*)?provienen\s+de\s*(?=[.;!\n]|$)/gi, '')
    .replace(/(?:,\s*)?de\s*(?=[.;!\n]|$)/gi, '')
    .replace(/,\s*,/g, ',')
    .replace(/,\s*\./g, '.')
    .replace(/:\s*\./g, '.')
    .replace(/\s+\./g, '.')
    .replace(/\.\s*\./g, '.')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();

  return limpia;
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

    const lineasProcesadas = lineas.map((linea) => {
      // 1. Si la línea es una cláusula dedicada a origen de fondos (ej: CUARTA: ORIGEN DE FONDOS...)
      if (/^\s*[A-ZÁÉÍÓÚÑ]+:\s*(?:MEDIOS\s+DE\s+PAGO\s+Y\s+)?ORIGEN\s+DE\s+FONDOS/i.test(linea)) {
        const matchOrd = linea.match(/^(\s*[A-ZÁÉÍÓÚÑ]+(?:\s+[A-ZÁÉÍÓÚÑ]+)?:\s*)/i);
        const ord = matchOrd ? matchOrd[1] : 'CLAUSULA: ';
        return `${ord}${CLAUSULA_AUTONOMA_UIF}`;
      }

      // 2. Línea que contiene afirmación de cumplimiento UIF/PLA-FT o exclusión legal
      const esAfirmacionCumplimiento = REGEX_AFIRMACION_CUMPLIMIENTO_UIF.test(linea);
      const esExclusionUif = REGEX_EXCLUSION_UIF.test(linea);

      if (esAfirmacionCumplimiento || esExclusionUif) {
        const matchEncabezado = linea.match(
          /^(\s*[A-ZÁÉÍÓÚÑa-záéíóúñ]+(?:\s+[A-ZÁÉÍÓÚÑa-záéíóúñ]+)?\s*:\s*)(?:([A-ZÁÉÍÓÚÑ\s]{3,40}?)([.:\-]+)\s+)?(.*)$/
        );
        if (matchEncabezado) {
          const prefijoOrdinal = matchEncabezado[1];
          const titulo = matchEncabezado[2] ? matchEncabezado[2].trim() : '';
          const sep = matchEncabezado[3] || '.';
          const resto = matchEncabezado[4];

          if (titulo) {
            // Preservar ordinal y título, reemplazar contenido por la fórmula fail-closed
            return `${prefijoOrdinal}${titulo}${sep} ${FORMULA_FAIL_CLOSED_UIF}`;
          }

          const restoSinExclusion = resto
            .replace(REGEX_EXCLUSION_UIF, '')
            .replace(REGEX_AFIRMACION_CUMPLIMIENTO_UIF, '')
            .replace(/(?:,\s*)?(?:y\s+)?(?:que\s+)?los\s+fondos[^.;!\n]*/gi, '')
            .trim();

          if (!restoSinExclusion || /^[^a-zA-Z0-9]*$/.test(restoSinExclusion)) {
            return `${prefijoOrdinal}${FORMULA_FAIL_CLOSED_UIF}`;
          } else {
            let mod = resto.replace(
              new RegExp(`${REGEX_EXCLUSION_UIF.source}(?:(?:,\\s*)?(?:y\\s+)?(?:que\\s+)?los\\s+fondos[^.;!\\n]*)?[.;!\\n]?`, 'i'),
              FORMULA_FAIL_CLOSED_UIF
            );
            mod = mod.replace(
              new RegExp(`${REGEX_AFIRMACION_CUMPLIMIENTO_UIF.source}[.;!\\n]?`, 'i'),
              FORMULA_FAIL_CLOSED_UIF
            );
            mod = limpiarSubordinadasOrigenFondos(mod);
            return `${prefijoOrdinal}${mod}`;
          }
        } else {
          return FORMULA_FAIL_CLOSED_UIF;
        }
      }

      // Si no contiene disparadores UIF ni menciones de fondos, preservar intacta
      if (!PATRON_DISPARADOR_ORACION_UIF.test(linea) && !/origen\s+de\s+fondos/i.test(linea)) {
        return linea;
      }

      // 3. Cláusula de precio o mixta: suprimir afirmaciones subordinadas de fondos no acreditados
      let limpia = limpiarSubordinadasOrigenFondos(linea);
      if (limpia.length > 0 && !/[.:;!?]$/.test(limpia) && !limpia.endsWith(':')) {
        limpia += '.';
      }

      return limpia;
    });

    cuerpo = restaurar(lineasProcesadas.join('\n'));

    // Limpieza global de afirmaciones subordinadas y exclusiones residuales
    cuerpo = limpiarSubordinadasOrigenFondos(cuerpo);

    if (REGEX_EXCLUSION_UIF.test(cuerpo)) {
      cuerpo = cuerpo.replace(REGEX_EXCLUSION_UIF, FORMULA_FAIL_CLOSED_UIF);
    }

    if (
      !cuerpo.includes(CLAUSULA_AUTONOMA_UIF) &&
      !cuerpo.includes(LEYENDA_ORIGEN_FONDOS_FALTANTE) &&
      !cuerpo.includes(FORMULA_FAIL_CLOSED_UIF)
    ) {
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

    // Asegurar que si la cláusula UIF quedó sin prefijo ordinal, se le asigne
    cuerpo = cuerpo.replace(
      /(?:^|\n)\s*(?:CLAUSULA:?\s*)?(MEDIOS DE PAGO Y ORIGEN DE FONDOS\b)/gi,
      '\n\nCLAUSULA: $1'
    );

    if (
      cuerpo.includes('CLAUSULA:') ||
      !validarOrdinalesNotariales(cuerpo).ok ||
      /^\s*PRIMER[AO]:/im.test(cuerpo)
    ) {
      cuerpo = recalcularOrdinalesNotariales(cuerpo);
    }

    const itemFaltante = LEYENDA_ORIGEN_FONDOS_FALTANTE;
    if (!datosFaltantes.some((d) => d.toLowerCase().includes('origen de fondos'))) {
      datosFaltantes.push(itemFaltante);
    }

    if (cuerpo.includes(FORMULA_FAIL_CLOSED_UIF)) {
      if (!datosFaltantes.some((d) => d.includes('resoluciones UIF vigentes'))) {
        datosFaltantes.push(FORMULA_FAIL_CLOSED_UIF);
      }
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

export function sanearPlaceholdersIti(texto: string): string {
  let s = texto;

  // 1. Declaraciones juradas y marcadores con ITI y Ganancias
  s = s.replace(
    /Declaraci[oó]n\s+jurada\s+(?:de\s+)?(?:Impuesto\s+a\s+la\s+Transferencia\s+de\s+Inmuebles(?:\s*\([^\)]*\))?|I\.?T\.?I\.?)\s*(?:o\s+|\/\s*)(?:de\s+)?IG\b/gi,
    'Declaración jurada de Impuesto a las Ganancias (IG)'
  );
  s = s.replace(
    /Declaraci[oó]n\s+jurada\s+(?:de\s+)?(?:Impuesto\s+a\s+la\s+Transferencia\s+de\s+Inmuebles(?:\s*\([^\)]*\))?|I\.?T\.?I\.?)\s*(?:o\s+|\/\s*)(?:de\s+)?Impuesto\s+a\s+las\s+Ganancias\b/gi,
    'Declaración jurada de Impuesto a las Ganancias'
  );
  s = s.replace(
    /Declaraci[oó]n\s+jurada\s+(?:de\s+)?(?:Impuesto\s+a\s+la\s+Transferencia\s+de\s+Inmuebles(?:\s*\([^\)]*\))?|I\.?T\.?I\.?)\b/gi,
    'Declaración jurada de Impuesto a las Ganancias'
  );
  s = s.replace(/\bI\.?T\.?I\.?\s*\/\s*IG\b/gi, 'Impuesto a las Ganancias (IG)');
  s = s.replace(/\bI\.?T\.?I\.?\s*\/\s*Impuesto\s+a\s+las\s+Ganancias\b/gi, 'de Impuesto a las Ganancias');
  s = s.replace(/\bde\s+de\s+Impuesto/gi, 'de Impuesto');

  // 2. Cláusulas de gastos y alternativas fiscales dentro de placeholders o texto:
  s = s.replace(
    /(con\s+excepci[oó]n\s+(?:de\s+|del\s+)?)(?:___ITI_\d+___|i\.?t\.?i\.?|impuesto\s+a\s+la\s+transferencia\s+de\s+inmuebles)(?:\s*\([^\)]*\))?\s*(?:o,\s+en\s+su\s+caso,\s*(?:del?|por\s+el)|o\s+en\s+su\s+caso\s*(?:del?|por\s+el)|o\s+(?:del?\s+|por\s+el\s+)?)\s*(?:el\s+)?(impuesto\s+a\s+las\s+ganancias)/gi,
    'con excepción del Impuesto a las Ganancias'
  );

  s = s.replace(
    /(con\s+excepci[oó]n\s+(?:de\s+|del\s+)?)(?:___ITI_\d+___|i\.?t\.?i\.?|impuesto\s+a\s+la\s+transferencia\s+de\s+inmuebles)(?:\s*\([^\)]*\))?\s*(?:o,\s+en\s+su\s+caso,\s*(?:del?|por\s+el)|o\s+en\s+su\s+caso\s*(?:del?|por\s+el)|o\s+(?:del?\s+|por\s+el\s+)?)\s*(?:el\s+)?(ig\b)/gi,
    'con excepción del Impuesto a las Ganancias (IG)'
  );

  // 3. Fórmulas generales de disyunción: "Impuesto a la Transferencia de Inmuebles (ITI) o Impuesto a las Ganancias"
  s = s.replace(
    /(?:el\s+|del\s+)?(?:___ITI_\d+___|i\.?t\.?i\.?|impuesto\s+a\s+la\s+transferencia\s+de\s+inmuebles)(?:\s*\([^\)]*\))?\s*(?:o,\s+en\s+su\s+caso,\s*(?:por\s+el|del?)|o\s+en\s+su\s+caso\s*(?:por\s+el|del?)|o\s+(?:del?\s+|por\s+el\s+)?)\s*(?:el\s+)?impuesto\s+a\s+las\s+ganancias/gi,
    'el Impuesto a las Ganancias'
  );

  // 4. "con excepción del Impuesto a la Transferencia de Inmuebles (ITI)" aislado (sin Ganancias)
  s = s.replace(
    /(?:,\s*)?con\s+excepci[oó]n\s+(?:de\s+|del\s+)?(?:___ITI_\d+___|i\.?t\.?i\.?|impuesto\s+a\s+la\s+transferencia\s+de\s+inmuebles)(?:\s*\([^\)]*\))?/gi,
    ''
  );

  return s;
}

function reemplazarSubclausulaItiUnica(
  cuerpoOriginal: string,
  leyenda: string
): string {
  const { protegido, restaurar } = protegerAcronimosYNumeros(cuerpoOriginal);
  const lineas = protegido.split('\n');
  let leyendaAplicada = false;

  const patronMencionIti = /(?:___ITI_\d+___|(?<!c\.?o\.?\s*)(?<!coti\s*)(?:\bi\.t\.i\.|\biti\b|impuesto\s+a\s+la\s+transferencia\s+de\s+inmuebles))/i;

  const regexReemplazoItiEnFrase = /(?:(?:las\s+partes\s+(?:declaran|manifiestan)\s+que\s+)?(?:la\s+presente\s+operaci[oó]n\s+|la\s+operaci[oó]n\s+)?(?:se\s+encuentra\s+alcanzada|resulta\s+alcanzada|tributa|corresponde)\s+(?:por\s+el\s+|el\s+|la\s+)?|se\s+(?:retiene|deja\s+constancia\s+de\s+la\s+retenci[oó]n|abona)\s+(?:el\s+|la\s+|del\s+)?|retenci[oó]n\s+(?:del\s+)?|exenci[oó]n\s+(?:del\s+)?)(?:___ITI_\d+___|i\.?t\.?i\.?|impuesto\s+a\s+la\s+transferencia\s+de\s+inmuebles)(?:\s*\([^\)]*\))?(?:\s+(?:por\s+el|del)\s+[\d.,]+%)?(?:\s+correspondiente)?(?:\s*(?:o,\s+en\s+su\s+caso,\s*por\s+el|o\s+en\s+su\s+caso\s+por\s+el|o,\s+en\s+su\s+caso,\s*|o\s+en\s+su\s+caso\s*|o\s+por\s+el|o\s+|y\s+que\s+|y\s+|,)\s*)?/gi;

  const procesadas = lineas.map((linea) => {
    if (!patronMencionIti.test(linea)) return linea;

    const ordinalMatch = linea.match(/^(\s*[A-ZÁÉÍÓÚÑ]+(?:\s+[A-ZÁÉÍÓÚÑ]+)?\s*:\s*)(.*)$/i);
    const prefijo = ordinalMatch ? ordinalMatch[1] : '';
    const resto = ordinalMatch ? ordinalMatch[2] : linea;

    // Segmentar siempre por oraciones o delimitadores para preservar cláusulas o menciones conexas
    const oraciones = resto.split(/(?<=[.;])\s+/);

    const oracionesProcesadas = oraciones.map((oracion) => {
      const esPlaceholder = /\[(?:COMPLETAR|VERIFICAR)/i.test(oracion);

      if (esPlaceholder) {
        const saneada = sanearPlaceholdersIti(oracion);
        if (!leyendaAplicada && (patronMencionIti.test(oracion) || patronMencionIti.test(resto))) {
          leyendaAplicada = true;
          return `${leyenda} ${saneada}`.trim();
        }
        return saneada.trim();
      }

      if (!patronMencionIti.test(oracion)) return oracion;

      if (!leyendaAplicada) {
        leyendaAplicada = true;

        // Si la oración contiene otros conceptos clave (Ganancias, COTI, precio, etc.), reemplazar solo el segmento de ITI
        if (
          /ganancias|\big\b|___COTI_\d+___|precio|pago|posesi[oó]n/i.test(oracion) &&
          regexReemplazoItiEnFrase.test(oracion)
        ) {
          let reemplazada = oracion.replace(regexReemplazoItiEnFrase, (match) => {
            if (
              /se\s+encuentra\s+alcanzada|resulta\s+alcanzada/i.test(match) &&
              /por\s+el\s*$/i.test(match)
            ) {
              return `${leyenda} Las partes declaran que la presente operación se encuentra alcanzada por el `;
            }
            if (
              /se\s+encuentra\s+alcanzada|resulta\s+alcanzada/i.test(match) &&
              /o,\s+en\s+su\s+caso/i.test(match)
            ) {
              return `${leyenda} Las partes declaran que la presente operación se encuentra alcanzada por `;
            }
            return `${leyenda} `;
          });

          reemplazada = sanearPlaceholdersIti(reemplazada);

          // Capitalizar la primera letra tras la leyenda si quedó en minúscula
          const idxLeyenda = reemplazada.indexOf(leyenda);
          if (idxLeyenda !== -1) {
            const posDespues = idxLeyenda + leyenda.length;
            const restoStr = reemplazada.slice(posDespues);
            const matchPrimeraLetra = restoStr.match(/^(\s*)([a-záéíóúñ])/);
            if (matchPrimeraLetra) {
              reemplazada =
                reemplazada.slice(0, posDespues) +
                matchPrimeraLetra[1] +
                matchPrimeraLetra[2].toUpperCase() +
                restoStr.slice(matchPrimeraLetra[0].length);
            }
          }

          return reemplazada.replace(/[ \t]{2,}/g, ' ').trim();
        }

        // Si la oración es fundamentalmente sobre ITI, sustituir por la leyenda
        return leyenda;
      }

      // Si la leyenda ya fue aplicada en una oración previa de la misma cláusula:
      if (/ganancias|\big\b|___COTI_\d+___|precio|pago|posesi[oó]n/i.test(oracion)) {
        let limpia = oracion.replace(regexReemplazoItiEnFrase, '');
        limpia = sanearPlaceholdersIti(limpia);
        return limpia.replace(/[ \t]{2,}/g, ' ').trim();
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

  out = sanearPlaceholdersIti(out);

  return out;
}

const REGEX_CONTEXTO_TRIBUTARIO =
  /(?:(?<!c\.?o\.?\s*)(?<!coti\s*)(?:\bi\.t\.i\.|\biti\b|impuesto\s+a\s+la\s+transferencia\s+de\s+inmuebles)|impuesto\s+a\s+las\s+ganancias|c\.?o\.?t\.?i\.?|\btribut[a-z]*|\bimpuestos?\b|retenci[oó]n(?:\s+fiscal|\s+impositiva)?)/i;

const REGEX_CONTEXTO_UIF =
  /(?:uif|pla\/?ft|lavado\s+de\s+activos|financiaci[oó]n\s+del\s+terrorismo|encubrimiento)/i;

const REGEX_CONTEXTO_ITI =
  /(?:(?<!c\.?o\.?\s*)(?<!coti\s*)(?:\bi\.t\.i\.|\biti\b|impuesto\s+a\s+la\s+transferencia\s+de\s+inmuebles)|derog)/i;

export function sanearCitasNormativasTributarias(texto: string): string {
  if (!texto) return texto;

  // Proteger abreviaturas comunes para no romper delimitación de oraciones
  const marcadores: Array<{ key: string; val: string }> = [];
  let protegido = texto.replace(
    /\b(?:i\.t\.i\.|c\.o\.t\.i\.|d\.n\.i\.|c\.u\.i\.t\.|c\.u\.i\.l\.|art\.|inc\.|n[°ºo]\.|nro\.|p[aá]g\.|fs\.)/gi,
    (m) => {
      const key = `___ABBR_${marcadores.length}___`;
      marcadores.push({ key, val: m });
      return key;
    }
  );

  // Dividir en oraciones preservando delimitadores exactos
  const partes = protegido.split(/(\r?\n+|(?<=[.;])\s+)/);

  const procesadas = partes.map((segmento) => {
    if (!segmento || /^\s+$/.test(segmento)) return segmento;

    let sDesc = segmento;
    for (const { key, val } of marcadores) {
      sDesc = sDesc.split(key).join(val);
    }

    const hasTax = REGEX_CONTEXTO_TRIBUTARIO.test(sDesc);
    const hasUif = REGEX_CONTEXTO_UIF.test(sDesc);
    const hasIti = REGEX_CONTEXTO_ITI.test(sDesc);
    const claimsTax = /(?:tribut|retenci[oó]n|impuesto|gravad)/i.test(sDesc);

    if (!/\b(?:leyes|ley)\b/i.test(segmento)) {
      return segmento;
    }

    // Procesar grupos de leyes: "Leyes 23.282 / 25.093", "Ley 23.282 y 25.093"
    const regexGrupoLeyes =
      /\b(?:leyes|ley)\s+(?:n[°ºo]?\s*|n[úu]mero\s*)?(\d{1,2}(?:\.\d{3})+|\d{4,6})(?:\s*(?:\/|y|,)\s*(?:ley\s+)?(?:n[°ºo]?\s*|n[úu]mero\s*)?(\d{1,2}(?:\.\d{3})+|\d{4,6}))+/gi;

    let res = segmento.replace(regexGrupoLeyes, (match) => {
      const nums = match.match(/\d{1,2}(?:\.\d{3})+|\d{4,6}/g) || [];
      const todosPermitidos =
        nums.length > 0 &&
        nums.every((n) => {
          const c = n.replace(/\./g, '');
          if (c === '27743') return hasIti;
          if (c === '25246') return hasUif && !claimsTax;
          return !hasTax;
        });
      if (todosPermitidos) return match;

      if (hasTax) return '[VERIFICAR: normativa tributaria aplicable]';
      return '[VERIFICAR: normativa aplicable]';
    });

    // Procesar citas individuales: "Ley 23.282", "Ley 17.801", "Ley 27.743"
    const regexLeyIndividual =
      /\b(?:ley)\s+(?:n[°ºo]?\s*|n[úu]mero\s*)?(\d{1,2}(?:\.\d{3})+|\d{4,6})\b/gi;
    res = res.replace(regexLeyIndividual, (match, num) => {
      const clean = String(num).replace(/\./g, '');
      if (clean === '27743') {
        if (hasIti) return match;
        return '[VERIFICAR: normativa aplicable]';
      }
      if (clean === '25246') {
        if (hasUif && !claimsTax) return match;
        return '[VERIFICAR: normativa tributaria aplicable]';
      }
      if (hasTax) {
        return '[VERIFICAR: normativa tributaria aplicable]';
      }
      return match;
    });

    // Limpiar duplicaciones consecutivas del placeholder
    res = res.replace(
      /(?:\[VERIFICAR:\s*normativa\s+(?:tributaria\s+)?aplicable\](?:\s*(?:\/|y|,)\s*|\s+))+\[VERIFICAR:\s*normativa\s+(?:tributaria\s+)?aplicable\]/gi,
      (m) => {
        return m.includes('tributaria')
          ? '[VERIFICAR: normativa tributaria aplicable]'
          : '[VERIFICAR: normativa aplicable]';
      }
    );

    return res;
  });

  let out = procesadas.join('');
  for (const { key, val } of marcadores) {
    out = out.split(key).join(val);
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

  if (estadoIti === 'post_derogacion') {
    if (patronMencionIti.test(cuerpo)) {
      cuerpo = reemplazarSubclausulaItiUnica(cuerpo, LEYENDA_ITI_DEROGADO);
    }

    datosFaltantes = datosFaltantes.filter(
      (d) => !/(?<!c\.?o\.?\s*)(?<!coti\s*)\b(?:i\.?t\.?i\.?|impuesto\s+a\s+la\s+transferencia\s+de\s+inmuebles)\b/i.test(d) ||
             /ganancias|\big\b/i.test(d)
    );
    datosFaltantes = datosFaltantes.map((d) => sanearPlaceholdersIti(d));

    advertencias = advertencias.filter(
      (a) => !/(?:retenci[oó]n|aplicar|calcular)\s+(?:del?\s+)?(?:i\.?t\.?i\.?|impuesto\s+a\s+la\s+transferencia\s+de\s+inmuebles)/i.test(a) ||
             /ganancias|\big\b/i.test(a)
    );
    advertencias = advertencias.map((a) => sanearPlaceholdersIti(a));

    // Si no existe ninguna mención a ITI (la IA lo omitió), insertar obligatoriamente la constancia
    if (!cuerpo.includes(LEYENDA_ITI_DEROGADO)) {
      let insertadaEnGastos = false;
      const lineas = cuerpo.split('\n');
      const lineasMod = lineas.map((linea) => {
        if (
          !insertadaEnGastos &&
          /^\s*[A-ZÁÉÍÓÚÑ]+(?:\s+[A-ZÁÉÍÓÚÑ]+)?\s*:\s*(?:(?:DE\s+LOS\s+)?GASTOS\s+E\s+IMPUESTOS|IMPUESTOS\s+Y\s+GASTOS|GASTOS)\b/i.test(linea)
        ) {
          insertadaEnGastos = true;
          const trim = linea.trim();
          const finPunto = /[.:;!?]$/.test(trim);
          const sep = finPunto ? ' ' : '. ';
          return `${trim}${sep}${LEYENDA_ITI_DEROGADO}`;
        }
        return linea;
      });

      if (insertadaEnGastos) {
        cuerpo = lineasMod.join('\n');
      } else {
        const regexDeclJuradas = /^(\s*[A-ZÁÉÍÓÚÑ]+(?:\s+[A-ZÁÉÍÓÚÑ]+)?\s*:\s*DECLARACIONES\s+JURADAS\b)/im;
        if (regexDeclJuradas.test(cuerpo)) {
          cuerpo = cuerpo.replace(
            regexDeclJuradas,
            `CLAUSULA: GASTOS E IMPUESTOS. ${LEYENDA_ITI_DEROGADO}\n\n$1`
          );
        } else {
          cuerpo = `${cuerpo}\n\nCLAUSULA: GASTOS E IMPUESTOS. ${LEYENDA_ITI_DEROGADO}`;
        }
        cuerpo = recalcularOrdinalesNotariales(cuerpo);
      }
    }

    // Garantizar exactamente una aparición de LEYENDA_ITI_DEROGADO
    const primeraPos = cuerpo.indexOf(LEYENDA_ITI_DEROGADO);
    if (primeraPos !== -1) {
      const antes = cuerpo.slice(0, primeraPos + LEYENDA_ITI_DEROGADO.length);
      const despues = cuerpo.slice(primeraPos + LEYENDA_ITI_DEROGADO.length).split(LEYENDA_ITI_DEROGADO).join('');
      cuerpo = antes + despues;
    }
  } else if (estadoIti === 'ambigua_o_ausente' && patronMencionIti.test(cuerpo)) {
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

  // Sanitizar citas normativas tributarias no verificadas (ej. Ley 23.282, Ley 25.093)
  cuerpo = sanearCitasNormativasTributarias(cuerpo);
  datosFaltantes = datosFaltantes.map((d) => sanearCitasNormativasTributarias(d));
  advertencias = advertencias.map((a) => sanearCitasNormativasTributarias(a));

  if (cuerpo.includes('[VERIFICAR: normativa tributaria aplicable]')) {
    if (!datosFaltantes.some((d) => d.includes('normativa tributaria aplicable'))) {
      datosFaltantes.push('[VERIFICAR: normativa tributaria aplicable]');
    }
    if (!advertencias.some((a) => a.includes('normativa tributaria aplicable'))) {
      advertencias.push('Revisión profesional requerida: verificar normativa tributaria aplicable al acto.');
    }
  }

  if (cuerpo.includes('[VERIFICAR: normativa aplicable]')) {
    if (!datosFaltantes.some((d) => d.includes('normativa aplicable'))) {
      datosFaltantes.push('[VERIFICAR: normativa aplicable]');
    }
    if (!advertencias.some((a) => a.includes('normativa aplicable'))) {
      advertencias.push('Revisión profesional requerida: verificar normativa legal aplicable al acto.');
    }
  }

  // Recalcular y validar ordinales notariales en el cuerpo final si hay cláusulas pendientes, desorden o documento completo
  if (
    cuerpo.includes('CLAUSULA:') ||
    !validarOrdinalesNotariales(cuerpo).ok ||
    /^\s*PRIMER[AO]:/im.test(cuerpo)
  ) {
    cuerpo = recalcularOrdinalesNotariales(cuerpo);
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
    'Estructura sugerida del cuerpo (adaptala al tipo de acto): encabezado y número, lugar y fecha, comparecencia e identificación de los comparecientes, antecedentes de dominio/título, objeto del acto, precio y forma de pago (si corresponde), medios de pago y origen de fondos, estado de ocupación y entrega de posesión (si corresponde), certificados y libre de gravámenes/inhibiciones, gastos e impuestos, declaraciones juradas, y cierre/otorgamiento.',
    'Cláusulas numeradas ordinalmente en estilo notarial femenino tradicional (PRIMERA:, SEGUNDA:, TERCERA:, CUARTA:, QUINTA:, SEXTA:, SÉPTIMA:, OCTAVA:, etc.).',
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
