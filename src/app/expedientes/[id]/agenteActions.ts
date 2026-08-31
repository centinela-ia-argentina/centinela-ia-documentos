'use server';

import { createClient } from '@/lib/supabase/server';
import { getUserProfile } from '@/lib/auth/getUserProfile';
import { getStrictIndustryForOrganization } from '@/lib/auth/getStrictIndustry';
import { normalizeIndustryType, type IndustryType } from '@/lib/industries/documentTypes';
import { canUseAi, canUpdateCase, isUserRole } from '@/lib/permissions/roles';
import { revalidatePath } from 'next/cache';
import { guardarPlazoDetectado, guardarTurno } from '@/app/agenda/actions';
import { generarResumenExpediente, cotejarExpediente, redactarEscrituraExpediente, analizarUifExpediente, redactarAvisoExpediente, redactarBorradorInmobiliaria, calificarInquilinoExpediente } from '@/app/expedientes/actions';
import { getAllowedCaseStatuses, getCaseStatusLabel, getCaseFields } from '@/lib/industries/caseConfig';
import { responderAgenteLegajo, type MensajeChat, type AccionPropuesta } from '@/lib/ai/agente';
import { generarEmbedding } from '@/lib/ai/embeddings';
import { calcularIncapacidad } from "@/lib/legal/liquidacion";
import { calcularVencimientoProcesal } from '@/lib/legal/plazos';
import { calcularTasaJusticia } from '@/lib/legal/tasaJusticia';
import { createAuditLog } from '@/lib/audit/createAuditLog';
import crypto from 'crypto';

export async function preguntarAgente(input: {
  caseId: string;
  historial: MensajeChat[];
  pregunta: string;
}): Promise<
  { ok: false; motivo: string; correlationId?: string } | { ok: true; respuesta: string; acciones: AccionPropuesta[] }
