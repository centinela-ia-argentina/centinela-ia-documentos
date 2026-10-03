// 🔍 Utilidades para parsing, validación y alineación estricta de respuestas RAG.
// Garantiza correspondencia exacta 1-a-1 entre [n] en el texto y el array de fuentes devuelto.
// Descarta fallbacks no citados y detecta respuestas sin evidencia de forma robusta.

export interface RagParsedResult<T> {
  respuesta: string;
  hasEvidence: boolean;
  fuentes: T[];
}

export const NEGATIVE_PATTERNS: readonly RegExp[] = [
  /no (surge|se encuentra|consta|contiene|se menciona|hay informaci[oó]n|figura|se desprende)/i,
  /no puedo determinar(?:lo)?/i,
  /no hay evidencia suficiente/i,
  /el dato no est[aá] disponible/i,
  /no se menciona/i,
  /sin informaci[oó]n/i,
  /no es posible determinar/i,
  /no poseo informaci[oó]n/i,
  /no surge de los fragmentos/i,
  /no se desprende de la documentaci[oó]n/i,
  /no cuento con informaci[oó]n/i,
  /informaci[oó]n no disponible/i,
  /los documentos no contienen/i,
  /no surge de las constancias/i,
] as const;

export function esRespuestaNegativa(texto: string): boolean {
  const t = (texto || '').trim();
  if (!t) return true;
  return NEGATIVE_PATTERNS.some((pattern) => pattern.test(t));
}

export const RESPUETA_NEGATIVA_ESTANDAR =
  'La información solicitada no surge de los documentos disponibles.';

/**
 * Remueve formato markdown ruidoso del texto (negritas, itálicas, encabezados, bloques de código en línea)
 * para presentar un texto limpio y seguro, sin asteriscos crudos.
 */
