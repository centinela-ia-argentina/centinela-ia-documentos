import { CaseDocumentsPanel } from './CaseDocumentsPanel';
import { CaseIndustryTools } from './CaseIndustryTools';
import Link from 'next/link';
import { SquaresFour, FileText as FileTextIcon, ClockCounterClockwise, ListChecks } from '@phosphor-icons/react/dist/ssr';
import { CaseDetailHeader } from '@/components/records/CaseDetailHeader';
import { CaseAdministration } from '@/components/records/CaseAdministration';
import { CaseFacts } from '@/components/records/CaseFacts';
import { LinkedProperty } from '@/components/records/LinkedProperty';
import { notFound, redirect } from 'next/navigation';
import { AppShell } from '@/components/layout/AppShell';
import { createClient } from '@/lib/supabase/server';
import { getUserProfile } from '@/lib/auth/getUserProfile';
import {
  getCaseFields,
  getCaseStatuses,
  getCaseStatusLabel,
  getCaseTypeLabel,
} from '@/lib/industries/caseConfig';
import {
  getDocumentTypeLabel,
  normalizeIndustryType,
  getDocumentTypes,
} from '@/lib/industries/documentTypes';
import { sugerirModeloNotarialPorTipo } from '@/lib/legal/modelos';
import { getIndustryTerms } from '@/lib/industries/uiLabels';
import { sanitizeTextoInmobiliario } from '@/lib/format/sanitizerInmobiliaria';
import { summarizeChecklistStatuses } from '@/lib/checklist/progress';
import { getDocumentExpiryStatus, expiryStatusLabel, getExpiryBadgeStyles } from '@/lib/documents/expiry';
import { sensitivityLabel } from '@/lib/documents/sensitivity';
import { formatPlazoDate } from '@/lib/format/date';
import { esPlazoAccionable } from '@/lib/plazos/plazos';
import { extraerFechasOperativasLegajo } from '@/lib/plazos/fechasCanonicas';
import {
  linkChecklistItemDocument,
  toggleChecklistItem,
  updateCaseStatus,
  toggleChecklistItemNotRequired,
  addChecklistItem,
  removeChecklistItem,
  createCaseEvent,
  deleteCaseEvent,
  generarResumenExpediente,
  vincularPropiedadOperacion,
  autoMarcarChecklist,
} from '../actions';
import { canUseAi, canUpdateCase } from '@/lib/permissions/roles';
import { WhatsAppIntentBuilder } from '@/components/WhatsAppIntentBuilder';
import { generateOperationMessage } from '@/lib/whatsapp';
import { CopilotoExpediente } from './CopilotoExpediente';
import { AgenteChat } from './AgenteChat';
import { CaseAgentDisclosure } from '@/components/approved/CaseAgentDisclosure';
import { CaseSummaryLayout } from '@/components/approved/CaseSummaryLayout';
import { BotonAlChecklist } from './BotonAlChecklist';
import type { AnalisisUIF } from '@/lib/ai/uif';
import type { PreScoreInquilino } from '@/lib/ai/preScore';
import { CronologiaExpediente } from './CronologiaExpediente';
import { DerivarEscribania } from './DerivarEscribania';
import { RadarPlazos } from './RadarPlazos';
import { CaseChecklistPanel } from './CaseChecklistPanel';
import { Tabs } from '@/components/ui/Tabs';
import { Badge } from '@/components/ui/Badge';
import { MotionCard } from '@/components/ui/MotionCard';
import { MotionButton } from '@/components/ui/MotionButton';
import type { CaseRecord } from '@/types/case';

interface CaseDetailPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

type ChecklistItemRecord = {
  id: string;
  checklist_id: string;
  title: string;
  status: string;
  document_id: string | null;
  match_source?: 'manual' | 'automatic' | null;
  notes: string | null;
  created_at: string;
  documents: {
    id: string;
    file_name: string;
  } | null;
  checklists: {
    case_id: string;
    organization_id: string;
  };
};

type CaseDocumentRecord = {
  id: string;
  file_name: string;
  document_type: string | null;
  sensitivity_level: string | null;
  created_at: string;
  contributed_by_organization_id: string | null;
  contributed_by_name: string | null;
};