> {
  const pregunta = (input.pregunta ?? '').trim();
  if (!pregunta) return { ok: false, motivo: 'Escribí una pregunta.' };

  const { user, profile } = await getUserProfile();
  if (!user || !profile) return { ok: false, motivo: 'Sesión no válida.' };
  if (!canUseAi(profile.role)) return { ok: false, motivo: 'No tenés permiso para usar la IA.' };

  const supabase = await createClient();

  const { data: caseData } = await supabase
    .from('cases')
    .select('*')
    .eq('id', input.caseId)
    .eq('organization_id', profile.organization_id)
    .single();
  if (!caseData) return { ok: false, motivo: 'Legajo no encontrado.' };

  let industry: IndustryType;
  try {
    industry = await getStrictIndustryForOrganization(profile.organization_id);
  } catch (e) {
    return { ok: false, motivo: 'Industria no autorizada.' };
  }

  const { data: docsData } = await supabase
    .from('documents')
    .select('id, file_name, document_type, expires_at')
    .eq('case_id', input.caseId)
    .eq('organization_id', profile.organization_id)
    .order('created_at', { ascending: false });
  const documentos = docsData ?? [];
  const nombrePorDoc = new Map<string, string>();
  const vencimientoPorDoc = new Map<string, string | null>();
  for (const d of documentos) {
    nombrePorDoc.set(d.id, d.file_name);
    vencimientoPorDoc.set(d.id, (d as any).expires_at ?? null);
  }

  const { data: analisisData } = await supabase
    .from('ai_outputs')
    .select('document_id, result_json, created_at')
    .eq('case_id', input.caseId)
    .eq('organization_id', profile.organization_id)
    .eq('output_type', 'document_analysis')
    .order('created_at', { ascending: false });

  const { data: resumenData } = await supabase
    .from('ai_outputs')
    .select('result_json')
    .eq('case_id', input.caseId)
    .eq('organization_id', profile.organization_id)
    .eq('output_type', 'case_summary')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: cotejoData } = await supabase
    .from('ai_outputs')
    .select('result_json')
    .eq('case_id', input.caseId)
    .eq('organization_id', profile.organization_id)
    .eq('output_type', 'case_cotejo')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: uifData } = await supabase
    .from('ai_outputs')
    .select('result_json')
    .eq('case_id', input.caseId)
    .eq('organization_id', profile.organization_id)
    .eq('output_type', 'case_uif')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  // Cronología: actuaciones y plazos cargados a mano o detectados por la IA
  // (misma fuente que alimenta el Radar de plazos).
  const { data: eventosData } = await supabase
    .from('case_events')
    .select('event_date, event_type, title, description')
    .eq('case_id', input.caseId)
    .eq('organization_id', profile.organization_id)
    .order('event_date', { ascending: true });

  // Checklist del legajo: ítems y si ya tienen documento vinculado.
  const { data: checklistsData } = await supabase
    .from('checklists')
    .select('id')
    .eq('case_id', input.caseId)
    .eq('organization_id', profile.organization_id);
  const checklistIdsCtx = (checklistsData ?? []).map((c) => c.id);
  let checklistItemsCtx: Array<{ title: string; status: string; document_id: string | null }> = [];
  if (checklistIdsCtx.length > 0) {
    const { data: itemsData } = await supabase
      .from('checklist_items')
      .select('title, status, document_id')
      .in('checklist_id', checklistIdsCtx);
    checklistItemsCtx = (itemsData ?? []) as any;
  }

  const partes: string[] = [];
  partes.push(`LEGAJO: ${caseData.title ?? 'Sin título'}`);
  partes.push(
    `Cliente: ${caseData.client_name ?? '-'} | Tipo: ${caseData.case_type ?? '-'} | Estado: ${getCaseStatusLabel(caseData.status, industry)}`
  );

  // Datos propios del rubro cargados en el formulario del legajo
  // (en legal: carátula, N° de expediente, juzgado, fuero, parte contraria,
  // estado procesal, próxima fecha clave). Se leen de metadata por su clave.
  const metadataLegajo = (caseData.metadata ?? {}) as Record<string, unknown>;
  const camposRubro = getCaseFields(industry)
    .map((f) => {
      const v = metadataLegajo[f.key];
      const texto = v == null ? '' : String(v).trim();
      return texto ? `- ${f.label}: ${texto}` : '';
    })
    .filter(Boolean);
  if (camposRubro.length) {
    partes.push('\nDATOS DEL EXPEDIENTE (cargados en el legajo, usalos como verdad):');
    partes.push(camposRubro.join('\n'));
  }

  const resumenJson = (resumenData?.result_json ?? null) as any;
  if (resumenJson) {
    partes.push('\nRESUMEN DEL EXPEDIENTE:');
    if (resumenJson.resumen_general) partes.push(String(resumenJson.resumen_general));
    if (resumenJson.estado_actual) partes.push(`Estado procesal: ${resumenJson.estado_actual}`);
    if (Array.isArray(resumenJson.puntos_clave) && resumenJson.puntos_clave.length)
      partes.push(`Puntos clave: ${resumenJson.puntos_clave.join('; ')}`);
    if (Array.isArray(resumenJson.riesgos_alertas) && resumenJson.riesgos_alertas.length)
      partes.push(`Riesgos/alertas: ${resumenJson.riesgos_alertas.join('; ')}`);
    if (Array.isArray(resumenJson.proximas_acciones) && resumenJson.proximas_acciones.length)
      partes.push(`Próximas acciones sugeridas: ${resumenJson.proximas_acciones.join('; ')}`);
  }

  const cotejoJson = (cotejoData?.result_json ?? null) as any;
  if (cotejoJson) {
    partes.push('\nCOTEJO DE DOCUMENTOS:');
    if (cotejoJson.veredicto) partes.push(String(cotejoJson.veredicto));
    if (Array.isArray(cotejoJson.discrepancias) && cotejoJson.discrepancias.length)
      partes.push(`Discrepancias: ${cotejoJson.discrepancias.join('; ')}`);
    if (Array.isArray(cotejoJson.faltantes) && cotejoJson.faltantes.length)
      partes.push(`Faltantes: ${cotejoJson.faltantes.join('; ')}`);
    if (Array.isArray(cotejoJson.alertas_vigencia) && cotejoJson.alertas_vigencia.length)
      partes.push(`Alertas de vigencia: ${cotejoJson.alertas_vigencia.join('; ')}`);
  }

  // Análisis de riesgo UIF/PLA ya generado para el legajo (si existe).
  // Se lo damos al agente para que NO proponga volver a analizar cuando ya hay
  // un análisis, y para que pueda decidir con criterio si corresponde un ROS.
  const uifJson = (uifData?.result_json ?? null) as any;
  if (uifJson) {
    partes.push('\nANÁLISIS UIF / PLA (ya realizado por el sistema; usalo como VERDAD, no propongas volver a analizar salvo que el legajo haya cambiado):');
    if (uifJson.nivel_riesgo) partes.push(`Nivel de riesgo: ${String(uifJson.nivel_riesgo).toUpperCase()}`);
    partes.push(`¿Requiere ROS?: ${uifJson.requiere_ros ? 'SÍ' : 'NO'}`);
    if (uifJson.fundamento) partes.push(`Fundamento: ${uifJson.fundamento}`);
    if (Array.isArray(uifJson.factores_riesgo) && uifJson.factores_riesgo.length)
      partes.push(`Factores de riesgo: ${uifJson.factores_riesgo.join('; ')}`);
    if (Array.isArray(uifJson.senales_alerta) && uifJson.senales_alerta.length)
      partes.push(`Señales de alerta: ${uifJson.senales_alerta.join('; ')}`);
    if (Array.isArray(uifJson.verificaciones_pendientes) && uifJson.verificaciones_pendientes.length)
      partes.push(`Verificaciones pendientes: ${uifJson.verificaciones_pendientes.join('; ')}`);
    partes.push('Si el nivel es ALTO o requiere ROS, podés proponer preparar el borrador de ROS. Si es BAJO/MEDIO y no requiere ROS, aclaralo y NO propongas el ROS.');
  }

  // Vencimientos cargados directamente en los documentos (certificados, etc.)
  const vencimientos: string[] = [];
  for (const d of documentos) {
    const v = (d as any).expires_at as string | null;
    if (v) vencimientos.push(`- ${d.file_name}: vence ${String(v).slice(0, 10)}`);
  }
  if (vencimientos.length) {
    partes.push('\nVENCIMIENTOS DE DOCUMENTOS (fecha de expiración cargada):');
    partes.push(vencimientos.join('\n'));
  }

  // --- Control de vigencias (calculado, determinístico) ---
  // Cruza los vencimientos de los documentos contra HOY y contra la próxima
  // firma agendada, para que el agente avise con precisión antes de firmar.
  {
    const hoyIso = new Date().toISOString().slice(0, 10);
    const { data: firmaData } = await supabase
      .from('agenda_plazos')
      .select('fecha, titulo')
      .eq('case_id', input.caseId)
      .eq('organization_id', profile.organization_id)
      .eq('categoria', 'firma')
      .gte('fecha', hoyIso)
      .order('fecha', { ascending: true })
      .limit(1)
      .maybeSingle();
    const firmaIso = firmaData?.fecha ? String(firmaData.fecha).slice(0, 10) : null;

    const conVenc = documentos.filter((d) => (d as any).expires_at);
    if (conVenc.length > 0) {
      const diasEntre = (a: string, b: string) =>
        Math.round(
          (new Date(b + 'T00:00:00').getTime() - new Date(a + 'T00:00:00').getTime()) / 86400000
        );
      const lineas = conVenc.map((d) => {
        const venceIso = String((d as any).expires_at).slice(0, 10);
        const dHoy = diasEntre(hoyIso, venceIso);
        let estado: string;
        if (dHoy < 0) estado = `VENCIDO hace ${Math.abs(dHoy)} día(s)`;
        else if (dHoy <= 30) estado = `POR VENCER en ${dHoy} día(s)`;
        else estado = `VIGENTE (vence en ${dHoy} día(s))`;
        let extra = '';
        if (firmaIso) {
          const dFirma = diasEntre(firmaIso, venceIso);
          extra =
            dFirma < 0
              ? ` — ⚠️ estará VENCIDO el día de la firma (${firmaIso})`
              : ` — OK para la firma del ${firmaIso}`;
        }
        return `- ${d.file_name}: vence ${venceIso} → ${estado}${extra}`;
      });
      partes.push(
        `\nCONTROL DE VIGENCIAS (calculado por el sistema; usalo como VERDAD, no recalcules fechas)${
          firmaIso ? ` — FIRMA AGENDADA: ${firmaIso}` : ''
        }:`
      );
      partes.push(lineas.join('\n'));
      if (firmaIso) {
        partes.push(
          'Si algún certificado figura como "estará VENCIDO el día de la firma", avisalo con claridad y proponé solicitar/renovar el documento y, si hace falta, reprogramar la firma.'
        );
      }
    }
  }

  // Cronología del legajo: actuaciones y plazos (a mano o detectados por la IA).
  // Marcamos los FUTUROS para que el agente pueda proponer agendarlos.
  const eventos = eventosData ?? [];
  if (eventos.length) {
    const hoyIso = new Date().toISOString().slice(0, 10);
    partes.push('\nCRONOLOGÍA DEL LEGAJO (actuaciones y plazos; los marcados como PLAZO FUTURO son agendables):');
    partes.push(
      eventos
        .map((e) => {
          const f = String((e as any).event_date ?? '').slice(0, 10);
          const estado = f && f >= hoyIso ? 'PLAZO FUTURO' : 'ya pasó';
          const tipo = (e as any).event_type ?? 'otro';
          const titulo = (e as any).title ?? '';
          const desc = (e as any).description ? ` — ${(e as any).description}` : '';
          return `- ${f} [${estado}] (${tipo}) ${titulo}${desc}`;
        })
        .join('\n')
    );
  }

  const analisisPorDoc = new Map<string, any>();
  for (const o of analisisData ?? []) {
    if (o.document_id && !analisisPorDoc.has(o.document_id))
      analisisPorDoc.set(o.document_id, o.result_json);
  }
  if (analisisPorDoc.size > 0) {
    partes.push('\nDOCUMENTOS ANALIZADOS:');
    let i = 1;
    for (const [docId, rj] of analisisPorDoc.entries()) {
      const nombre = nombrePorDoc.get(docId) || 'documento';
      const r = (rj ?? {}) as any;
      const bloque = [`Documento ${i}: ${nombre} (${r.tipo_documental_detectado ?? 'tipo no detectado'})`];
      const venceDoc = vencimientoPorDoc.get(docId);
      if (venceDoc) bloque.push(`Vencimiento del documento: ${String(venceDoc).slice(0, 10)}`);
      if (r.resumen) bloque.push(`Resumen: ${r.resumen}`);
      if (Array.isArray(r.partes) && r.partes.length) bloque.push(`Partes: ${r.partes.join('; ')}`);
      if (Array.isArray(r.datos_clave) && r.datos_clave.length) bloque.push(`Datos clave: ${r.datos_clave.join('; ')}`);
      if (Array.isArray(r.clausulas_riesgos) && r.clausulas_riesgos.length) bloque.push(`Cláusulas/riesgos: ${r.clausulas_riesgos.join('; ')}`);
      if (Array.isArray(r.alertas) && r.alertas.length) bloque.push(`Alertas: ${r.alertas.join('; ')}`);
      if (Array.isArray(r.fechas_plazos) && r.fechas_plazos.length)
        bloque.push(`Fechas/plazos: ${r.fechas_plazos.map((f: any) => `${f.descripcion ?? ''} (${f.fecha ?? ''})`).join('; ')}`);
      partes.push(bloque.join('\n'));
      i++;
    }
  } else if (documentos.length > 0) {
    partes.push('\nDOCUMENTOS DEL LEGAJO (sin analizar aún):');
    partes.push(documentos.map((d) => `- ${d.file_name}`).join('\n'));
  }

  // Checklist en el contexto: marcamos cuáles se pueden vincular a un documento.
  if (checklistItemsCtx.length > 0) {
    partes.push('\nCHECKLIST DEL LEGAJO (los marcados "PENDIENTE (sin documento)" se pueden vincular con un documento del legajo que los cumpla):');
    partes.push(
      checklistItemsCtx
        .map((it) => {
          const nombreDoc = it.document_id ? (nombrePorDoc.get(it.document_id) ?? 'documento') : null;
          const marca = nombreDoc
            ? `YA VINCULADO: ${nombreDoc}`
            : ['received', 'reviewed', 'not_required'].includes(it.status)
              ? 'resuelto / no aplica'
              : 'PENDIENTE (sin documento)';
          return `- ${it.title} [${marca}]`;
        })
        .join('\n')
    );
  }

  // --- RAG: fragmentos textuales relevantes de los documentos del legajo ---
  // Además del análisis ya extraído, buscamos en el TEXTO COMPLETO indexado
  // los fragmentos más parecidos a la pregunta, para que el agente pueda
  // responder cualquier detalle y citar el documento del que salió.
  try {
    const idsCasoRag = new Set(documentos.map((d) => d.id));
    if (idsCasoRag.size > 0) {
      const emb = await generarEmbedding(pregunta);
      if (!('error' in emb)) {
        let matches: any[] | null = null;
        let matchError: { message: string } | null = null;
        ({ data: matches, error: matchError } = await supabase.rpc('match_case_document_chunks', {
          p_case_id: input.caseId,
          p_query_embedding: emb.values,
          p_match_threshold: 0.1,
          p_match_count: 20,
        }));
        if (matchError) {
          ({ data: matches, error: matchError } = await supabase.rpc('match_case_document_chunks', {
            p_case_id: input.caseId,
            p_query_embedding: JSON.stringify(emb.values),
            p_match_threshold: 0.1,
            p_match_count: 20,
          }));
        }
        const delLegajo: any[] = [];
        const contentSet = new Set<string>();
        for (const m of (matches ?? [])) {
          const c = (m.chunk_text || '').trim();
          if (!contentSet.has(c)) {
            contentSet.add(c);
            delLegajo.push(m);
          }
        }
        if (delLegajo.length > 0) {
          partes.push(
            '\nFRAGMENTOS TEXTUALES RELEVANTES (extractos del texto real de los documentos para ESTA pregunta; citá el documento por su nombre entre paréntesis cuando los uses):'
          );
          partes.push(
            delLegajo
              .map((m: any, i: number) => {
                const nombre = nombrePorDoc.get(m.document_id) ?? 'documento';
                return `[${i + 1}] (${nombre})\n${m.chunk_text}`;
              })
              .join('\n\n')
          );
        }
      }
    }
  } catch (e) {
    console.error('Agente RAG fragmentos error:', e);
  }

  const contextoLegajo = partes.join('\n');

  let documentEvidenceState: 'no_analyzed_documents' | 'analyzed_without_usable_context' | 'usable_context' = 'no_analyzed_documents';
  if (analisisPorDoc.size > 0 || uifData?.result_json || cotejoData?.result_json || resumenJson?.resumen_general || contextoLegajo.includes('FRAGMENTOS TEXTUALES RELEVANTES')) {
    if (contextoLegajo.length > 50) {
      documentEvidenceState = 'usable_context';
    } else {
      documentEvidenceState = 'analyzed_without_usable_context';
    }
  }

  const historial = Array.isArray(input.historial)
    ? input.historial
        .filter((m) => m && (m.rol === 'user' || m.rol === 'model') && typeof m.texto === 'string')
        .slice(-12)
    : [];

  const res = await responderAgenteLegajo({
    industry,
    contextoLegajo,
    historial,
    pregunta,
    documentEvidenceState
  });

  if (!res.ok) {
    const correlationId = crypto.randomUUID();
    let errorState = 'technical_error';
    if (res.motivo === 'rate_limit') errorState = 'rate_limit';
    else if (res.motivo === 'invalid_response') errorState = 'guardrail';
    else if (res.motivo === 'sin_api_key') errorState = 'unavailable';

    await createAuditLog({
      organizationId: profile.organization_id,
      userId: user.id,
      action: 'AI_AGENT_ERROR',
      resourceType: 'case',
      resourceId: input.caseId,
      metadata: { correlation_id: correlationId, error: errorState, original_error: res.motivo }
    });

    return { ok: false, motivo: errorState, correlationId };
  }

  const promptHash = crypto.createHash('sha256').update(contextoLegajo + pregunta).digest('hex');
  await createAuditLog({
    organizationId: profile.organization_id,
    userId: user.id,
    action: 'AI_AGENT_QUERY',
    resourceType: 'case',
    resourceId: input.caseId,
    metadata: {
      correlation_id: crypto.randomUUID(),
      prompt_hash: promptHash,
      prompt_length: contextoLegajo.length + pregunta.length,
      response_length: res.respuesta.length,
      source_count: partes.length
    }
  });
  // Guardar la conversación en la memoria del legajo.
  // Si falla, no rompemos el chat: solo lo registramos en consola.
  try {
    await supabase.from('agent_messages').insert([
      {
        organization_id: profile.organization_id,
        case_id: input.caseId,
        role: 'user',
        content: pregunta,
        created_by: user.id,
      },
      {
        organization_id: profile.organization_id,
        case_id: input.caseId,
        role: 'assistant',
        content: res.respuesta,
        created_by: user.id,
      },
    ]);
  } catch (e) {
    console.error('Agente guardar memoria error:', e);
  }

  return { ok: true, respuesta: res.respuesta, acciones: res.acciones };
}