export function normalizarMarkdownTexto(texto: string): string {
  if (!texto) return '';
  return texto
    // Negrita / cursiva combinada (*** o ___): ***texto*** -> texto
    .replace(/(\*{3}|_{3})(.*?)\1/g, '$2')
    // Negrita (** o __): **texto** -> texto
    .replace(/(\*{2}|_{2})(.*?)\1/g, '$2')
    // Cursiva (* o _): *texto* -> texto (evitando romper guiones bajos dentro de identificadores si se usan solos)
    .replace(/(^|[^\w])(\*|_)(.*?)\2([^\w]|$)/g, '$1$3$4')
    // Código en línea (`code` -> code)
    .replace(/`([^`]+)`/g, '$1')
    // Encabezados markdown (# Titulo -> Titulo)
    .replace(/^#{1,6}\s+/gm, '')
    // Múltiples espacios
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

/**
 * Extrae todos los números enteros de citas dentro de corchetes compuestos o simples:
 * e.g. [1], [1, 7], [1, 2], [3, 1, 3]
 */
function extraerIndicesDeCorchete(bracketContent: string): number[] {
  const parts = bracketContent.split(',');
  const numbers: number[] = [];
  for (const part of parts) {
    const val = parseInt(part.trim(), 10);
    if (Number.isInteger(val) && val > 0) {
      numbers.push(val);
    }
  }
  return numbers;
}

export function parseAndAlignRagResponse<T>(
  rawText: string,
  rawSources: T[]
): RagParsedResult<T> {
  const trimmed = (rawText || '').trim();
  if (!trimmed) {
    return {
      respuesta: RESPUETA_NEGATIVA_ESTANDAR,
      hasEvidence: false,
      fuentes: [],
    };
  }

  // 1. Detección de salida estructurada JSON (fail-closed si tiene formato JSON pero falla parsing)
  const looksLikeJson = trimmed.startsWith('{') || trimmed.includes('```json') || trimmed.includes('```');

  if (looksLikeJson) {
    let jsonStr = trimmed;
    if (jsonStr.includes('```json')) {
      const match = jsonStr.match(/```json\s*([\s\S]*?)\s*```/);
      if (match) {
        jsonStr = match[1];
      } else {
        // Bloque ```json incompleto o roto -> fallar cerrado
        return {
          respuesta: 'No se pudo procesar la respuesta estructurada o la información no surge de los documentos disponibles.',
          hasEvidence: false,
          fuentes: [],
        };
      }
    } else if (jsonStr.includes('```')) {
      const match = jsonStr.match(/```\s*([\s\S]*?)\s*```/);
      if (match) {
        jsonStr = match[1];
      } else {
        // Bloque de código roto -> fallar cerrado
        return {
          respuesta: 'No se pudo procesar la respuesta estructurada o la información no surge de los documentos disponibles.',
          hasEvidence: false,
          fuentes: [],
        };
      }
    }

    let parsed: any;
    try {
      parsed = JSON.parse(jsonStr.trim());
    } catch {
      // JSON inválido: NO hacer fallback a texto plano; fallar cerrado
      return {
        respuesta: 'No se pudo procesar la respuesta estructurada o la información no surge de los documentos disponibles.',
        hasEvidence: false,
        fuentes: [],
      };
    }

    // Validar estructura requerida de JSON parseado
    if (!parsed || typeof parsed !== 'object') {
      return {
        respuesta: 'No se pudo validar la estructura de la respuesta o la información no surge de los documentos disponibles.',
        hasEvidence: false,
        fuentes: [],
      };
    }

    if (typeof parsed.answer !== 'string' || !parsed.answer.trim()) {
      return {
        respuesta: 'No se pudo validar la estructura de la respuesta o la información no surge de los documentos disponibles.',
        hasEvidence: false,
        fuentes: [],
      };
    }

    if (typeof parsed.hasEvidence !== 'boolean') {
      return {
        respuesta: 'No se pudo validar la estructura de la respuesta o la información no surge de los documentos disponibles.',
        hasEvidence: false,
        fuentes: [],
      };
    }

    const answer = normalizarMarkdownTexto(parsed.answer);
    const explicitNoEvidence = parsed.hasEvidence === false;

    // Si hasEvidence es false o la respuesta es negativa: fuentes[] DEBE ser [] y se minimiza estrictamente sin PII
    if (explicitNoEvidence || esRespuestaNegativa(answer)) {
      return {
        respuesta: RESPUETA_NEGATIVA_ESTANDAR,
        hasEvidence: false,
        fuentes: [],
      };
    }

    const declaredIndexes: number[] = [];
    if (Array.isArray(parsed.citedSourceIndexes)) {
      for (const item of parsed.citedSourceIndexes) {
        if (Number.isInteger(item) && item > 0 && !declaredIndexes.includes(item)) {
          declaredIndexes.push(item);
        }
      }
    }

    // Extraer citas inline (soporta compuestas como [1, 7], [1,2], etc.) en orden de aparición en el texto
    const inlineIndexes: number[] = [];
    for (const m of answer.matchAll(/\[([0-9,\s]+)\]/g)) {
      const nums = extraerIndicesDeCorchete(m[1]);
      for (const idx of nums) {
        if (!inlineIndexes.includes(idx)) {
          inlineIndexes.push(idx);
        }
      }
    }

    // Validación cruzada estricta:
    // - Las fuentes devueltas deben estar citadas tanto inline como en rango válido
    // - Si citedSourceIndexes contiene [1, 2] pero el texto solo cita [1] -> se conserva sólo la 1
    // - Si el texto cita [1, 7] pero fuentes tiene 1 elemento -> [7] queda dangling y se descarta
    const validUniqueIndexes: number[] = [];
    for (const idx of inlineIndexes) {
      if (
        idx >= 1 &&
        idx <= rawSources.length &&
        (declaredIndexes.length === 0 || declaredIndexes.includes(idx)) &&
        !validUniqueIndexes.includes(idx)
      ) {
        validUniqueIndexes.push(idx);
      }
    }

    if (validUniqueIndexes.length === 0) {
      const cleanAnswer = answer.replace(/\[([0-9,\s]+)\]/g, '').replace(/\s{2,}/g, ' ').trim();
      return {
        respuesta: cleanAnswer,
        hasEvidence: true,
        fuentes: [],
      };
    }

    // Renumerar 1-a-1: oldIndex -> newIndex (1, 2, 3...)
    const indexMapping = new Map<number, number>();
    validUniqueIndexes.forEach((oldIdx, i) => {
      indexMapping.set(oldIdx, i + 1);
    });

    let renumberedAnswer = answer.replace(/\[([0-9,\s]+)\]/g, (_match: string, p1: string) => {
      const nums = extraerIndicesDeCorchete(p1);
      const renumberedMapped: number[] = [];
      for (const n of nums) {
        const newIdx = indexMapping.get(n);
        if (newIdx !== undefined && !renumberedMapped.includes(newIdx)) {
          renumberedMapped.push(newIdx);
        }
      }
      return renumberedMapped.length > 0 ? `[${renumberedMapped.join(', ')}]` : '';
    });
    renumberedAnswer = renumberedAnswer.replace(/\s{2,}/g, ' ').trim();

    const fuentesValidas = validUniqueIndexes.map((idx) => rawSources[idx - 1]);

    return {
      respuesta: renumberedAnswer,
      hasEvidence: true,
      fuentes: fuentesValidas,
    };
  }

  // 2. Modo texto plano estándar (no JSON)
  const normalizedText = normalizarMarkdownTexto(trimmed);
  if (esRespuestaNegativa(normalizedText)) {
    return {
      respuesta: RESPUETA_NEGATIVA_ESTANDAR,
      hasEvidence: false,
      fuentes: [],
    };
  }

  const validUniqueIndexes: number[] = [];
  const matchesCitation = normalizedText.matchAll(/\[([0-9,\s]+)\]/g);
  for (const m of matchesCitation) {
    const nums = extraerIndicesDeCorchete(m[1]);
    for (const idx of nums) {
      if (idx >= 1 && idx <= rawSources.length && !validUniqueIndexes.includes(idx)) {
        validUniqueIndexes.push(idx);
      }
    }
  }

  if (validUniqueIndexes.length === 0) {
    const cleanAnswer = normalizedText.replace(/\[([0-9,\s]+)\]/g, '').replace(/\s{2,}/g, ' ').trim();
    return {
      respuesta: cleanAnswer,
      hasEvidence: true,
      fuentes: [],
    };
  }

  const indexMapping = new Map<number, number>();
  validUniqueIndexes.forEach((oldIdx, i) => {
    indexMapping.set(oldIdx, i + 1);
  });

  let renumberedAnswer = normalizedText.replace(/\[([0-9,\s]+)\]/g, (_match: string, p1: string) => {
    const nums = extraerIndicesDeCorchete(p1);
    const renumberedMapped: number[] = [];
    for (const n of nums) {
      const newIdx = indexMapping.get(n);
      if (newIdx !== undefined && !renumberedMapped.includes(newIdx)) {
        renumberedMapped.push(newIdx);
      }
    }
    return renumberedMapped.length > 0 ? `[${renumberedMapped.join(', ')}]` : '';
  });
  renumberedAnswer = renumberedAnswer.replace(/\s{2,}/g, ' ').trim();

  const fuentesValidas = validUniqueIndexes.map((idx) => rawSources[idx - 1]);

  return {
    respuesta: renumberedAnswer,
    hasEvidence: true,
    fuentes: fuentesValidas,
  };
}
