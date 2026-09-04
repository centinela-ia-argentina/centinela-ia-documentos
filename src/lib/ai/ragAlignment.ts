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

  // 1. Intentar parsear como salida estructurada JSON si tiene formato JSON
  let structuredData: { answer?: string; hasEvidence?: boolean; citedSourceIndexes?: number[] } | null = null;
  if (trimmed.startsWith('{') || trimmed.includes('```json') || trimmed.includes('```')) {
    try {
      let jsonStr = trimmed;
      if (jsonStr.includes('```json')) {
        const match = jsonStr.match(/```json\s*([\s\S]*?)\s*```/);
        if (match) jsonStr = match[1];
      } else if (jsonStr.includes('```')) {
        const match = jsonStr.match(/```\s*([\s\S]*?)\s*```/);
        if (match) jsonStr = match[1];
      }
      const parsed = JSON.parse(jsonStr.trim());
      if (typeof parsed === 'object' && parsed !== null) {
        structuredData = parsed;
      }
    } catch {
      // JSON inválido: continuar a modo texto plano de forma segura
    }
  }

  // Si se obtuvo JSON estructurado
  if (structuredData) {
    const answer = typeof structuredData.answer === 'string' ? structuredData.answer.trim() : trimmed;
    const explicitNoEvidence = structuredData.hasEvidence === false;

    if (explicitNoEvidence || esRespuestaNegativa(answer)) {
      const cleanAnswer = answer.replace(/\[\d+\]/g, '').replace(/\s{2,}/g, ' ').trim();
      return {
        respuesta: cleanAnswer || 'No surge información suficiente en los documentos consultados.',
        hasEvidence: false,
        fuentes: [],
      };
    }

    const rawIndexes = Array.isArray(structuredData.citedSourceIndexes)
      ? structuredData.citedSourceIndexes
      : [];

    const extractedFromText: number[] = [];
    const matchesCitation = answer.matchAll(/\[(\d+)\]/g);
    for (const m of matchesCitation) {
      const idx = parseInt(m[1], 10);
      if (Number.isFinite(idx)) extractedFromText.push(idx);
    }

    const candidateIndexes = rawIndexes.length > 0 ? rawIndexes : extractedFromText;
    const validUniqueIndexes: number[] = [];
    for (const idx of candidateIndexes) {
      if (Number.isInteger(idx) && idx >= 1 && idx <= rawSources.length && !validUniqueIndexes.includes(idx)) {
        validUniqueIndexes.push(idx);
      }
    }

    if (validUniqueIndexes.length === 0) {
      // Respuesta positiva sin citas válidas -> NO FALLBACK (fuentes: [])
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

    let renumberedAnswer = answer.replace(/\[(\d+)\]/g, (_match, p1) => {
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

  // 2. Modo texto plano estándar
  if (esRespuestaNegativa(trimmed)) {
    const cleanAnswer = trimmed.replace(/\[\d+\]/g, '').replace(/\s{2,}/g, ' ').trim();
    return {
      respuesta: cleanAnswer,
      hasEvidence: false,
      fuentes: [],
    };
  }

  // Extraer citas [n] respetando orden de aparición
  const validUniqueIndexes: number[] = [];
  const matchesCitation = trimmed.matchAll(/\[(\d+)\]/g);
  for (const m of matchesCitation) {
    const idx = parseInt(m[1], 10);
    if (Number.isInteger(idx) && idx >= 1 && idx <= rawSources.length && !validUniqueIndexes.includes(idx)) {
      validUniqueIndexes.push(idx);
    }
  }

  if (validUniqueIndexes.length === 0) {
    // Si la respuesta positiva no contiene citas válidas, fuentes = [] (NO FALLBACK)
    const cleanAnswer = trimmed.replace(/\[\d+\]/g, '').replace(/\s{2,}/g, ' ').trim();
    return {
      respuesta: cleanAnswer,
      hasEvidence: true,
      fuentes: [],
    };
  }

  // Renumeración simultánea 1-a-1
  const indexMapping = new Map<number, number>();
  validUniqueIndexes.forEach((oldIdx, i) => {
    indexMapping.set(oldIdx, i + 1);
  });

  let renumberedAnswer = trimmed.replace(/\[(\d+)\]/g, (_match, p1) => {
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