// Borra toda la conversación guardada del Agente IA en un legajo.
export async function borrarConversacionAgente(input: {
  caseId: string;
}): Promise<{ ok: boolean; motivo?: string }> {
  const { user, profile } = await getUserProfile();
  if (!user || !profile) return { ok: false, motivo: 'Sesión no válida.' };
  if (!canUseAi(profile.role)) return { ok: false, motivo: 'No tenés permiso.' };
  const supabase = await createClient();
  const { error } = await supabase
    .from('agent_messages')
    .delete()
    .eq('case_id', input.caseId)
    .eq('organization_id', profile.organization_id);
  if (error) {
    console.error('Agente borrar conversación error:', error);
    return { ok: false, motivo: 'No se pudo borrar la conversación.' };
  }

  await createAuditLog({
    organizationId: profile.organization_id,
    userId: user.id,
    action: 'agent_memory_cleared' as any,
    resourceType: 'case',
    resourceId: input.caseId,
    metadata: { info: 'Conversación de IA eliminada' },
  });

  revalidatePath(`/expedientes/${input.caseId}`);
  return { ok: true };
}

// Ejecuta una acción aprobada por el usuario sobre un legajo concreto.
// Valida permisos y organización antes de tocar la base.
export async function ejecutarAccionAgenteInner(input: {
  caseId: string;
  accion: AccionPropuesta;
}): Promise<{ ok: boolean; mensaje: string }> {
  const { user, profile } = await getUserProfile();
  if (!user || !profile) return { ok: false, mensaje: 'Sesión no válida.' };
  if (!isUserRole(profile.role)) return { ok: false, mensaje: 'No tenés permiso.' };

  const { caseId, accion } = input;
  if (!caseId) return { ok: false, mensaje: 'Falta el legajo.' };

  const supabase = await createClient();
  const { data: caseRecord } = await supabase
    .from('cases')
    .select('id')
    .eq('id', caseId)
    .eq('organization_id', profile.organization_id)
    .maybeSingle();
  if (!caseRecord) return { ok: false, mensaje: 'Legajo no encontrado.' };

  const fechaValida =
    typeof accion.fecha === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(accion.fecha);

  switch (accion.tipo) {
    case 'agendar_plazo': {
      if (!canUpdateCase(profile.role)) return { ok: false, mensaje: 'Sin permiso para agendar.' };
      if (!fechaValida) return { ok: false, mensaje: 'La acción no tiene una fecha válida.' };
      const r = await guardarPlazoDetectado({
        titulo: accion.titulo,
        fecha: accion.fecha as string,
        detalle: accion.motivo || 'Propuesto por el Agente IA del legajo',
        caseId,
      });
      return r.ok
        ? { ok: true, mensaje: r.existing ? 'Ese plazo ya estaba agendado.' : 'Plazo agendado en tu calendario.' }
        : { ok: false, mensaje: 'No se pudo agendar el plazo.' };
    }

    case 'agendar_turno':
    case 'agendar_firma': {
      if (!canUpdateCase(profile.role)) return { ok: false, mensaje: 'Sin permiso para agendar.' };
      if (!fechaValida) return { ok: false, mensaje: 'La acción no tiene una fecha válida.' };
      const esFirma = accion.tipo === 'agendar_firma';
      const horaOk =
        typeof accion.hora === 'string' && /^\d{2}:\d{2}$/.test(accion.hora.trim())
          ? accion.hora.trim()
          : undefined;
      const r = await guardarTurno({
        titulo: accion.titulo,
        fecha: accion.fecha as string,
        hora: horaOk,
        tipo: esFirma ? 'firma' : 'turno',
        detalle: accion.motivo || 'Propuesto por el Agente IA del legajo',
        caseId,
      });
      return r.ok
        ? { ok: true, mensaje: r.existing ? 'Ese evento ya estaba agendado.' : esFirma ? 'Firma agendada en tu calendario.' : 'Turno agendado en tu calendario.' }
        : { ok: false, mensaje: 'No se pudo agendar.' };
    }

    case "calcular_liquidacion": {
      if (!canUpdateCase(profile.role))
        return { ok: false, mensaje: "Sin permiso." }
      const metodo = accion.metodo === "vuoto" ? "vuoto" : "mendez"
      const calc = calcularIncapacidad({
        metodo,
        ingresoMensual: Number(accion.ingresoMensual),
        edad: Number(accion.edad),
        incapacidad: Number(accion.incapacidad),
      })
      if (!calc.ok)
        return {
          ok: false,
          mensaje:
            "No pude calcular la liquidación: faltan o son inválidos el ingreso, la edad o el % de incapacidad.",
        }
      const resultJson: any = {
          metodo,
          ingreso_mensual: Number(accion.ingresoMensual),
          edad: Number(accion.edad),
          incapacidad: Number(accion.incapacidad),
          capital: calc.capital,
          ingreso_anual_ajustado: calc.ingresoAnualAjustado,
          anios_computables: calc.aniosComputables,
          tasa_descuento: calc.tasaDescuento,
          parametros_capital: {
            metodo,
            ingresoMensual: Number(accion.ingresoMensual),
            edad: Number(accion.edad),
            incapacidad: Number(accion.incapacidad)
          },
          intereses_estado: 'no_calculados',
          intereses_motivo: 'Intereses no calculados: requieren definir jurisdicción, criterio aplicable y tasas por período.',
          fecha_calculo: new Date().toISOString(),
          caracter_orientativo: true,
      }

      const { error } = await supabase.from("ai_outputs").insert({
        output_type: "case_liquidacion",
        content: `Liquidación estimada (${metodo}) por incapacidad del ${accion.incapacidad}%`,
        result_json: resultJson,
        model_name: "calculadora-liquidacion",
        case_id: caseId,
        organization_id: profile.organization_id,
        created_by: user.id,
      })
      if (error) {
        console.error("Liquidación insert error:", error)
        return { ok: false, mensaje: "No se pudo guardar la liquidación." }
      }
      revalidatePath(`/expedientes/${caseId}`)
      return { ok: true, mensaje: "Liquidación estimada calculada (capital). Intereses no calculados." }
    }

    case 'calcular_plazo_procesal': {
      if (!canUpdateCase(profile.role)) return { ok: false, mensaje: 'Sin permiso.' };

      const jurisdiccionStr = typeof accion.jurisdiccion === 'string' ? accion.jurisdiccion.trim() : '';
      if (!jurisdiccionStr || !['nacion', 'corrientes', 'pba'].includes(jurisdiccionStr)) {
        return { ok: false, mensaje: 'La IA no indicó una jurisdicción válida (nacion, corrientes, pba). No se puede calcular el vencimiento.' };
      }

      const r = calcularVencimientoProcesal({
        fechaNotificacion: String(accion.fechaNotificacion ?? ''),
        diasHabiles: Number(accion.diasHabiles),
        jurisdiccion: jurisdiccionStr as any,
        kmDistancia: Number(accion.kmDistancia) || 0,
      });
      if (!r.ok) {
        return { ok: false, mensaje: r.motivo || 'No pude calcular el vencimiento: revisá la fecha de notificación, los días hábiles y la jurisdicción.' };
      }
      const { LEGAL_CALENDARS } = await import('@/lib/legal/config');
      const { error } = await supabase.from('ai_outputs').insert({
        output_type: 'case_plazo',
        content: `${accion.titulo} — vence ${r.vencimiento}`,
        result_json: {
          titulo: accion.titulo,
          fecha_notificacion: String(accion.fechaNotificacion ?? ''),
          dias_habiles: r.diasHabiles,
          dias_ampliacion: r.diasAmpliacion,
          dias_totales: r.diasTotales,
          jurisdiccion: r.jurisdiccion,
          calendario_anio: r.calendarioAnio,
          fuente: r.fuente,
          ultima_verificacion: LEGAL_CALENDARS[r.jurisdiccion].verifiedAt,
          caracter_orientativo: true,
          km_distancia: Number(accion.kmDistancia) || 0,
          cuenta_desde: r.cuentaDesde,
          vencimiento: r.vencimiento,
          pasos: r.pasos,
        },
        model_name: 'calculadora-plazos',
        case_id: caseId,
        organization_id: profile.organization_id,
        created_by: user.id,
      });
      if (error) {
        console.error('Plazo procesal insert error:', error);
        return { ok: false, mensaje: 'No se pudo guardar el vencimiento.' };
      }

      await guardarPlazoDetectado({
        titulo: `Vencimiento — ${accion.titulo}`,
        fecha: r.vencimiento!,
        detalle: `Plazo de ${r.diasTotales} días hábiles calculado por el Agente IA a partir de la notificación (Jurisdicción: ${r.jurisdiccion}). Fuente: ${r.fuente}. Carácter orientativo.`,
        caseId,
      });

      revalidatePath(`/expedientes/${caseId}`);
      return { ok: true, mensaje: `Vencimiento calculado y agendado: ${r.vencimiento}.` };
    }

    case 'calcular_tasa_justicia': {
      if (!canUpdateCase(profile.role)) return { ok: false, mensaje: 'Sin permiso.' };
      const jurisdiccionStr = typeof accion.jurisdiccion === 'string' ? accion.jurisdiccion.trim() : '';
      const tipoProcesoStr = typeof accion.tipo_proceso === 'string' ? accion.tipo_proceso.trim() as any : undefined;
      const confirmacionBool = Boolean(accion.confirmacion);
      const montoVal = Number(accion.monto);

      // 9. VALIDACIÓN SERVER-SIDE
      if (jurisdiccionStr !== 'nacion') return { ok: false, mensaje: 'Sólo se admite jurisdicción nacion.' };
      if (tipoProcesoStr !== 'general_pecuniary') return { ok: false, mensaje: 'Sólo se admite proceso pecuniario general.' };
      if (!confirmacionBool) return { ok: false, mensaje: 'Se requiere confirmación explícita.' };
      if (!Number.isFinite(montoVal) || montoVal <= 0) return { ok: false, mensaje: 'El monto debe ser numérico y mayor a cero.' };
      if (accion.moneda === 'USD') return { ok: false, mensaje: 'La moneda debe ser ARS. Para moneda extranjera indique la base imponible en pesos.' };

      const r = calcularTasaJusticia({
        monto: montoVal,
        jurisdiccion: jurisdiccionStr,
        tipo_proceso: tipoProcesoStr,
        confirmacion: confirmacionBool
      });
      if (!r.ok) return { ok: false, mensaje: r.motivo ?? 'No se pudo calcular la tasa de justicia.' };
      const { error } = await supabase.from('ai_outputs').insert({
        output_type: 'case_tasa_justicia',
        content: `${accion.titulo} — tasa $${r.tasa}`,
        result_json: {
          titulo: accion.titulo,
          base: r.base,
          porcentaje: r.porcentaje,
          tasa: r.tasa,
          jurisdiccion: r.jurisdiccion,
          fuente_nombre: r.fuente_nombre,
          fuente_url: r.fuente_url,
          norma: r.norma,
          vigencia: r.vigencia,
          fecha_calculo: r.fecha_calculo,
          verification_status: r.verification_status,
          caracter_orientativo: r.caracter_orientativo,
          tipo_proceso: r.tipo_proceso,
          confirmacion_sin_regimen_especial: r.confirmacion_sin_regimen_especial,
          advertencia_revision_profesional: r.advertencia_revision_profesional,
        },
        model_name: 'calculadora-tasa-justicia',
        case_id: caseId,
        organization_id: profile.organization_id,
        created_by: user.id,
      });
      if (error) {
        console.error('Tasa de justicia insert error:', error);
        return { ok: false, mensaje: 'No se pudo guardar la tasa de justicia.' };
      }
      revalidatePath(`/expedientes/${caseId}`);
      return { ok: true, mensaje: `Tasa de justicia calculada: $${r.tasa}.` };
    }

    case 'crear_actuacion': {
      if (!canUpdateCase(profile.role)) return { ok: false, mensaje: 'Sin permiso para cargar actuaciones.' };
      if (!fechaValida) return { ok: false, mensaje: 'La actuación no tiene una fecha válida.' };
      const { error } = await supabase.from('case_events').insert({
        organization_id: profile.organization_id,
        case_id: caseId,
        event_date: accion.fecha as string,
        event_type: 'otro',
        title: accion.titulo,
        description: accion.motivo || null,
        created_by: user.id,
      });
      if (error) {
        console.error('Agente crear_actuacion error:', error);
        return { ok: false, mensaje: 'No se pudo cargar la actuación.' };
      }
      revalidatePath(`/expedientes/${caseId}`);
      return { ok: true, mensaje: 'Actuación registrada en la cronología.' };
    }

    case 'agregar_checklist': {
      if (!canUpdateCase(profile.role)) return { ok: false, mensaje: 'Sin permiso para editar el checklist.' };
      let checklistId: string | undefined;
      const { data: existing } = await supabase
        .from('checklists')
        .select('id')
        .eq('case_id', caseId)
        .eq('organization_id', profile.organization_id)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();
      if (existing) {
        checklistId = existing.id;
      } else {
        const { data: nuevo, error: errNuevo } = await supabase
          .from('checklists')
          .insert({
            organization_id: profile.organization_id,
            case_id: caseId,
            name: 'Checklist documental',
            template_type: 'custom',
          })
          .select('id')
          .single();
        if (errNuevo || !nuevo) {
          console.error('Agente checklist create error:', errNuevo);
          return { ok: false, mensaje: 'No se pudo crear el checklist.' };
        }
        checklistId = nuevo.id;
      }
      const { error } = await supabase
        .from('checklist_items')
        .insert({ checklist_id: checklistId, title: accion.titulo, status: 'pending' });
      if (error) {
        console.error('Agente checklist item error:', error);
        return { ok: false, mensaje: 'No se pudo agregar el ítem.' };
      }
      revalidatePath(`/expedientes/${caseId}`);
      return { ok: true, mensaje: 'Ítem agregado al checklist.' };
    }

    case 'generar_resumen': {
      if (!canUseAi(profile.role)) return { ok: false, mensaje: 'Sin permiso para usar la IA.' };
      await generarResumenExpediente(caseId);
      revalidatePath(`/expedientes/${caseId}`);
      return { ok: true, mensaje: 'Resumen generado. Actualizá la página para verlo.' };
    }
    case 'generar_cotejo': {
      if (!canUseAi(profile.role)) return { ok: false, mensaje: 'Sin permiso para usar la IA.' };
      await cotejarExpediente(caseId);
      revalidatePath(`/expedientes/${caseId}`);
      return { ok: true, mensaje: 'Cotejo generado. Actualizá la página para verlo.' };
    }
    case 'redactar_borrador': {
      if (!canUseAi(profile.role)) return { ok: false, mensaje: 'Sin permiso para usar la IA.' };
      const { data: orgBorrador } = await supabase
        .from('organizations')
        .select('industry_type')
        .eq('id', profile.organization_id)
        .maybeSingle();
              const industryBorrador = normalizeIndustryType(orgBorrador?.industry_type);
        if (industryBorrador === 'inmobiliaria') {
          await redactarBorradorInmobiliaria(caseId);
          revalidatePath(`/expedientes/${caseId}`);
          return { ok: true, mensaje: 'Borrador de reserva/boleto generado. Actualizá la página para verlo.' };
        }
        if (industryBorrador === 'escribania') {
          await redactarEscrituraExpediente(caseId);
          revalidatePath(`/expedientes/${caseId}`);
          return { ok: true, mensaje: 'Borrador generado. Actualizá la página para verlo.' };
        }
        if (industryBorrador === 'legal') {
          return { ok: false, mensaje: 'La redacción automática desde el Agente IA no está habilitada para Jurídico. Usá Modelos de escritos para preparar el borrador.' };
        }
        return { ok: false, mensaje: 'La industria no está habilitada para esta acción.' };
    }
    case 'redactar_aviso': {
      if (!canUseAi(profile.role)) return { ok: false, mensaje: 'Sin permiso para usar la IA.' };
      await redactarAvisoExpediente(caseId);
      revalidatePath(`/expedientes/${caseId}`);
      return { ok: true, mensaje: 'Aviso comercial generado. Actualizá la página para verlo.' };
    }
    case 'calificar_inquilino': {
      if (!canUseAi(profile.role)) return { ok: false, mensaje: 'Sin permiso para usar la IA.' };
      const fd = new FormData();
      fd.append('caseId', caseId);
      if (accion.alquilerMensual != null) fd.append('alquiler', String(accion.alquilerMensual));
      if (accion.moneda) fd.append('moneda', accion.moneda);
      await calificarInquilinoExpediente(fd);
      return { ok: true, mensaje: 'Pre-Score de inquilino generado. Actualizá la página para verlo.' };
    }
    case 'analizar_uif': {
      if (!canUseAi(profile.role)) return { ok: false, mensaje: 'Sin permiso para usar la IA.' };
      await analizarUifExpediente(caseId);
      revalidatePath(`/expedientes/${caseId}`);
      return { ok: true, mensaje: 'Análisis UIF generado. Actualizá la página para verlo.' };
    }

    case 'redactar_ros': {
      if (!canUseAi(profile.role)) return { ok: false, mensaje: 'Sin permiso para usar la IA.' };
      await analizarUifExpediente(caseId);
      revalidatePath(`/expedientes/${caseId}`);
      return {
        ok: true,
        mensaje: 'Análisis UIF actualizado. Ya podés descargar el "Borrador de ROS (PDF)" desde el panel 🛡️ Análisis UIF del legajo (actualizá la página si no lo ves).',
      };
    }

    case 'vincular_documento': {
      if (!canUpdateCase(profile.role)) return { ok: false, mensaje: 'Sin permiso para editar el checklist.' };
      const tituloItem = typeof accion.itemChecklist === 'string' ? accion.itemChecklist.trim().toLowerCase() : '';
      const nombreDoc = typeof accion.documento === 'string' ? accion.documento.trim().toLowerCase() : '';
      if (!tituloItem || !nombreDoc) return { ok: false, mensaje: 'Faltan datos para vincular (ítem o documento).' };

      // 1) Documento del legajo por nombre exacto (o que lo contenga).
      const { data: docsVinc } = await supabase
        .from('documents')
        .select('id, file_name')
        .eq('case_id', caseId)
        .eq('organization_id', profile.organization_id);
      const doc =
        (docsVinc ?? []).find((d) => (d.file_name ?? '').trim().toLowerCase() === nombreDoc) ??
        (docsVinc ?? []).find((d) => (d.file_name ?? '').trim().toLowerCase().includes(nombreDoc));
      if (!doc) return { ok: false, mensaje: 'No encontré ese documento en el legajo.' };

      // 2) Ítem del checklist por título exacto (preferí uno sin documento).
      const { data: checklistsVinc } = await supabase
        .from('checklists')
        .select('id')
        .eq('case_id', caseId)
        .eq('organization_id', profile.organization_id);
      const checklistIdsVinc = (checklistsVinc ?? []).map((c) => c.id);
      if (checklistIdsVinc.length === 0) return { ok: false, mensaje: 'El legajo no tiene checklist.' };
      const { data: itemsVinc } = await supabase
        .from('checklist_items')
        .select('id, title, document_id')
        .in('checklist_id', checklistIdsVinc);
      const candidatos = (itemsVinc ?? []).filter(
        (it) => (it.title ?? '').trim().toLowerCase() === tituloItem
      );
      const item =
        candidatos.find((it) => !it.document_id) ??
        candidatos[0] ??
        (itemsVinc ?? []).find((it) => (it.title ?? '').trim().toLowerCase().includes(tituloItem));
      if (!item) return { ok: false, mensaje: 'No encontré ese ítem en el checklist.' };

      // 3) Vincular
      const { error } = await supabase
        .from('checklist_items')
        .update({ document_id: doc.id, status: 'received' })
        .eq('id', item.id);
      if (error) {
        console.error('Agente vincular_documento error:', error);
        return { ok: false, mensaje: 'No se pudo vincular el documento.' };
      }
      revalidatePath(`/expedientes/${caseId}`);
      return { ok: true, mensaje: `Documento vinculado a "${item.title}".` };
    }

    case 'cambiar_estado': {
      if (!canUpdateCase(profile.role)) return { ok: false, mensaje: 'Sin permiso para cambiar el estado.' };
      const estado = typeof accion.estado === 'string' ? accion.estado.trim() : '';
      if (!estado) return { ok: false, mensaje: 'La acción no indica un estado destino.' };
      const { data: org } = await supabase
        .from('organizations')
        .select('industry_type')
        .eq('id', profile.organization_id)
        .maybeSingle();
      const industry = normalizeIndustryType(org?.industry_type);
      if (!getAllowedCaseStatuses(industry).includes(estado)) {
        return { ok: false, mensaje: 'El estado propuesto no es válido para este rubro.' };
      }
      const { error } = await supabase
        .from('cases')
        .update({ status: estado })
        .eq('id', caseId)
        .eq('organization_id', profile.organization_id);
      if (error) {
        console.error('Agente cambiar_estado error:', error);
        return { ok: false, mensaje: 'No se pudo cambiar el estado.' };
      }
      revalidatePath(`/expedientes/${caseId}`);
      return { ok: true, mensaje: 'Estado del legajo actualizado.' };
    }
    default:
      return { ok: false, mensaje: 'Acción no reconocida.' };
  }
}

