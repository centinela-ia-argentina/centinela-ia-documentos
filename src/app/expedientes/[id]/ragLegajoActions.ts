'use server';

import { createClient } from '@/lib/supabase/server';
import { getUserProfile } from '@/lib/auth/getUserProfile';
import { canUseAi, isUserRole } from '@/lib/permissions/roles';
import { generarEmbedding } from '@/lib/ai/embeddings';
import { normalizeIndustryType } from '@/lib/industries/documentTypes';
import { getRagSystemPrompt } from '@/lib/industries/aiConfig';
import { rankAndFilterFragments, cleanMarkdownForUI, parseModelJson } from '@/lib/ai/ragRanking';

export type FuenteLegajo = {
  documentId: string;
  fileName: string;
  fragmento: string;
  similitud: number;
};

export type RespuestaLegajo = {
  ok: boolean;
  respuesta?: string;
  fuentes?: FuenteLegajo[];
  error?: string;
};

export async function preguntarADocumentosLegajo(
  caseId: string,
  pregunta: string
): Promise<RespuestaLegajo> {
  const texto = (pregunta || '').trim();
  if (texto.length < 3) return { ok: false, error: 'Escribí una pregunta un poco más larga.' };
  if (!caseId) return { ok: false, error: 'Falta el legajo.' };

  const { user, profile } = await getUserProfile();
  if (!user || !profile) return { ok: false, error: 'Sesión no válida.' };
  if (!isUserRole(profile.role) || !canUseAi(profile.role)) {
    return { ok: false, error: 'Tu rol no tiene acceso a la búsqueda con IA.' };
  }

  const supabase = await createClient();

  // Rubro (define el tono del prompt: notarial / inmobiliario / jurídico)
  const { data: orgData } = await supabase
    .from('organizations')
    .select('industry_type')
    .eq('id', profile.organization_id)
    .single();
  const industry = normalizeIndustryType(orgData?.industry_type);

  // 1) Documentos que pertenecen a ESTE legajo
  const { data: docsCaso } = await supabase
    .from('documents')
    .select('id, file_name')
    .eq('case_id', caseId)
    .eq('organization_id', profile.organization_id);

  const idsCaso = new Set((docsCaso ?? []).map((d: any) => d.id));
  const nombrePorId = new Map((docsCaso ?? []).map((d: any) => [d.id, d.file_name]));

  if (idsCaso.size === 0) {
    return {
      ok: true,
      respuesta: 'Este legajo todavía no tiene documentos cargados para consultar.',
      fuentes: [],
    };
  }

  // 2) Embedding de la pregunta (mismo modelo/dimensiones que la indexación)
  const emb = await generarEmbedding(texto);
  if ('error' in emb) {
    return { ok: false, error: 'No se pudo procesar la pregunta: ' + emb.error };
  }

  // 3) Búsqueda vectorial (org) + fallback de formato para pgvector.
  //    Traemos de más y filtramos a los documentos de este legajo.
  let matches: any[] | null = null;
  let matchError: { message: string } | null = null;

  ({ data: matches, error: matchError } = await supabase.rpc('match_document_chunks', {
    query_embedding: emb.values,
    match_org: profile.organization_id,
    match_count: 80,
  }));

  if (matchError) {
    ({ data: matches, error: matchError } = await supabase.rpc('match_document_chunks', {
      query_embedding: JSON.stringify(emb.values),
      match_org: profile.organization_id,
      match_count: 80,
    }));
  }

  if (matchError) return { ok: false, error: 'Error al buscar: ' + matchError.message };

  // 4) Quedarnos SOLO con fragmentos de los documentos de este legajo
  const delLegajo = (matches ?? []).filter((m: any) => idsCaso.has(m.document_id));

  const rankedFragments = rankAndFilterFragments(delLegajo, texto);

  if (rankedFragments.length === 0) {
    return {
      ok: true,
      respuesta:
        'No encontré información relacionada en los documentos de este legajo. Puede que todavía no estén analizados con IA (indexados): analizalos desde la pestaña Documentos y volvé a preguntar.',
      fuentes: [],
    };
  }

  const fuentes: FuenteLegajo[] = rankedFragments.map((m: any) => ({
    documentId: m.documentId,
    fileName: nombrePorId.get(m.documentId) ?? 'Documento',
    fragmento: m.fragmento,
    similitud: m.similitud,
  }));

  // 5) Prompt RAG (mismo criterio que el buscador global)
  const contexto = fuentes.map((f, i) => `[${i}] (${f.fileName})\n${f.fragmento}`).join('\n\n');
  const prompt = `${getRagSystemPrompt(industry)}

Tu respuesta debe estar estructurada en formato JSON estricto con las siguientes claves:
"respuesta": "tu texto de respuesta"
"fuentes_utilizadas": [arreglo de enteros con los índices de los fragmentos que utilizaste, por ejemplo [0, 2]]

Reglas:
- Responde únicamente con los fragmentos provistos.
- No cites un fragmento si no sustenta un dato de la respuesta.
- Si no hay evidencia suficiente, dilo en la respuesta.
- No utilices encabezados Markdown, tablas, bloques de código ni asteriscos de negrita en la respuesta.
- El JSON debe ser válido.

FRAGMENTOS:
${contexto}

PREGUNTA: ${texto}`;

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return { ok: false, error: 'Falta la API key.' };
  const modelo = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

  try {
    const url =
      'https://generativelanguage.googleapis.com/v1beta/models/' +
      modelo +
      ':generateContent?key=' +
      apiKey;

    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.1, responseMimeType: 'application/json' },
      }),
    });

    if (!resp.ok) {
      const t = await resp.text();
      return { ok: false, error: 'Error del modelo: ' + t.slice(0, 160) };
    }

    const data = await resp.json();
    const textoCrudo =
      data?.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join('') ??
      '';

    const parseado = parseModelJson(textoCrudo, { respuesta: textoCrudo, fuentes_utilizadas: [] as number[] });
    const respuestaFinal = cleanMarkdownForUI(parseado.respuesta || 'No se pudo generar una respuesta.');
    
    // Filtrar las fuentes para devolver solo las usadas
    let fuentesUsadas = fuentes;
    if (Array.isArray(parseado.fuentes_utilizadas) && parseado.fuentes_utilizadas.length > 0) {
      fuentesUsadas = parseado.fuentes_utilizadas
        .map(idx => fuentes[idx])
        .filter(f => !!f);
    }

    if (fuentesUsadas.length === 0 && parseado.respuesta !== textoCrudo) {
       // Parseó bien pero array vacío
    } else if (fuentesUsadas.length === 0) {
       // Falló el parseo
       fuentesUsadas = fuentes;
    }

    const fuentesUI = Array.from(new Map(fuentesUsadas.map(f => [f.documentId, f])).values());

    return { ok: true, respuesta: respuestaFinal, fuentes: fuentesUI };
  } catch (e) {
    return { ok: false, error: 'Error de red: ' + String(e).slice(0, 160) };
  }
}