type ChecklistDocumentOptionRecord = {
  id: string;
  file_name: string;
  case_id: string | null;
  created_at: string;
};

type CaseEventRecord = {
  id: string;
  event_date: string;
  event_type: string;
  title: string;
  description: string | null;
  created_by: string | null;
};

const INMOBILIARIA_EVENT_TYPES: Record<string, string> = {
  visita: 'Visita al inmueble',
  reserva_oferta: 'Reserva / Oferta',
  documentacion: 'Documentación / Solicitud',
  negociacion: 'Negociación de condiciones',
  firma: 'Firma de instrumento',
  ajuste: 'Ajuste de canon / precio',
  vencimiento: 'Vencimiento contractual',
  otro: 'Otro movimiento',
};

const CASE_EVENT_TYPE_LABELS: Record<string,string> = {
  escrito: 'Escrito / Presentación',
  audiencia: 'Audiencia',
  notificacion: 'Notificación / Cédula',
  resolucion: 'Resolución / Sentencia',
  prueba: 'Prueba / Pericia',
  visita: 'Visita al inmueble',
  reserva_oferta: 'Reserva / Oferta',
  documentacion: 'Documentación / Solicitud',
  negociacion: 'Negociación de condiciones',
  firma: 'Firma de instrumento',
  ajuste: 'Ajuste de canon / precio',
  vencimiento: 'Vencimiento contractual',
  otro: 'Otro movimiento',
};



function modeloSugeridoPorTipoLegajo(caseType?: string | null): string | null {
  return sugerirModeloNotarialPorTipo(caseType)?.id ?? null;
}

// Escrito judicial sugerido para un legajo del rubro legal.
// Los modelos ya existen en @/lib/legal/modelos (contesta-demanda,
// interpone-apelacion, cedula-notificacion, etc.). Si no hay una
// coincidencia clara, devolvemos 'contesta-demanda' como punto de partida:
// en la biblioteca están todos los escritos para elegir el que corresponda.
function modeloLegalSugeridoPorTipoLegajo(caseType?: string | null): string {
  const t = (caseType ?? '').toLowerCase();
  if (t.includes('apela') || t.includes('recurso')) return 'interpone-apelacion';
  if (t.includes('cédula') || t.includes('cedula') || t.includes('notific') || t.includes('oficio')) return 'cedula-notificacion';
  return 'contesta-demanda';
}

function displayText(value?: string | null, fallback = 'Sin definir') {
  const cleanValue = value?.trim();

  if (!cleanValue) return fallback;

  return cleanValue;
}

function getMetadataValue(metadata: CaseRecord['metadata'], key: string) {
  const value = metadata?.[key];
  return typeof value === 'string' ? value : '';
}

