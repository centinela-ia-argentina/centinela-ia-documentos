'use server';

import { createClient } from '@/lib/supabase/server';
import { getUserProfile } from '@/lib/auth/getUserProfile';
import { canUseAi, isUserRole } from '@/lib/permissions/roles';
import { generarEmbedding } from '@/lib/ai/embeddings';
import { indexarDocumento } from '@/lib/ai/indexarDocumento';
import { normalizeIndustryType } from '@/lib/industries/documentTypes';
import { getRagSystemPrompt } from '@/lib/industries/aiConfig';

export type FuenteBusqueda = {
  documentId: string;
  fileName: string;
  fragmento: string;
  similitud: number;
};

export type RespuestaBusqueda = {
  ok: boolean;
  respuesta?: string;
  fuentes?: FuenteBusqueda[];
  error?: string;
};

export async function preguntarADocumentos(pregunta: string): Promise<RespuestaBusqueda> {
  const texto = (pregunta || '').trim();
  if (texto.length < 3) return { ok: false, error: 'Escribí una pregunta un poco más larga.' };

  const { user, profile } = await getUserProfile();
  if (!user || !profile) return { ok: false, error: 'Sesión no válida.' };
  if (!isUserRole(profile.role) || !canUseAi(profile.role)) {
    return { ok: false, error: 'Tu rol no tiene acceso a la búsqueda con IA.' };
  }

  const supabase = await createClient();

  const { data: orgData } = await supabase
    .from('organizations')
    .select('industry_type')
    .eq('id', profile.organization_id)
    .single();
  const industry = normalizeIndustryType(orgData?.industry_type);

  // 1) Embedding de la pregunta (mismo modelo/dimensiones que la indexación)
  const emb = await generarEmbedding(texto);
  if ('error' in emb) {
    return { ok: false, error: 'No se pudo procesar la pregunta: ' + emb.error };
  }

  // 2) Buscar fragmentos similares (con fallback de formato para pgvector)
  let matches: any[] | null = null;
  let matchError: { message: string } | null = null;

  ({ data: matches, error: matchError } = await supabase.rpc('match_document_chunks', {
    query_embedding: emb.values,
    match_org: profile.organization_id,
    match_count: 8,
  }));

  if (matchError) {
    ({ data: matches, error: matchError } = await supabase.rpc('match_document_chunks', {
      query_embedding: JSON.stringify(emb.values),
      match_org: profile.organization_id,
      match_count: 8,
    }));
  }

  if (matchError) return { ok: false, error: 'Error al buscar: ' + matchError.message };

  if (!matches || matches.length === 0) {
    return {
      ok: true,
      respuesta:
        'No encontré información relacionada en tus documentos indexados. Probá reanalizar algún documento o reformular la pregunta.',
      fuentes: [],
    };
  }

  // 3) Nombres de archivo para citar
  const docIds = [...new Set(matches.map((m) => m.document_id))];
  const { data: docs } = await supabase
    .from('documents')
    .select('id, file_name')
    .in('id', docIds);
  const nombrePorId = new Map((docs ?? []).map((d: any) => [d.id, d.file_name]));

  const fuentes: FuenteBusqueda[] = matches.map((m) => ({
    documentId: m.document_id,
    fileName: nombrePorId.get(m.document_id) ?? 'Documento',
    fragmento: m.content,
    similitud: m.similarity,
  }));

  // 4) Prompt RAG
  const contexto = fuentes
    .map((f, i) => `[${i + 1}] (${f.fileName})\n${f.fragmento}`)
    .join('\n\n');

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

    return { ok: true, respuesta, fuentes };
  } catch (e) {
    return { ok: false, error: 'Error de red: ' + String(e).slice(0, 160) };
  }
}

export type BackfillResult = {
  ok: boolean;
  indexados?: number;
  yaIndexados?: number;
  sinTexto?: number;
  errores?: number;
  total?: number;
  error?: string;
};

export async function indexarDocumentosExistentes(): Promise<BackfillResult> {
  const { user, profile } = await getUserProfile();
  if (!user || !profile) return { ok: false, error: 'Sesión no válida.' };
  if (!isUserRole(profile.role) || !canUseAi(profile.role)) {
    return { ok: false, error: 'Tu rol no tiene acceso.' };
  }

  const supabase = await createClient();

  // Documentos que YA tienen fragmentos indexados (para saltarlos)
  const { data: yaChunks } = await supabase
    .from('document_chunks')
    .select('document_id')
    .eq('organization_id', profile.organization_id);
  const indexadosSet = new Set((yaChunks ?? []).map((c: any) => c.document_id));

  // Análisis existentes (el más reciente por documento)
  const { data: outputs, error: outErr } = await supabase
    .from('ai_outputs')
    .select('document_id, result_json, created_at')
    .eq('organization_id', profile.organization_id)
    .eq('output_type', 'document_analysis')
    .order('created_at', { ascending: false });

  if (outErr) return { ok: false, error: 'No se pudieron leer los análisis: ' + outErr.message };

  const vistos = new Set<string>();
  let indexados = 0;
  let yaIndexados = 0;
  let sinTexto = 0;
  let errores = 0;
  let total = 0;

  for (const row of outputs ?? []) {
    const docId = row.document_id as string;
    if (!docId || vistos.has(docId)) continue; // solo el análisis más reciente por doc
    vistos.add(docId);
    total++;

    if (indexadosSet.has(docId)) {
      yaIndexados++;
      continue;
    }

    const a = (row.result_json ?? {}) as any;
    const texto = [
      a.resumen ?? '',
      Array.isArray(a.datos_relevantes) ? a.datos_relevantes.join('. ') : '',
      Array.isArray(a.alertas) ? a.alertas.join('. ') : '',
      Array.isArray(a.proximas_acciones) ? a.proximas_acciones.join('. ') : '',
      a.texto_extraido_preview ?? '',
    ]
      .filter(Boolean)
      .join('\n')
      .trim();

    if (texto.length < 20) {
      sinTexto++;
      continue;
    }

    try {
      const r = await indexarDocumento(supabase, {
        documentId: docId,
        organizationId: profile.organization_id,
        texto,
      });
      if (r.ok) indexados++;
      else errores++;
    } catch {
      errores++;
    }
  }

  return { ok: true, indexados, yaIndexados, sinTexto, errores, total };
}
