'use server';

import { createClient } from '@/lib/supabase/server';
import { getUserProfile } from '@/lib/auth/getUserProfile';
import { canUseAi, isUserRole } from '@/lib/permissions/roles';
import { generarEmbedding } from '@/lib/ai/embeddings';
import { normalizeIndustryType } from '@/lib/industries/documentTypes';
import { getRagSystemPrompt } from '@/lib/industries/aiConfig';

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

  // Verificamos que el legajo exista y pertenezca a la organización
  const { data: caseData } = await supabase
    .from('cases')
    .select('id')
    .eq('id', caseId)
    .eq('organization_id', profile.organization_id)
    .maybeSingle();

  if (!caseData) return { ok: false, error: 'Legajo no encontrado o sin acceso.' };

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

  // 4) Quedarnos SOLO con fragmentos de los documentos de este legajo (deduplicados y máximo 8)
  const delLegajo: any[] = [];
  const contentSet = new Set<string>();
  for (const m of (matches ?? [])) {
    if (idsCaso.has(m.document_id)) {
      const c = (m.content || '').trim();
      if (!contentSet.has(c)) {
        contentSet.add(c);
        delLegajo.push(m);
        if (delLegajo.length >= 8) break;
      }
    }
  }

  if (delLegajo.length === 0) {
    return {
      ok: true,
      respuesta:
        'No encontré información relacionada en los documentos de este legajo. Puede que todavía no estén analizados con IA (indexados): analizalos desde la pestaña Documentos y volvé a preguntar.',
      fuentes: [],
    };
  }

  const fuentes: FuenteLegajo[] = delLegajo.map((m: any) => ({
    documentId: m.document_id,
    fileName: nombrePorId.get(m.document_id) ?? 'Documento',
    fragmento: m.content,
    similitud: m.similarity,
  }));

  // 5) Prompt RAG (mismo criterio que el buscador global)
  const contexto = fuentes.map((f, i) => `[${i + 1}] (${f.fileName})\n${f.fragmento}`).join('\n\n');
  const prompt = `${getRagSystemPrompt(industry)}

FRAGMENTOS:
${contexto}

PREGUNTA: ${texto}

RESPUESTA:`;

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
        generationConfig: { temperature: 0.2 },
      }),
    });

    if (!resp.ok) {
      const t = await resp.text();
      return { ok: false, error: 'Error del modelo: ' + t.slice(0, 160) };
    }

    const data = await resp.json();
    const respuesta =
      data?.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join('') ??
      'No se pudo generar una respuesta.';

    await supabase.from('audit_logs').insert({
      organization_id: profile.organization_id,
      user_id: user.id,
      action: 'AI_RAG_QUERY',
      entity_type: 'case',
      entity_id: caseId,
      details: { prompt_length: prompt.length, response_length: respuesta.length, chunks: fuentes.length },
      ip_address: null
    });

    return { ok: true, respuesta, fuentes };
  } catch (e) {
    return { ok: false, error: 'Error de red: ' + String(e).slice(0, 160) };
  }
}