export default async function CaseDetailPage({ params, searchParams }: CaseDetailPageProps) {
  const { id } = await params;
  const sp = await searchParams;
  const tabActiva = typeof sp.tab === 'string' ? sp.tab : undefined;
  const { user, profile } = await getUserProfile();

  if (!user) redirect('/login');
  if (!profile) redirect('/onboarding');

  const supabase = await createClient();

  const { data } = await supabase
    .from('cases')
    .select('*')
    .eq('id', id)
    .eq('organization_id', profile.organization_id)
    .single();

  if (!data) notFound();

  const caseRecord = data as CaseRecord;

  const { data: organization } = await supabase
    .from('organizations')
    .select('industry_type')
    .eq('id', profile.organization_id)
    .maybeSingle();

  const industry = normalizeIndustryType(organization?.industry_type);
  const textoTipoLegajo = [
    caseRecord.case_type,
    getCaseTypeLabel(caseRecord.case_type),
    caseRecord.title,
  ]
    .filter(Boolean)
    .join(' ');
  const modeloSugerido =
    industry === 'escribania'
      ? modeloSugeridoPorTipoLegajo(textoTipoLegajo)
      : industry === 'legal'
        ? modeloLegalSugeridoPorTipoLegajo(textoTipoLegajo)
        : null;
  const terms = getIndustryTerms(industry);
  const caseFields = getCaseFields(industry);
  const caseStatuses = getCaseStatuses(industry);
  const statusValues = caseStatuses.map((status) => status.value);
  const statusOptions = statusValues.includes(caseRecord.status)
    ? caseStatuses
    : [
        { value: caseRecord.status, label: getCaseStatusLabel(caseRecord.status, industry) },
        ...caseStatuses,
      ];
  const visibleMetadataFields = caseFields.filter((field) => {
    if (industry === 'inmobiliaria' && field.key === 'moneda_operacion') {
      return true;
    }
    return Boolean(getMetadataValue(caseRecord.metadata, field.key));
  });

  const { data: caseChecklist } = await supabase
    .from('checklists')
    .select('id')
    .eq('case_id', caseRecord.id)
    .eq('organization_id', profile.organization_id)
    .maybeSingle();

  let checklistItemsData: any[] = [];
  if (caseChecklist) {
    let { data, error } = await supabase
      .from('checklist_items')
      .select('id, checklist_id, title, status, document_id, match_source, notes, created_at, documents(id, file_name)')
      .eq('checklist_id', caseChecklist.id)
      .eq('organization_id', profile.organization_id)
      .order('created_at', { ascending: true })
      .order('id', { ascending: true });

    if (error && (error.code === '42703' || error.message?.includes('match_source') || error.details?.includes('match_source'))) {
      const fallbackRes = await supabase
        .from('checklist_items')
        .select('id, checklist_id, title, status, document_id, notes, created_at, documents(id, file_name)')
        .eq('checklist_id', caseChecklist.id)
        .eq('organization_id', profile.organization_id)
        .order('created_at', { ascending: true })
        .order('id', { ascending: true });
      data = (fallbackRes.data ?? []).map((item: any) => ({ ...item, match_source: null }));
      error = fallbackRes.error;
    }

    if (error) {
      console.error('Error fetching checklist items:', error);
      throw new Error('Ocurrió un error al cargar el checklist. Por favor, intente nuevamente.');
    }
    checklistItemsData = data || [];
  }

  const { data: caseDocumentsData, error: caseDocumentsError } = await supabase
    .from('documents')
    .select('id, file_name, document_type, sensitivity_level, created_at, contributed_by_organization_id, contributed_by_name')
    .eq('case_id', caseRecord.id)
    .eq('organization_id', profile.organization_id)
    .order('created_at', { ascending: false });

  const { data: observacionesData } = await supabase
    .from('derivation_notes')
    .select('id, body, author_org_name, created_at')
    .eq('case_id', caseRecord.id)
    .order('created_at', { ascending: true });
  const observacionesEscribania = observacionesData ?? [];

  const { data: availableDocumentsData } = await supabase
    .from('documents')
    .select('id, file_name, case_id, created_at')
    .eq('organization_id', profile.organization_id)
    .eq('case_id', caseRecord.id)
    .order('created_at', { ascending: false });

  const { data: caseEventsData } = await supabase
    .from('case_events')
    .select('id, event_date, event_type, title, description, created_by')
    .eq('case_id', caseRecord.id)
    .order('event_date', { ascending: false })
    .order('created_at', { ascending: false });

  const { data: agendaData } = await supabase
    .from('agenda_plazos')
    .select('id, titulo, fecha, detalle, categoria')
    .eq('organization_id', profile.organization_id)
    .eq('case_id', caseRecord.id);

  const checklistItems = (checklistItemsData ?? []) as unknown as ChecklistItemRecord[];
  const caseDocuments = (caseDocumentsData ?? []) as CaseDocumentRecord[];
  const availableDocuments = (availableDocumentsData ??
    []) as ChecklistDocumentOptionRecord[];
  const eventos = (caseEventsData ?? []) as CaseEventRecord[];

  let propertyRecord: any = null;
  let allProperties: any[] = [];
  
  if (industry === 'inmobiliaria') {
    if (caseRecord.property_id) {
      const { data } = await supabase
        .from('properties')
        .select('id, name, address, status, property_type')
        .eq('id', caseRecord.property_id)
        .eq('organization_id', profile.organization_id)
        .single();
      propertyRecord = data;
    }

    const { data: allPropsData } = await supabase
      .from('properties')
      .select('id, name, address')
      .eq('organization_id', profile.organization_id)
      .is('archived_at', null)
      .order('created_at', { ascending: false });
    allProperties = allPropsData || [];
  }
    
  const checklistStatuses = checklistItems.map((item) => item.status);
  const checklistProgress = summarizeChecklistStatuses(checklistStatuses);


  const { data: rawResumenData } = await supabase
    .from('ai_outputs')
    .select('result_json, created_at')
    .eq('case_id', caseRecord.id)
    .eq('organization_id', profile.organization_id)
    .eq('output_type', 'case_summary')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const resumenData = rawResumenData ? {
    ...rawResumenData,
    result_json: industry === 'inmobiliaria' && rawResumenData.result_json ? {
      ...rawResumenData.result_json,
      resumen_general: sanitizeTextoInmobiliario(rawResumenData.result_json.resumen_general || ''),
      estado_actual: sanitizeTextoInmobiliario(rawResumenData.result_json.estado_actual || ''),
      puntos_clave: Array.isArray(rawResumenData.result_json.puntos_clave)
        ? rawResumenData.result_json.puntos_clave.map((p: string) => sanitizeTextoInmobiliario(p))
        : [],
      riesgos_alertas: Array.isArray(rawResumenData.result_json.riesgos_alertas)
        ? rawResumenData.result_json.riesgos_alertas.map((r: string) => sanitizeTextoInmobiliario(r))
        : [],
      proximas_acciones: Array.isArray(rawResumenData.result_json.proximas_acciones)
        ? rawResumenData.result_json.proximas_acciones.map((a: string) => sanitizeTextoInmobiliario(a))
        : [],
    } : rawResumenData.result_json,
  } : null;

  const { data: cotejoData } = await supabase
    .from('ai_outputs')
    .select('result_json, created_at')
    .eq('case_id', caseRecord.id)
    .eq('organization_id', profile.organization_id)
    .eq('output_type', 'case_cotejo')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: liquidacionData } = await supabase
    .from('ai_outputs')
    .select('result_json, created_at')
    .eq('case_id', caseRecord.id)
    .eq('organization_id', profile.organization_id)
    .eq('output_type', 'case_liquidacion')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const liquidacion = (liquidacionData?.result_json ?? null) as {
    metodo: string;
    ingreso_mensual: number;
    edad: number;
    incapacidad: number;
    capital: number;
    ingreso_anual_ajustado: number;
    anios_computables: number;
    tasa_descuento: number;
    tope_honorarios_730: number;
    intereses?: number;
    intereses_dias?: number;
    intereses_tasa_anual?: number;
    intereses_desde?: string;
    total_con_intereses?: number;
    intereses_estado?: string;
    intereses_motivo?: string;
  } | null;

  const { data: plazoData } = await supabase
    .from('ai_outputs')
    .select('result_json, created_at')
    .eq('case_id', caseRecord.id)
    .eq('organization_id', profile.organization_id)
    .eq('output_type', 'case_plazo')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const plazo = (plazoData?.result_json ?? null) as {
    titulo: string;
    fecha_notificacion: string;
    dias_habiles: number;
    dias_ampliacion: number;
    dias_totales: number;
    km_distancia: number;
    cuenta_desde: string;
    vencimiento: string;
    pasos: string[];
  } | null;

  const { data: tasaData } = await supabase
    .from('ai_outputs')
    .select('result_json, created_at')
    .eq('case_id', caseRecord.id)
    .eq('organization_id', profile.organization_id)
    .eq('output_type', 'case_tasa_justicia')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const tasaJusticia = (tasaData?.result_json ?? null) as {
    titulo: string;
    base: number;
    porcentaje: number;
    tasa: number;
  } | null;



  const { data: escrituraData } = await supabase
    .from('ai_outputs')
    .select('content, result_json, created_at')
    .eq('case_id', caseRecord.id)
    .eq('organization_id', profile.organization_id)
    .eq('output_type', 'case_escritura')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const borradorEscritura = (escrituraData?.result_json ?? null) as
    | { titulo: string; cuerpo: string; datos_faltantes: string[]; advertencias: string[] }
    | null;

  const { data: avisoData } = await supabase
    .from('ai_outputs')
    .select('content, result_json, created_at')
    .eq('case_id', caseRecord.id)
    .eq('organization_id', profile.organization_id)
    .eq('output_type', 'case_aviso')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const avisoComercial = (avisoData?.result_json ?? null) as
    | { titulo: string; aviso: string; destacados: string[]; hashtags: string[]; datos_faltantes: string[] }
    | null;

  const { data: borradorInmoDataRaw } = await supabase
    .from('ai_outputs')
    .select('content, result_json, created_at')
    .eq('case_id', caseRecord.id)
    .eq('organization_id', profile.organization_id)
    .eq('output_type', 'case_borrador_inmo')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const borradorInmoData = (borradorInmoDataRaw?.result_json ?? null) as
    | { titulo: string; cuerpo: string; datos_faltantes: string[]; advertencias: string[] }
    | null;

  const { data: uifData } = await supabase
    .from('ai_outputs')
    .select('result_json, created_at')
    .eq('case_id', caseRecord.id)
    .eq('organization_id', profile.organization_id)
    .eq('output_type', 'case_uif')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  const analisisUif = (uifData?.result_json as AnalisisUIF | null) ?? null;

  const { data: prescoreData } = await supabase
    .from('ai_outputs')
    .select('result_json')
    .eq('case_id', caseRecord.id)
    .eq('organization_id', profile.organization_id)
    .eq('output_type', 'prescore_inquilino')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  const prescore = (prescoreData?.result_json as PreScoreInquilino | null) ?? null;

  const { data: analisisData } = await supabase
    .from('ai_outputs')
    .select('document_id, result_json, created_at')
    .eq('case_id', caseRecord.id)
    .eq('organization_id', profile.organization_id)
    .eq('output_type', 'document_analysis')
    .order('created_at', { ascending: false });

  const documentosAnalizados = new Set((analisisData ?? []).map((o) => o.document_id).filter(Boolean)).size;
  
  const extractedPartes = Array.from(new Set((analisisData ?? []).flatMap(a => (a.result_json as any)?.datos_relevantes || []).filter(s => typeof s === 'string' && (s.startsWith('Parte:') || s.includes('DNI') || s.includes('CUIT') || s.includes('CUIL'))))).join('; ');
  const extractedResumenes = (analisisData ?? []).map(a => (a.result_json as any)?.resumen).filter(Boolean).join('\n');

  const puedeUsarIA = canUseAi(profile.role);

  // Memoria de conversación del Agente IA en este legajo (historial persistido).
  const { data: agentMessagesData } = await supabase
    .from('agent_messages')
    .select('role, content')
    .eq('case_id', caseRecord.id)
    .eq('organization_id', profile.organization_id)
    .order('created_at', { ascending: true });
  const historialAgente = (agentMessagesData ?? []).map((m) => ({
    rol: m.role === 'assistant' ? ('model' as const) : ('user' as const),
    texto: m.content as string,
  }));

  const nombrePorDoc = new Map<string, string>();
  for (const d of caseDocuments) nombrePorDoc.set(d.id, d.file_name);

  const hoyISO = new Date().toISOString().slice(0, 10);
  const esFuturo = (f: string) => f > hoyISO;

  const cronologia: {
    fecha: string; titulo: string; detalle?: string | null;
    origen: 'actuacion' | 'detectada' | 'documento' | 'agenda'; etiquetaOrigen: string; esFuturo: boolean; eventId?: string;
  }[] = [];

  // 1) Actuaciones (línea de tiempo manual)
  for (const ev of eventos) {
    const f = String(ev.event_date).slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(f)) continue;
    cronologia.push({
      fecha: f,
      titulo: ev.title,
      detalle: ev.description,
      origen: 'actuacion',
      eventId: ev.id,
      etiquetaOrigen: CASE_EVENT_TYPE_LABELS[ev.event_type] || 'Actuación',
      esFuturo: esFuturo(f),
    });
  }

  // 2) Fechas detectadas por la IA (último análisis por documento)
  const analisisPorDoc = new Map<string, any>();
  for (const o of analisisData ?? []) {
    if (o.document_id && !analisisPorDoc.has(o.document_id)) analisisPorDoc.set(o.document_id, o.result_json);
  }
  for (const [docId, rj] of analisisPorDoc.entries()) {
    const fechas = Array.isArray((rj as any)?.fechas_plazos) ? (rj as any).fechas_plazos : [];
    for (const fp of fechas) {
      const f = String(fp?.fecha || '').slice(0, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(f)) continue;
      if (!esPlazoAccionable(fp)) continue;
      cronologia.push({
        fecha: f,
        titulo: String(fp?.descripcion || 'Fecha detectada'),
        detalle: null,
        origen: 'detectada',
        etiquetaOrigen: `Detectada · ${nombrePorDoc.get(docId) || 'documento'}`,
        esFuturo: esFuturo(f),
      });
    }
  }

  // 2.5) Fechas operativas registradas en metadata del legajo/expediente y análisis de IA
  const aiOutputsParaFechas = [
    ...(analisisData ?? []),
    ...(resumenData ? [{ output_type: 'case_summary', result_json: resumenData.result_json, case_id: caseRecord.id, created_at: resumenData.created_at }] : []),
  ];
  const fechasMeta = extraerFechasOperativasLegajo(caseRecord, aiOutputsParaFechas, [...eventos, ...(agendaData ?? [])]);
  for (const fm of fechasMeta) {
    if (!cronologia.some((it) => it.fecha === fm.fecha && it.titulo.toLowerCase().trim() === fm.tipo.toLowerCase().trim())) {
      cronologia.push({
        fecha: fm.fecha,
        titulo: fm.tipo,
        detalle: fm.title,
        origen: 'agenda',
        etiquetaOrigen: 'Metadata del legajo',
        esFuturo: esFuturo(fm.fecha),
      });
    }
  }

  // 3) Cargas de documentos
  for (const d of caseDocuments) {
    const f = String(d.created_at).slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(f)) continue;
    cronologia.push({
      fecha: f,
      titulo: `Documento cargado: ${d.file_name}`,
      detalle: null,
      origen: 'documento',
      etiquetaOrigen: 'Documento',
      esFuturo: false,
    });
  }

  // 4) Recordatorios manuales de la Agenda ligados a este expediente
  for (const a of agendaData ?? []) {
    if ((a as { categoria?: string }).categoria !== 'manual') continue; // los 'plazo' ya vienen de su fuente original
    const f = String(a.fecha).slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(f)) continue;
    cronologia.push({
      fecha: f,
      titulo: a.titulo || 'Recordatorio',
      detalle: (a as { detalle?: string | null }).detalle ?? null,
      origen: 'agenda',
      etiquetaOrigen: 'Agenda',
      esFuturo: esFuturo(f),
    });
  }

  // orden cronológico ascendente (más antiguo → más nuevo)
  cronologia.sort((a, b) => (a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : 0));

  return (
    <AppShell>
      <CaseDetailHeader
        title={caseRecord.title}
        clientName={caseRecord.client_name}
        status={caseRecord.status}
        caseType={caseRecord.case_type}
        industry={industry}
        administration={<CaseAdministration caseId={caseRecord.id} status={caseRecord.status} role={profile.role} industry={industry} />}
      />

      <Tabs
        initial={tabActiva}
        tabs={[
          {
            id: 'resumen',
            label: <><SquaresFour size={16} aria-hidden />Resumen</>,
            content: (
              <CaseSummaryLayout
                facts={<>
<CaseFacts
                  caseId={caseRecord.id} caseType={caseRecord.case_type} status={caseRecord.status}
                  industry={industry} metadata={caseRecord.metadata}
                  visibleFields={visibleMetadataFields} fields={caseFields} statusOptions={statusOptions}
                  labels={{ title: terms.datosTitulo, edit: terms.editarDatos, update: terms.actualizarCta }}
                  updateAction={updateCaseStatus}
                />
                {industry === 'inmobiliaria' && <LinkedProperty
                  caseId={caseRecord.id} property={propertyRecord} properties={allProperties}
                  canUpdate={canUpdateCase(profile.role)} linkAction={vincularPropiedadOperacion}
                />}
{industry === 'inmobiliaria' && (
                    <WhatsAppIntentBuilder
                      appearance="record"
                      phone={(caseRecord.metadata as any)?.phone || (caseRecord.metadata as any)?.telefono || null}
                      context="operation"
                      resourceId={caseRecord.id}
                      defaultMessage={generateOperationMessage(caseRecord)}
                    />
                  )}

                </>}
                summary={<>
{(industry === 'escribania' || industry === 'legal' || industry === 'inmobiliaria') && (
                    <CopilotoExpediente
                      caseId={caseRecord.id}
                      resumen={(resumenData?.result_json as any) ?? null}
                      generadoEl={resumenData?.created_at ?? null}
                      documentosAnalizados={documentosAnalizados}
                      puedeUsarIA={puedeUsarIA}
                      terms={terms}
                    />
                  )}

                </>}
                dates={
<RadarPlazos
                  items={cronologia}
                  caseId={caseRecord.id}
                  titulo={terms.radarTitulo}
                  subtitulo={terms.radarSubtitulo}
                  industry={industry}
                />
                }
                agent={<CaseAgentDisclosure key={caseRecord.id} canUseAi={puedeUsarIA}>
<AgenteChat caseId={caseRecord.id} caseTitle={displayText(caseRecord.title, terms.itemSinTitulo)} industry={industry} puedeUsarIA={puedeUsarIA} historialInicial={historialAgente} modeloUrl={modeloSugerido ? `/modelos?modelo=${modeloSugerido}&expediente=${caseRecord.id}` : '/modelos'} />
                </CaseAgentDisclosure>}
              >
<CaseIndustryTools industry={industry} caseRecord={caseRecord} profile={profile} puedeUsarIA={puedeUsarIA}
                liquidacion={liquidacion} plazo={plazo} tasaJusticia={tasaJusticia} borradorEscritura={borradorEscritura}
                avisoComercial={avisoComercial} borradorInmoData={borradorInmoData} analisisUif={analisisUif} prescore={prescore}
                cotejoData={cotejoData} documentosAnalizados={documentosAnalizados} analisisData={analisisData} resumenData={resumenData}
                extractedPartes={extractedPartes} extractedResumenes={extractedResumenes} modeloSugerido={modeloSugerido}
                derivation={<DerivarEscribania caseId={caseRecord.id} />} />
              </CaseSummaryLayout>
            )
          },
          {
            id: 'documentos',
            label: <><FileTextIcon size={16} aria-hidden />Documentos</>,
            content: (
              <CaseDocumentsPanel caseId={caseRecord.id} industry={industry} role={profile.role} puedeUsarIA={puedeUsarIA} documents={caseDocuments} notes={observacionesEscribania} documentsFailed={Boolean(caseDocumentsError)} deleteFeedback={typeof sp.docdel === 'string' ? sp.docdel : undefined} />
            )
          },
          {
            id: 'cronologia',
            label: <><ClockCounterClockwise size={16} aria-hidden />Cronología</>,
            content: (
              <CronologiaExpediente items={cronologia} titulo={`Cronología ${terms.delExpediente}`} industry={industry} manualEvents={eventos} canEdit={canUpdateCase(profile.role)} eventTypes={industry === 'inmobiliaria' ? INMOBILIARIA_EVENT_TYPES : CASE_EVENT_TYPE_LABELS}
                createAction={async (formData: FormData) => {
                  'use server';
                  await createCaseEvent({
                    caseId: caseRecord.id,
                    eventDate: String(formData.get('eventDate')),
                    eventType: String(formData.get('eventType')),
                    title: String(formData.get('title')),
                    description: String(formData.get('description') || '')
                  });
                }}
                deleteAction={async (eventId: string) => {
                  'use server';
                  await deleteCaseEvent({ eventId, caseId: caseRecord.id });
                }}
              />
            )
          },
          {
            id: 'checklist',
            label: <><ListChecks size={16} aria-hidden />Checklist</>,
            content: (
          <>
            <CaseChecklistPanel caseId={caseRecord.id} items={checklistItems} documents={availableDocuments} progress={checklistProgress} canEdit={canUpdateCase(profile.role)} feedback={typeof sp.checklist_document === 'string' ? sp.checklist_document : undefined} actions={{ toggle: toggleChecklistItem, exclude: toggleChecklistItemNotRequired, remove: removeChecklistItem, link: linkChecklistItemDocument, add: addChecklistItem, detect: autoMarcarChecklist }} />
          </>
            )
          }
        ]}
      />

    </AppShell>
  );
}
