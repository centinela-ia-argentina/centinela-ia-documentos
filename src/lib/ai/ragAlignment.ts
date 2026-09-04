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

export function parseAndAlignRagResponse<T>(
  rawText: string,
  rawSources: T[]
): RagParsedResult<T> {
  const trimmed = (rawText || '').trim();
  if (!trimmed) {
    return {
      respuesta: 'No se pudo obtener información suficiente en los documentos para responder a la consulta.',
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

    const answer = parsed.answer.trim();
    const explicitNoEvidence = parsed.hasEvidence === false;

    // Si hasEvidence es false o la respuesta es negativa: fuentes[] DEBE ser [] y se eliminan citas
    if (explicitNoEvidence || esRespuestaNegativa(answer)) {
      const cleanAnswer = answer.replace(/\[\d+\]/g, '').replace(/\s{2,}/g, ' ').trim();
      return {
        respuesta: cleanAnswer || 'No surge información suficiente en los documentos consultados.',
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

    // Extraer citas inline en orden de aparición en el texto
    const inlineIndexes: number[] = [];
    for (const m of answer.matchAll(/\[(\d+)\]/g)) {
      const idx = parseInt(m[1], 10);
      if (Number.isInteger(idx) && !inlineIndexes.includes(idx)) {
        inlineIndexes.push(idx);
      }
    }

    // Validación cruzada estricta:
    // - Las fuentes devueltas deben estar citadas tanto inline como en rango válido
    // - Si citedSourceIndexes contiene [1, 2] pero el texto solo cita [1] -> se conserva sólo la 1
    // - Si el texto cita [1, 3] pero fuentes tiene 2 elementos -> [3] queda dangling y se descarta
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
      const cleanAnswer = answer.replace(/\[\d+\]/g, '').replace(/\s{2,}/g, ' ').trim();
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

    let renumberedAnswer = answer.replace(/\[(\d+)\]/g, (_match: string, p1: string) => {
      const oldIdx = parseInt(p1, 10);
      const newIdx = indexMapping.get(oldIdx);
      return newIdx ? `[${newIdx}]` : '';
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
  if (esRespuestaNegativa(trimmed)) {
    const cleanAnswer = trimmed.replace(/\[\d+\]/g, '').replace(/\s{2,}/g, ' ').trim();
    return {
      respuesta: cleanAnswer,
      hasEvidence: false,
      fuentes: [],
    };
  }

  const validUniqueIndexes: number[] = [];
  const matchesCitation = trimmed.matchAll(/\[(\d+)\]/g);
  for (const m of matchesCitation) {
    const idx = parseInt(m[1], 10);
    if (Number.isInteger(idx) && idx >= 1 && idx <= rawSources.length && !validUniqueIndexes.includes(idx)) {
      validUniqueIndexes.push(idx);
    }
  }

  if (validUniqueIndexes.length === 0) {
    const cleanAnswer = trimmed.replace(/\[\d+\]/g, '').replace(/\s{2,}/g, ' ').trim();
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

  let renumberedAnswer = trimmed.replace(/\[(\d+)\]/g, (_match: string, p1: string) => {
    const oldIdx = parseInt(p1, 10);
    const newIdx = indexMapping.get(oldIdx);
    return newIdx ? `[${newIdx}]` : '';
  });
  renumberedAnswer = renumberedAnswer.replace(/\s{2,}/g, ' ').trim();

  const fuentesValidas = validUniqueIndexes.map((idx) => rawSources[idx - 1]);

  return {
    respuesta: renumberedAnswer,
    hasEvidence: true,
    fuentes: fuentesValidas,
  };
}