// --- Diagnóstico proactivo del legajo (sin IA, solo datos) ---
export async function diagnosticoLegajo(
	{ caseId }: { caseId: string }
): Promise<{ ok: boolean; alertas: string[] }> {
	try {
		// Usá EXACTAMENTE el mismo patrón de auth/organización que ya usa
		// `preguntarAgente` en este archivo (getUserProfile → orgId + rol).
		const { user, profile } = await getUserProfile();
		const orgId = profile?.organization_id;
		if (!orgId || !profile?.role || !isUserRole(profile.role)) return { ok: false, alertas: [] };

		const supabase = await createClient();
		const alertas: string[] = [];

		const hoy = new Date();
		const en30 = new Date();
		en30.setDate(hoy.getDate() + 30);
		const hoyStr = hoy.toISOString().slice(0, 10);
		const en30Str = en30.toISOString().slice(0, 10);

		// 1) Documentos y cuáles están analizados
		const { data: docs } = await supabase
			.from('documents')
			.select('id, expires_at')
			.eq('case_id', caseId)
			.eq('organization_id', orgId);

		const { data: analisis } = await supabase
			.from('ai_outputs')
			.select('document_id')
			.eq('case_id', caseId)
			.eq('organization_id', orgId)
			.eq('output_type', 'document_analysis');

		const analizados = new Set(
			(analisis ?? []).map((a) => a.document_id).filter(Boolean)
		);
		const totalDocs = docs?.length ?? 0;
		const sinAnalizar = (docs ?? []).filter((d) => !analizados.has(d.id)).length;

		if (totalDocs === 0) {
			alertas.push('Todavía no hay documentos cargados en el legajo.');
		} else if (sinAnalizar > 0) {
			alertas.push(`${sinAnalizar} de ${totalDocs} documento(s) sin analizar con IA.`);
		}

		// 2) Documentos vencidos o por vencer (30 días)
		const vencidos = (docs ?? []).filter((d) => d.expires_at && d.expires_at < hoyStr).length;
		const porVencer = (docs ?? []).filter(
			(d) => d.expires_at && d.expires_at >= hoyStr && d.expires_at <= en30Str
		).length;
		if (vencidos > 0) alertas.push(`${vencidos} documento(s) con vigencia vencida.`);
		if (porVencer > 0) alertas.push(`${porVencer} documento(s) por vencer en los próximos 30 días.`);

		// 3) Plazos agendados próximos (30 días)
		const { data: plazos } = await supabase
			.from('agenda_plazos')
			.select('titulo, fecha')
			.eq('case_id', caseId)
			.eq('organization_id', orgId)
			.gte('fecha', hoyStr)
			.lte('fecha', en30Str)
			.order('fecha', { ascending: true });

		if (plazos && plazos.length > 0) {
			const p = plazos[0];
			alertas.push(
				`Próximo plazo: "${p.titulo}" el ${p.fecha}${plazos.length > 1 ? ` (+${plazos.length - 1} más)` : ''}.`
			);
		}

		// 4) Checklist pendiente
		const { data: checklists } = await supabase
			.from('checklists')
			.select('id')
			.eq('case_id', caseId)
			.eq('organization_id', orgId);

		const checklistIds = (checklists ?? []).map((c) => c.id);
		if (checklistIds.length > 0) {
			const { data: items } = await supabase
				.from('checklist_items')
				.select('status')
				.in('checklist_id', checklistIds);
			const total = items?.length ?? 0;
			// NOTA: si tus estados de checklist usan otros valores, alineá esta
			// condición con la MISMA lógica de "Sugeridos X/Y" del listado de legajos.
			const pendientes = (items ?? []).filter(
				(i) => !['received', 'reviewed', 'not_required'].includes(i.status)
			).length;
			if (total > 0 && pendientes > 0) {
				alertas.push(`Checklist: ${pendientes} de ${total} ítems pendientes.`);
			}
		}

		return { ok: true, alertas };
	} catch {
		return { ok: false, alertas: [] };
	}
}

export async function ejecutarAccionAgente(input: {
  caseId: string;
  accion: AccionPropuesta;
}): Promise<{ ok: boolean; mensaje: string }> {
  const result = await ejecutarAccionAgenteInner(input);
  if (result.ok) {
    const { user, profile } = await getUserProfile();
    if (user && profile) {
      await createAuditLog({
        organizationId: profile.organization_id,
        userId: user.id,
        action: 'agent_action_approved' as any,
        resourceType: 'case',
        resourceId: input.caseId,
        metadata: { action_tipo: input.accion.tipo, title: input.accion.titulo },
      });
    }
  }
  return result;
}
