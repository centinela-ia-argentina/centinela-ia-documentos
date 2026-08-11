export type RawMatch = {
  document_id: string;
  content: string;
  similarity: number;
  fileName?: string;
};

export type RankedFragment = {
  documentId: string;
  fragmento: string;
  similitud: number;
};

// Adaptive filtering, deduplication and ranking
export function rankAndFilterFragments(matches: RawMatch[], query: string): RankedFragment[] {
  if (!matches || matches.length === 0) return [];

  // Normalize similarity
  const validMatches = matches
    .map(m => ({ ...m, similarity: Number.isFinite(m.similarity) ? m.similarity : 0 }))
    .filter(m => m.similarity > 0);

  if (validMatches.length === 0) return [];

  // Sort initially by similarity
  validMatches.sort((a, b) => b.similarity - a.similarity);

  // Adaptive threshold
  const bestSimilarity = validMatches[0].similarity;
  const threshold = Math.max(bestSimilarity - 0.15, 0.5); // At least 0.5 or close to best

  // Token extraction from query for lexical boost
  const stopWords = new Set(['el', 'la', 'los', 'las', 'un', 'una', 'unos', 'unas', 'y', 'o', 'pero', 'si', 'no', 'de', 'del', 'a', 'al', 'con', 'por', 'para', 'en', 'es', 'son', 'qué', 'que', 'cual', 'cuales', 'como', 'entre']);
  const queryTokens = query.toLowerCase().split(/\W+/).filter(t => t.length > 2 && !stopWords.has(t));

  const scoredMatches = validMatches.map(m => {
    let score = m.similarity;
    if (score < threshold) score = 0; // Excluir efectivamente candidatos irrelevantes
    
    // Lexical boost
    let lexicalMatches = 0;
    const contentLower = m.content.toLowerCase();
    const nameLower = m.fileName ? m.fileName.toLowerCase() : '';
    for (const token of queryTokens) {
      if (contentLower.includes(token)) lexicalMatches++;
      if (nameLower.includes(token)) lexicalMatches += 2; // boost for filename match
    }
    score += (lexicalMatches * 0.02);

    return { ...m, finalScore: score };
  }).filter(m => m.finalScore >= threshold); // Filter out the ones that were excluded

  // Sort by final score
  scoredMatches.sort((a, b) => b.finalScore - a.finalScore);

  // Deduplication limits
  const maxPerDoc = 2;
  const maxDocs = 4;
  const maxTotal = 6;

  const finalFragments: RankedFragment[] = [];
  const docCounts = new Map<string, number>();
  let distinctDocs = 0;

  for (const m of scoredMatches) {
    if (finalFragments.length >= maxTotal) break;

    const count = docCounts.get(m.document_id) || 0;
    if (count === 0) {
      if (distinctDocs >= maxDocs) continue;
      distinctDocs++;
    }

    if (count >= maxPerDoc) continue;

    docCounts.set(m.document_id, count + 1);
    finalFragments.push({
      documentId: m.document_id,
      fragmento: m.content,
      similitud: m.similarity,
    });
  }

  return finalFragments;
}

// Strip markdown for clean UI output
export function cleanMarkdownForUI(text: string): string {
  if (!text) return '';
  return text
    .replace(/```[a-z]*\n/g, '') // remove code block start
    .replace(/```/g, '') // remove code block end
    .replace(/^#{1,6}\s+/gm, '') // remove headers
    .replace(/\*\*/g, '') // remove bold
    .replace(/\*/g, '') // remove italic
    .trim();
}

// Parse JSON from LLM safely
export function parseModelJson<T>(text: string, fallback: T): T {
  try {
    const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start >= 0 && end >= 0) {
      return JSON.parse(cleaned.substring(start, end + 1)) as T;
    }
    return JSON.parse(cleaned) as T;
  } catch (e) {
    return fallback;
  }
}
