'use server';

import { createClient } from '@/lib/supabase/server';
import { getUserProfile } from '@/lib/auth/getUserProfile';
import { canUseAi, isUserRole } from '@/lib/permissions/roles';
import { generarEmbedding } from '@/lib/ai/embeddings';
import { createAuditLog } from '@/lib/audit/createAuditLog';
import { normalizeIndustryType } from '@/lib/industries/documentTypes';
import { getRagSystemPrompt } from '@/lib/industries/aiConfig';
import crypto from 'crypto';

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
  correlationId?: string;
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

  const correlationId = crypto.randomUUID();

  try {
    const supabase = await createClient();

    // Verificamos que el legajo exista y pertenezca a la organización
    const { data: caseData } = await supabase
      .from('cases')
      .select('id')
      .eq('id', caseId)
      .eq('organization_id', profile.organization_id)
      .maybeSingle();

    if (!caseData) return { ok: false, error: 'El legajo no está disponible.', correlationId };

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

    // 2) Embedding de la pregunta
    const emb = await generarEmbedding(texto);
    if ('error' in emb) {
      await logRagError(profile.organization_id, user.id, caseId, correlationId, 'embedding_failed');
      return { ok: false, error: 'No pude consultar los documentos. Reintentá.', correlationId };
    }

    // 3) Búsqueda vectorial
    let matches: any[] | null = null;
    let matchError: any = null;

    ({ data: matches, error: matchError } = await supabase.rpc('match_case_document_chunks', {
      p_case_id: caseId,
      p_query_embedding: emb.values,
      p_match_threshold: 0.1,
      p_match_count: 8,
    }));

    if (matchError) {
      ({ data: matches, error: matchError } = await supabase.rpc('match_case_document_chunks', {
        p_case_id: caseId,
        p_query_embedding: JSON.stringify(emb.values),
        p_match_threshold: 0.1,
        p_match_count: 8,
      }));
    }

    if (matchError) {
      console.error('RAG RPC Error:', matchError);
      await logRagError(profile.organization_id, user.id, caseId, correlationId, 'rpc_failed');
      return { ok: false, error: 'No pude consultar los documentos. Reintentá.', correlationId };
    }

    // Deduplicación
    const delLegajo: any[] = [];
    const contentSet = new Set<string>();
    const docCounts = new Map<string, number>();

    for (const m of (matches ?? [])) {
      const c = (m.chunk_text || '').trim();
      if (!c) continue;

      if (!contentSet.has(c)) {
        const dId = m.document_id;
        const dCount = docCounts.get(dId) || 0;

        if (dCount < 3) {
          contentSet.add(c);
          docCounts.set(dId, dCount + 1);
          delLegajo.push(m);
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
      fragmento: m.chunk_text,
      similitud: m.similarity,
    }));

    // 5) Prompt RAG
    const contexto = fuentes.map((f, i) => `[${i + 1}] (${f.fileName})\n${f.fragmento}`).join('\n\n');
    const prompt = `${getRagSystemPrompt(industry)}

FRAGMENTOS:
${contexto}

PREGUNTA: ${texto}

RESPUESTA:`;

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      await logRagError(profile.organization_id, user.id, caseId, correlationId, 'missing_api_key');
      return { ok: false, error: 'No pude consultar los documentos. Reintentá.', correlationId };
    }
    const modelo = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

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
      if (resp.status === 429) {
        await logRagError(profile.organization_id, user.id, caseId, correlationId, 'rate_limit');
        return { ok: false, error: 'Demasiadas consultas a la vez. Reintentá en un minuto.', correlationId };
      }
      console.error('RAG LLM Fetch error:', resp.status, await resp.text());
      await logRagError(profile.organization_id, user.id, caseId, correlationId, 'llm_network_error');
      return { ok: false, error: 'No pude consultar los documentos. Reintentá.', correlationId };
    }

    const data = await resp.json();
    const respuesta =
      data?.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join('') ??
      '';

    if (!respuesta || data?.candidates?.[0]?.finishReason === 'SAFETY') {
      await logRagError(profile.organization_id, user.id, caseId, correlationId, 'guardrail_triggered');
      return { ok: false, error: 'No pude generar una respuesta segura.', correlationId };
    }

    const promptHash = crypto.createHash('sha256').update(prompt).digest('hex');

    await createAuditLog({
      organizationId: profile.organization_id,
      userId: user.id,
      action: 'AI_RAG_QUERY',
      resourceType: 'case',
      resourceId: caseId,
      metadata: {
        correlation_id: correlationId,
        prompt_hash: promptHash,
        prompt_length: prompt.length,
        response_length: respuesta.length,
        chunks: fuentes.length,
        document_ids: Array.from(docCounts.keys())
      }
    });

    return { ok: true, respuesta, fuentes, correlationId };
  } catch (e) {
    console.error('RAG Unhandled Error:', e);
    const supabase = await createClient();
    await logRagError(profile.organization_id, user.id, caseId, correlationId, 'unhandled_exception');
    return { ok: false, error: 'No pude consultar los documentos. Reintentá.', correlationId };
  }
}

async function logRagError(orgId: string, userId: string, caseId: string, correlationId: string, errorType: string) {
  try {
    await createAuditLog({
      organizationId: orgId,
      userId,
      action: 'AI_RAG_ERROR',
      resourceType: 'case',
      resourceId: caseId,
      metadata: {
        correlation_id: correlationId,
        error_type: errorType,
      }
    });
  } catch(e) {
    // Fallback if DB is down, just silently fail audit logging
  }
}
