import Link from 'next/link';
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
} from '@/lib/industries/documentTypes';
import { AiDisclaimer } from '@/lib/industries/disclaimers';
import { getIndustryTerms } from '@/lib/industries/uiLabels';
import { summarizeChecklistStatuses } from '@/lib/checklist/progress';
import { getDocumentExpiryStatus, expiryStatusLabel, getExpiryBadgeStyles, getDaysUntilExpiry } from '@/lib/documents/expiry';
import { sensitivityLabel } from '@/lib/documents/sensitivity';
import { formatPlazoDate } from '@/lib/format/date';
import { esPlazoAccionable } from '@/lib/plazos/plazos';
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
  archiveCase,
  unarchiveCase,
  deleteCase,
  vincularPropiedadOperacion,
  autoMarcarChecklist,
} from '../actions';
import { canUseAi, canArchiveCase, canDeleteCase, canUpdateCase } from '@/lib/permissions/roles';
import { getPropertyStatusLabel, getPropertyTypeLabel } from '@/lib/properties/labels';
import { FormSubmitButton } from '@/components/ui/FormSubmitButton';
import { WhatsAppIntentBuilder } from '@/components/WhatsAppIntentBuilder';
import { generateOperationMessage } from '@/lib/whatsapp';
import { MapPin } from 'lucide-react';
import { DeleteCaseButton } from './DeleteCaseButton';
import { CopilotoExpediente } from './CopilotoExpediente';
import { AgenteChat } from './AgenteChat';
import { BotonAlChecklist } from './BotonAlChecklist';
import { CotejoExpediente } from './CotejoExpediente';
import { RedactarEscrituraButton } from './RedactarEscrituraButton';
import { AnalizarUifButton } from './AnalizarUifButton';
import { CalificarInquilinoButton } from './CalificarInquilinoButton';
import { RosDraftButton } from './RosDraftButton';
import type { AnalisisUIF } from '@/lib/ai/uif';
import type { PreScoreInquilino } from '@/lib/ai/preScore';
import { CronologiaExpediente } from './CronologiaExpediente';
import { DerivarEscribania } from './DerivarEscribania';
import { RadarPlazos } from './RadarPlazos';
import { Tabs } from '@/components/ui/Tabs';
import { Badge } from '@/components/ui/Badge';
import { MotionCard } from '@/components/ui/MotionCard';
import { MotionButton } from '@/components/ui/MotionButton';
import type { CaseRecord } from '@/types/case';
import { EliminarDocumentoButton } from './EliminarDocumentoButton';
import { PreguntarDocumentos } from './PreguntarDocumentos';
import { RedactarBorradorButton } from './RedactarBorradorButton';

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

const CASE_EVENT_TYPE_LABELS: Record<string,string> = {
  escrito: 'Escrito / Presentación',
  audiencia: 'Audiencia',
  notificacion: 'Notificación / Cédula',
  resolucion: 'Resolución / Sentencia',
  prueba: 'Prueba / Pericia',
  otro: 'Otro movimiento',
};

function getEventTypeBadgeColor(type: string): "warning" | "success" | "accent" | "neutral" {
  const tones: Record<string, "warning" | "success" | "accent" | "neutral"> = {
    escrito: 'neutral',
    audiencia: 'warning',
    notificacion: 'accent',
    resolucion: 'success',
    prueba: 'accent',
    otro: 'neutral',
  };
  return tones[type] || 'neutral';
}

const darkOptionStyle = { backgroundColor: '#0C2340', color: '#FFFFFF' };

function modeloSugeridoPorTipoLegajo(caseType?: string | null): string | null {
  const t = (caseType ?? '').toLowerCase();
  if (t.includes('compraventa') || t.includes('escritura') || t.includes('real_estate') || t.includes('purchase')) return 'notarial-compraventa-inmueble';
  if (t.includes('poder')) return 'notarial-poder-general-amplio';
  if (t.includes('certificaci')) return 'notarial-certificacion-firmas';
  if (t.includes('acta')) return 'notarial-acta-constatacion';
  if (t.includes('autorizaci') || t.includes('viaje')) return 'notarial-autorizacion-viaje-menor';
  return null;
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

function checklistStatusLabel(status: string) {
  const labels: Record<string, string> = {
    pending: 'Pendiente',
    received: 'Recibido',
    reviewed: 'Revisado',
    rejected: 'Rechazado',
    not_required: 'No requerido',
  };

  return labels[status] ?? status;
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
  const visibleMetadataFields = caseFields.filter((field) =>
    getMetadataValue(caseRecord.metadata, field.key)
  );

  const { data: caseChecklist } = await supabase
    .from('checklists')
    .select('id')
    .eq('case_id', caseRecord.id)
    .eq('organization_id', profile.organization_id)
    .maybeSingle();

  let checklistItemsData: any[] = [];
  if (caseChecklist) {
    const { data, error } = await supabase
      .from('checklist_items')
      .select('id, checklist_id, title, status, document_id, notes, created_at, documents(id, file_name)')
      .eq('checklist_id', caseChecklist.id)
      .eq('organization_id', profile.organization_id)
      .order('created_at', { ascending: true })
      .order('id', { ascending: true });

    if (error) {
      console.error('Error fetching checklist items:', error);
      throw new Error('Ocurrió un error al cargar el checklist. Por favor, intente nuevamente.');
    }
    checklistItemsData = data || [];
  }

  const { data: caseDocumentsData } = await supabase
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
  const missingItems = checklistItems.filter(
    (item) => item.status === 'pending' || item.status === 'rejected'
  );

  const { data: resumenData } = await supabase
    .from('ai_outputs')
    .select('result_json, created_at')
    .eq('case_id', caseRecord.id)
    .eq('organization_id', profile.organization_id)
    .eq('output_type', 'case_summary')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

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
    origen: 'actuacion' | 'detectada' | 'documento' | 'agenda'; etiquetaOrigen: string; esFuturo: boolean;
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
      <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-400/80">
            {terms.detalleEyebrow}
          </p>

          <h2
            data-testid="case-detail-title"
            className="mt-2 font-display text-3xl font-semibold tracking-tight text-gradient"
          >
            {displayText(caseRecord.title, terms.itemSinTitulo)}
          </h2>

          <p className="mt-2 text-sm text-slate-400">
            Cliente: {displayText(caseRecord.client_name, 'Sin cliente asignado')} - Estado actual:{' '}
            {getCaseStatusLabel(caseRecord.status, industry)}
          </p>
        </div>
      </div>

      <Tabs
        initial={tabActiva}
        tabs={[
          {
            id: 'resumen',
            label: '📊 Resumen',
            content: (
              <div className="space-y-6">
                <AgenteChat caseId={caseRecord.id} caseTitle={displayText(caseRecord.title, terms.itemSinTitulo)} industry={industry} puedeUsarIA={puedeUsarIA} historialInicial={historialAgente} modeloUrl={modeloSugerido ? `/modelos?modelo=${modeloSugerido}&expediente=${caseRecord.id}` : '/modelos'} />
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
                  {industry === 'inmobiliaria' && (
                    <WhatsAppIntentBuilder
                      phone={(caseRecord.metadata as any)?.phone || (caseRecord.metadata as any)?.telefono || null}
                      context="operation"
                      resourceId={caseRecord.id}
                      defaultMessage={generateOperationMessage(caseRecord)}
                    />
                  )}
                {industry === 'legal' && liquidacion && (
                  <section className="mt-6 rounded-2xl border border-cyan-500/20 bg-slate-900/40 p-6">
                    <div className="mb-4 flex items-center gap-2">
                      <span className="text-xl">💰</span>
                      <h2 className="text-lg font-semibold text-cyan-300">Liquidación estimada</h2>
                    </div>
                    <p className="mb-4 text-sm text-slate-400">
                      Estimación orientativa calculada por el Agente IA a partir de los datos del expediente. No constituye una certeza legal definitiva.
                    </p>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div className="rounded-xl bg-slate-800/60 p-4">
                        <p className="text-xs uppercase tracking-wide text-slate-400">Capital estimado</p>
                        <p className="text-2xl font-bold text-cyan-300">
                          {new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(liquidacion.capital)}
                        </p>
                      </div>
                      <div className="rounded-xl bg-slate-800/60 p-4">
                        <p className="text-xs uppercase tracking-wide text-slate-400">Método</p>
                        <p className="text-lg font-semibold text-violet-300">
                          {liquidacion.metodo === 'vuoto' ? 'Vuoto' : 'Méndez'}
                        </p>
                      </div>
                      <div className="rounded-xl bg-slate-800/60 p-4">
                        <p className="text-xs uppercase tracking-wide text-slate-400">Años computables</p>
                        <p className="text-lg font-semibold text-slate-100">{liquidacion.anios_computables}</p>
                      </div>
                      <div className="rounded-xl bg-slate-800/60 p-4">
                        <p className="text-xs uppercase tracking-wide text-slate-400">Art. 730 y Honorarios</p>
                        <p className="text-sm font-semibold text-slate-400 mt-2">
                          El límite de responsabilidad (art. 730 CCyCN) y los honorarios no están calculados automáticamente.
                        </p>
                      </div>
                      <div className="rounded-xl bg-slate-800/60 p-4 sm:col-span-2 ring-1 ring-amber-500/30">
                        <p className="text-xs uppercase tracking-wide text-amber-400">Intereses no calculados</p>
                        <p className="text-lg font-semibold text-slate-100 mt-1">
                          {new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(liquidacion.capital)} <span className="text-sm font-normal text-slate-400">(Solo capital base)</span>
                        </p>
                        <p className="mt-2 text-xs text-slate-400">
                          {liquidacion.intereses_motivo || 'Intereses históricos no calculados. Los valores de intereses guardados por versiones anteriores no se muestran porque no cuentan con una serie histórica y un criterio jurisdiccional verificados.'}
                        </p>
                      </div>
                    </div>
                    <p className="mt-4 text-xs text-slate-500">
                      Base de cálculo: ingreso mensual {new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(liquidacion.ingreso_mensual)} · edad {liquidacion.edad} · incapacidad {liquidacion.incapacidad}% · tasa de descuento {(liquidacion.tasa_descuento * 100).toFixed(0)}%
                    </p>
                  </section>
                )}
                {industry === 'legal' && plazo && (
                  <section className="mt-6 rounded-2xl border border-cyan-500/20 bg-slate-900/40 p-6">
                    <div className="mb-4 flex items-center gap-2">
                      <span className="text-xl">📅</span>
                      <h2 className="text-lg font-semibold text-cyan-300">Vencimiento procesal</h2>
                    </div>
                    <p className="mb-2 text-sm font-medium text-slate-300">{plazo.titulo}</p>
                    <p className="mb-4 text-sm text-slate-500">
                      Cómputo orientativo sobre el calendario de la Justicia Nacional/Federal (fines de semana, feriados y feria judicial). Verificá los feriados provinciales que correspondan.
                    </p>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div className="rounded-xl bg-slate-800/60 p-4">
                        <p className="text-xs uppercase tracking-wide text-slate-400">Vence el</p>
                        <p className="text-2xl font-bold text-cyan-300">
                          {plazo.vencimiento.split('-').reverse().join('/')}
                        </p>
                      </div>
                      <div className="rounded-xl bg-slate-800/60 p-4">
                        <p className="text-xs uppercase tracking-wide text-slate-400">Notificación</p>
                        <p className="text-lg font-semibold text-violet-300">
                          {plazo.fecha_notificacion.split('-').reverse().join('/')}
                        </p>
                      </div>
                      <div className="rounded-xl bg-slate-800/60 p-4">
                        <p className="text-xs uppercase tracking-wide text-slate-400">Empieza a correr</p>
                        <p className="text-lg font-semibold text-slate-100">
                          {plazo.cuenta_desde.split('-').reverse().join('/')}
                        </p>
                      </div>
                      <div className="rounded-xl bg-slate-800/60 p-4">
                        <p className="text-xs uppercase tracking-wide text-slate-400">Plazo legal</p>
                        <p className="text-lg font-semibold text-slate-100">
                          {plazo.dias_habiles} días hábiles
                        </p>
                      </div>
                      {plazo.dias_ampliacion > 0 && (
                        <div className="rounded-xl bg-slate-800/60 p-4">
                          <p className="text-xs uppercase tracking-wide text-slate-400">Ampliación (art. 158)</p>
                          <p className="text-lg font-semibold text-amber-300">
                            +{plazo.dias_ampliacion} día(s) por {plazo.km_distancia} km
                          </p>
                        </div>
                      )}
                    </div>
                    <div className="mt-4">
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Cómo se calculó</p>
                      <ul className="list-disc pl-5 text-xs text-slate-500 space-y-1">
                        {plazo.pasos.map((paso, i) => (
                          <li key={i}>{paso}</li>
                        ))}
                      </ul>
                    </div>
                  </section>
                )}
                {industry === 'legal' && tasaJusticia && (
                  <section className="mt-6 rounded-2xl border border-cyan-500/20 bg-slate-900/40 p-6">
                    <div className="mb-4 flex items-center gap-2">
                      <span className="text-xl">🏛️</span>
                      <h2 className="text-lg font-semibold text-cyan-300">Tasa de justicia</h2>
                    </div>
                    <p className="mb-4 text-sm text-slate-400">{tasaJusticia.titulo}</p>
                    <p className="mb-4 text-sm text-slate-500">
                      Estimación orientativa de la tasa de justicia (Ley 23.898). Se abona al iniciar la demanda. Verificá exenciones, mínimos y la alícuota vigente en la jurisdicción.
                    </p>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div className="rounded-xl bg-slate-800/60 p-4">
                        <p className="text-xs uppercase tracking-wide text-slate-400">Tasa a abonar</p>
                        <p className="text-2xl font-bold text-cyan-300">
                          {new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(tasaJusticia.tasa)}
                        </p>
                      </div>
                      <div className="rounded-xl bg-slate-800/60 p-4">
                        <p className="text-xs uppercase tracking-wide text-slate-400">Monto del proceso</p>
                        <p className="text-lg font-semibold text-violet-300">
                          {new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(tasaJusticia.base)}
                        </p>
                      </div>
                      <div className="rounded-xl bg-slate-800/60 p-4">
                        <p className="text-xs uppercase tracking-wide text-slate-400">Alícuota</p>
                        <p className="text-lg font-semibold text-slate-100">
                          {tasaJusticia.porcentaje}%
                        </p>
                      </div>
                    </div>
                  </section>
                )}
                {(industry === 'escribania' || industry === 'legal' || industry === 'inmobiliaria') && (
                  <CotejoExpediente
                    caseId={caseRecord.id}
                    industry={industry}
                    cotejo={(cotejoData?.result_json as any) ?? null}
                    generadoEl={cotejoData?.created_at ?? null}
                    documentosAnalizados={documentosAnalizados}
                    puedeUsarIA={puedeUsarIA}
                  />
                )}

                {industry === 'escribania' && (
                  <section className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="text-sm font-semibold text-white">✍️ Borrador de escritura (IA)</h3>
                      {documentosAnalizados > 0 ? (
                        <RedactarEscrituraButton caseId={caseRecord.id} yaGenerada={!!borradorEscritura} />
                      ) : (
                        <span className="text-xs text-white/40">Analizá al menos 1 documento para habilitarlo</span>
                      )}
                    </div>
                    {borradorEscritura ? (
                      <div className="mt-4 space-y-3">
                        <p className="text-xs uppercase tracking-wide text-white/40">{borradorEscritura.titulo}</p>
                        <pre className="whitespace-pre-wrap rounded-lg bg-black/30 p-4 text-sm leading-relaxed text-white/80">{borradorEscritura.cuerpo}</pre>
                        {borradorEscritura.datos_faltantes.length > 0 && (
                          <div>
                            <p className="text-xs font-medium text-amber-300">Datos a completar</p>
                            <ul className="mt-1 list-disc pl-5 text-sm text-white/70">
                              {borradorEscritura.datos_faltantes.map((d, i) => <li key={i}>{d}</li>)}
                            </ul>
                          </div>
                        )}
                        {borradorEscritura.advertencias.length > 0 && (
                          <div>
                            <p className="text-xs font-medium text-red-300">Advertencias</p>
                            <ul className="mt-1 list-disc pl-5 text-sm text-white/70">
                              {borradorEscritura.advertencias.map((a, i) => <li key={i}>{a}</li>)}
                            </ul>
                          </div>
                        )}
                        <AiDisclaimer industry={industry} className="mt-4" />
                        <p className="text-xs text-white/40">Borrador generado por IA. Revisalo y completalo antes de otorgar.</p>
                      </div>
                    ) : (
                      <p className="mt-3 text-sm text-white/50">
                        Generá un borrador de escritura a partir de los documentos analizados del legajo.
                        {documentosAnalizados === 0 && ' Primero analizá al menos un documento con IA.'}
                      </p>
                    )}
                  </section>
                )}
                {industry === 'escribania' && (
                  <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="flex items-center gap-2 text-sm font-semibold text-white">🛡️ Análisis UIF / PLA (IA)</h3>
                      <div className="flex flex-wrap items-center gap-2">
                        {analisisUif && (
                          <RosDraftButton
                            analisis={analisisUif}
                            legajo={{
                              titulo: caseRecord.title || '',
                              comparecientes: (caseRecord.metadata?.comparecientes as string) || caseRecord.client_name || '',
                              tipoActo: (caseRecord.metadata?.tipo_acto as string) || caseRecord.case_type || '',
                              fecha: (caseRecord.metadata?.fecha_otorgamiento as string) || '',
                              resumen: '',
                            }}
                          />
                        )}
                        <AnalizarUifButton caseId={caseRecord.id} yaGenerada={!!analisisUif} />
                      </div>
                    </div>
                    {analisisUif ? (
                      <div className="mt-4 space-y-4">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-semibold ${
                            analisisUif.nivel_riesgo === 'alto' ? 'bg-rose-500/15 text-rose-300'
                            : analisisUif.nivel_riesgo === 'medio' ? 'bg-amber-500/15 text-amber-300'
                            : 'bg-emerald-500/15 text-emerald-300'}`}>
                            Riesgo {analisisUif.nivel_riesgo.toUpperCase()}
                          </span>
                          {analisisUif.requiere_ros && (
                            <span className="rounded-full bg-rose-500/20 px-3 py-1 text-xs font-semibold text-rose-200">Evaluar ROS</span>
                          )}
                        </div>
                        {analisisUif.fundamento && <p className="text-sm text-white/70">{analisisUif.fundamento}</p>}
                        {analisisUif.factores_riesgo.length > 0 && (
                          <div>
                            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-white/40">Factores de riesgo</p>
                            <ul className="list-disc space-y-1 pl-5 text-sm text-white/70">
                              {analisisUif.factores_riesgo.map((f, i) => <li key={i}>{f}</li>)}
                            </ul>
                          </div>
                        )}
                        {analisisUif.senales_alerta.length > 0 && (
                          <div>
                            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-rose-300/70">Señales de alerta</p>
                            <ul className="list-disc space-y-1 pl-5 text-sm text-rose-200/80">
                              {analisisUif.senales_alerta.map((s, i) => <li key={i}>{s}</li>)}
                            </ul>
                          </div>
                        )}
                        {analisisUif.verificaciones_pendientes.length > 0 && (
                          <div>
                            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-white/40">Verificaciones pendientes</p>
                            <ul className="list-disc space-y-1 pl-5 text-sm text-white/70">
                              {analisisUif.verificaciones_pendientes.map((v, i) => <li key={i}>{v}</li>)}
                            </ul>
                          </div>
                        )}
                        <AiDisclaimer industry={industry} className="mt-4" />
                      </div>
                    ) : (
                      <p className="mt-3 text-sm text-white/50">Generá un análisis de riesgo PLA/FT del legajo con IA.</p>
                    )}
                  </div>
                )}
                {industry === 'inmobiliaria' && (
                  <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <h3 className="flex items-center gap-2 text-sm font-semibold text-white">✨ Pre-Score de Inquilino y Garantía</h3>
                      <CalificarInquilinoButton caseId={caseRecord.id} yaGenerada={!!prescore} />
                    </div>
                    {prescore ? (
                      <div className="mt-4 space-y-4">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${
                            prescore.nivel_calificacion === 'apto' ? 'bg-emerald-500/15 text-emerald-300'
                            : prescore.nivel_calificacion === 'condicional' ? 'bg-amber-500/15 text-amber-300'
                            : prescore.nivel_calificacion === 'no_apto' ? 'bg-rose-500/15 text-rose-300'
                            : prescore.nivel_calificacion === 'indeterminado' ? 'bg-orange-500/15 text-orange-300 border border-orange-500/20'
                            : 'bg-slate-500/15 text-slate-300'
                          }`}>
                            {prescore.nivel_calificacion === 'apto' ? 'Apto'
                            : prescore.nivel_calificacion === 'condicional' ? 'Condicional'
                            : prescore.nivel_calificacion === 'no_apto' ? 'No apto'
                            : prescore.nivel_calificacion === 'indeterminado' ? 'Revisión Manual (Disparidad de Moneda)'
                            : 'Información insuficiente'}
                          </span>
                          {prescore.veces_alquiler != null && (
                            <span className="rounded-full bg-white/5 px-3 py-1 text-xs font-semibold text-white/70">
                              Cobertura: {prescore.veces_alquiler}× el alquiler
                            </span>
                          )}
                        </div>
                        <div className="text-sm text-white/70">
                          <p>
                            <span className="font-medium text-white">Ingreso estimado:</span> {
                              prescore.ingreso_neto_mensual_estimado 
                                ? new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(prescore.ingreso_neto_mensual_estimado)
                                : 'No se pudo estimar'
                            }
                          </p>
                          <p className="mt-1 text-xs text-white/40">Regla aplicada: {prescore.regla_recomendada}</p>
                        </div>
                        {prescore.fundamento && <p className="text-sm text-white/70">{prescore.fundamento}</p>}
                        
                        {prescore.garantias.length > 0 && (
                          <div>
                            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-white/40">Garantías detectadas</p>
                            <ul className="list-disc space-y-1 pl-5 text-sm text-white/70">
                              {prescore.garantias.map((g, i) => <li key={i}>{g}</li>)}
                            </ul>
                          </div>
                        )}
                        {prescore.gravamenes_detectados.length > 0 && (
                          <div>
                            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-amber-300/70">Gravámenes sobre garantía</p>
                            <ul className="list-disc space-y-1 pl-5 text-sm text-amber-200/80">
                              {prescore.gravamenes_detectados.map((g, i) => <li key={i}>{g}</li>)}
                            </ul>
                          </div>
                        )}
                        {prescore.senales_alerta.length > 0 && (
                          <div>
                            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-rose-300/70">Señales de alerta</p>
                            <ul className="list-disc space-y-1 pl-5 text-sm text-rose-200/80">
                              {prescore.senales_alerta.map((s, i) => <li key={i}>{s}</li>)}
                            </ul>
                          </div>
                        )}
                        {prescore.verificaciones_pendientes.length > 0 && (
                          <div>
                            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-white/40">Verificaciones pendientes</p>
                            <ul className="list-disc space-y-1 pl-5 text-sm text-white/70">
                              {prescore.verificaciones_pendientes.map((v, i) => <li key={i}>{v}</li>)}
                            </ul>
                          </div>
                        )}
                        <AiDisclaimer industry="inmobiliaria" className="mt-4" />
                      </div>
                    ) : (
                      <p className="mt-3 text-sm text-white/50">Evaluá la solvencia del inquilino y solidez de garantías con IA.</p>
                    )}
                  </div>
                )}
                <RadarPlazos
                  items={cronologia}
                  caseId={caseRecord.id}
                  titulo={terms.radarTitulo}
                  subtitulo={terms.radarSubtitulo}
                />
                {industry === 'escribania' && (
                  <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                      <div>
                        <h3 className="flex items-center gap-2 text-sm font-semibold text-white">
                          ✒️ Redactar documento notarial
                        </h3>
                        <p className="mt-1 text-sm text-slate-400">
                          Abrí el modelo sugerido para este legajo y completá los datos, o elegí otro de la biblioteca.
                        </p>
                      </div>
                      <Link
                        href={modeloSugerido ? `/modelos?modelo=${modeloSugerido}` : '/modelos'}
                        className="shrink-0 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90"
                      >
                        {modeloSugerido ? 'Redactar con el modelo sugerido' : 'Ir a Modelos'}
                      </Link>
                    </div>
                  </div>
                )}

                {industry === 'inmobiliaria' && (
                  <MotionCard index={0} className="mb-6">
                    <h3 className="font-display text-lg font-semibold text-white flex items-center gap-2">
                      🏘️ Propiedad asociada
                    </h3>
                    <div className="mt-4">
                      {propertyRecord ? (
                        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
                          <div className="flex items-start justify-between">
                            <div>
                              <h4 className="text-lg font-bold text-white">{propertyRecord.name}</h4>
                              <p className="mt-1 text-sm text-slate-400 flex items-center gap-1">
                                <MapPin className="h-4 w-4" /> {propertyRecord.address || 'Sin dirección'}
                              </p>
                              <div className="mt-3 flex gap-2">
                                <Badge tone={propertyRecord.status === 'disponible' ? 'success' : propertyRecord.status === 'reservada' ? 'warning' : 'neutral'}>
                                  {getPropertyStatusLabel(propertyRecord.status)}
                                </Badge>
                                <span className="rounded-full bg-white/5 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-slate-400">
                                  {getPropertyTypeLabel(propertyRecord.property_type)}
                                </span>
                              </div>
                            </div>
                            <Link href={`/propiedades/${propertyRecord.id}`} className="shrink-0 rounded-xl bg-cyan-500/10 px-4 py-2 text-sm font-bold text-cyan-400 transition hover:bg-cyan-500/20">
                              Ver ficha
                            </Link>
                          </div>
                        </div>
                      ) : (
                        <p className="text-sm text-slate-400">Sin propiedad asociada.</p>
                      )}

                      {canUpdateCase(profile.role) && (
                        <form action={vincularPropiedadOperacion} className="mt-4 border-t border-white/10 pt-4">
                          <input type="hidden" name="case_id" value={caseRecord.id} />
                          <div className="flex flex-col sm:flex-row gap-3">
                            <select
                              name="property_id"
                              defaultValue={propertyRecord?.id || ''}
                              className="flex-1 rounded-xl border border-white/10 bg-[#0C2340] px-4 py-2.5 text-sm text-white outline-none focus:ring-2 focus:ring-cyan-400"
                            >
                              <option value="">Sin propiedad asociada (desvincular)</option>
                              {allProperties.map(p => (
                                <option key={p.id} value={p.id}>
                                  {p.name} {p.address ? `— ${p.address}` : ''}
                                </option>
                              ))}
                            </select>
                            <FormSubmitButton label="Guardar propiedad" loadingLabel="Guardando..." />
                          </div>
                        </form>
                      )}
                    </div>
                  </MotionCard>
                )}

                {industry === 'inmobiliaria' && (
                  <div className="mb-6 rounded-3xl border border-white/10 bg-white/[0.02] p-6">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h2 className="text-lg font-semibold text-white">✍️ Borrador de reserva/boleto con IA</h2>
                        <p className="mt-1 text-sm text-slate-400">
                          Redacta un borrador orientativo del documento basándose en la información de la operación.
                        </p>
                      </div>
                      {canUseAi(profile.role) && (
                        <RedactarBorradorButton caseId={caseRecord.id} yaGenerado={!!borradorInmoData} />
                      )}
                    </div>

                    {borradorInmoData && (
                      <div className="mt-6 space-y-4 border-t border-white/5 pt-6">
                        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                          <p className="text-sm font-semibold text-white">{borradorInmoData.titulo}</p>
                          <div className="mt-2 whitespace-pre-wrap text-sm text-slate-300 font-mono bg-[#0A1830] p-4 rounded-xl border border-white/5 max-h-96 overflow-y-auto">
                            {borradorInmoData.cuerpo}
                          </div>
                        </div>

                        {(borradorInmoData.datos_faltantes.length > 0 || borradorInmoData.advertencias.length > 0) && (
                          <div className="grid gap-4 sm:grid-cols-2">
                            {borradorInmoData.datos_faltantes.length > 0 && (
                              <div className="rounded-2xl border border-amber-400/25 bg-amber-400/[0.06] p-4">
                                <p className="text-sm font-semibold text-white">📋 Datos a completar</p>
                                <ul className="mt-2 space-y-1">
                                  {borradorInmoData.datos_faltantes.map((it, i) => (
                                    <li key={i} className="text-sm text-slate-300">• {it}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                            {borradorInmoData.advertencias.length > 0 && (
                              <div className="rounded-2xl border border-rose-400/25 bg-rose-400/[0.06] p-4">
                                <p className="text-sm font-semibold text-white">⚠️ Advertencias</p>
                                <ul className="mt-2 space-y-1">
                                  {borradorInmoData.advertencias.map((it, i) => (
                                    <li key={i} className="text-sm text-slate-300">• {it}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
                
                {industry === 'inmobiliaria' && avisoComercial && (
                  <div className="mb-6 rounded-2xl border border-cyan-500/20 bg-slate-900/40 p-5">
                    <div className="mb-3 flex items-center gap-2">
                      <span className="text-lg">📢</span>
                      <h3 className="text-sm font-semibold text-slate-100">Aviso comercial (IA)</h3>
                    </div>
                    <p className="text-sm font-medium text-cyan-300">{avisoComercial.titulo}</p>
                    <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-slate-200">{avisoComercial.aviso}</p>
                    {avisoComercial.destacados.length > 0 && (
                      <div className="mt-3">
                        <p className="text-xs font-semibold text-slate-400">Destacados</p>
                        <ul className="mt-1 list-disc pl-5 text-sm text-slate-200">
                          {avisoComercial.destacados.map((d, i) => <li key={i}>{d}</li>)}
                        </ul>
                      </div>
                    )}
                    {avisoComercial.hashtags.length > 0 && (
                      <p className="mt-3 text-xs text-cyan-400">
                        {avisoComercial.hashtags.map((h) => `#${h}`).join(' ')}
                      </p>
                    )}
                    {avisoComercial.datos_faltantes.length > 0 && (
                      <div className="mt-3">
                        <p className="text-xs font-semibold text-amber-400">Datos a sumar</p>
                        <ul className="mt-1 list-disc pl-5 text-sm text-amber-200/80">
                          {avisoComercial.datos_faltantes.map((d, i) => <li key={i}>{d}</li>)}
                        </ul>
                      </div>
                    )}
                    <p className="mt-3 text-xs text-slate-500">Aviso generado por IA a partir de los datos de la operación. Revisalo antes de publicar.</p>
                  </div>
                )}

                {industry === 'inmobiliaria' && <DerivarEscribania caseId={caseRecord.id} />}

                <MotionCard index={industry === 'inmobiliaria' ? 1 : 0}>
          <h3 className="font-display text-lg font-semibold text-white">
            {terms.datosTitulo}
          </h3>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Tipo
              </p>

              <p className="mt-2 font-bold text-white">
                {getCaseTypeLabel(caseRecord.case_type)}
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Estado
              </p>

              <p className="mt-2 font-bold text-white">
                {getCaseStatusLabel(caseRecord.status, industry)}
              </p>
            </div>

            {visibleMetadataFields.map((field) => {
              const value = getMetadataValue(caseRecord.metadata, field.key);
              if (field.key === 'fecha_relevante' && value) {
                const status = getDocumentExpiryStatus(value);
                const days = getDaysUntilExpiry(value) ?? 0;
                return (
                  <div key={field.key} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      {field.label}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <p className="font-bold text-white">
                        {formatPlazoDate(value)}
                      </p>
                      <Badge tone={status === 'vencido' ? 'danger' : status === 'por_vencer' ? 'warning' : 'neutral'}>
                        {expiryStatusLabel(status)}
                      </Badge>
                      <span className="text-xs font-medium text-slate-500">
                        {days >= 0 ? `(faltan ${days} días)` : `(vencido hace ${Math.abs(days)} días)`}
                      </span>
                    </div>
                  </div>
                );
              }
              return (
                <div key={field.key} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {field.label}
                  </p>
                  <p className="mt-2 font-bold text-white">
                    {value}
                  </p>
                </div>
              );
            })}
          </div>

          <details open={visibleMetadataFields.length === 0} className="mt-6 group">
            <summary className="list-none cursor-pointer text-sm font-bold text-sky-600 hover:text-sky-700 flex items-center gap-2 select-none outline-none">
              <span>✏️ {terms.editarDatos}</span>
              <span className="transition-transform group-open:rotate-90">▸</span>
            </summary>
            <form action={updateCaseStatus} className="mt-4 grid gap-4">
              <input type="hidden" name="case_id" value={caseRecord.id} />

              <div>
                <label className="text-sm font-semibold text-slate-400">
                  Estado
                </label>
                <select
                  name="status"
                  defaultValue={caseRecord.status}
                  className="mt-2 w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-white placeholder:text-slate-500 outline-none focus:ring-2 focus:ring-sky-400"
                >
                  {statusOptions.map((status) => (
                    <option
                      key={status.value}
                      value={status.value}
                      className="bg-[#0C2340] text-white"
                      style={darkOptionStyle}
                    >
                      {status.label}
                    </option>
                  ))}
                </select>
              </div>

              {caseFields.length > 0 ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  {caseFields.map((field) => (
                    <div key={field.key}>
                      <label className="text-sm font-semibold text-slate-400">
                        {field.label}
                      </label>

                      {field.type === 'select' ? (
                        <select
                          name={`case_metadata.${field.key}`}
                          defaultValue={getMetadataValue(caseRecord.metadata, field.key)}
                          className="mt-2 w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-white placeholder:text-slate-500 outline-none focus:ring-2 focus:ring-sky-400"
                        >
                          <option
                            value=""
                            className="bg-[#0C2340] text-white"
                            style={darkOptionStyle}
                          >
                            Sin definir
                          </option>
                          {(field.options ?? []).map((option) => (
                            <option
                              key={option}
                              value={option}
                              className="bg-[#0C2340] text-white"
                              style={darkOptionStyle}
                            >
                              {option}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input
                          name={`case_metadata.${field.key}`}
                          type={field.type}
                          defaultValue={getMetadataValue(caseRecord.metadata, field.key)}
                          className="mt-2 w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-white placeholder:text-slate-500 outline-none focus:ring-2 focus:ring-sky-400"
                        />
                      )}
                    </div>
                  ))}
                </div>
              ) : null}

              <button className="rounded-2xl bg-slate-900 px-5 py-3 text-sm font-bold text-white transition-all hover:bg-slate-800">
                {terms.actualizarCta}
              </button>
              </form>
          </details>
        </MotionCard>
              </div>
            )
          },
          {
            id: 'documentos',
            label: '📄 Documentos',
            content: (
              <MotionCard index={0}>
                <div className="mb-6">
                  <PreguntarDocumentos caseId={caseRecord.id} puedeUsarIA={puedeUsarIA} />
                </div>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-lg font-bold text-white">
                  {terms.docsTitulo}
                </h3>

                <p className="mt-1 text-sm text-slate-400">
                  {terms.docsSubtitulo}
                </p>
              </div>

              <Link
                href={`/documentos/subir?case=${caseRecord.id}`}
                className="rounded-2xl bg-sky-500 px-5 py-3 text-sm font-bold text-white hover:bg-sky-600"
              >
                Subir documento
              </Link>
            </div>

            {caseDocuments.length > 0 ? (
              <div className="mt-5 space-y-3">
                {caseDocuments.map((document) => (
                  <div
                    key={document.id}
                    className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-white">
                        {document.file_name}
                      </p>
                      <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                        {getDocumentTypeLabel(document.document_type)}
                      </p>
                    </div>

                    <div className="flex shrink-0 items-center gap-3">
                      {document.contributed_by_organization_id && (
                        <span className="rounded-full border border-cyan-400/30 bg-cyan-500/10 px-2 py-0.5 text-xs text-cyan-200">
                          Aportado por {document.contributed_by_name || 'la escribanía'}
                        </span>
                      )}
                      <Badge tone={sensitivityLabel(document.sensitivity_level) === 'Crítico' || sensitivityLabel(document.sensitivity_level) === 'Alto' ? 'danger' : 'neutral'}>
                        {sensitivityLabel(document.sensitivity_level)}
                      </Badge>
                      <Link
                        href={`/documentos/${document.id}`}
                        className="text-sm font-bold text-accent-soft hover:text-white"
                      >
                        Ver documento
                      </Link>
                      <EliminarDocumentoButton documentId={document.id} caseId={caseRecord.id} fileName={document.file_name} />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-5 rounded-2xl border border-dashed border-white/10 bg-white/[0.04] p-5 text-sm text-slate-400">
                {terms.docsVacio}
              </div>
            )}

            {observacionesEscribania.length > 0 && (
              <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-6">
                <h3 className="text-lg font-semibold text-white">Observaciones de la escribanía</h3>
                <p className="mt-1 text-sm text-slate-400">
                  Notas que dejó la escribanía sobre este legajo.
                </p>
                <ul className="mt-4 space-y-3">
                  {observacionesEscribania.map((o) => (
                    <li key={o.id} className="rounded-xl border border-white/10 bg-white/5 p-4">
                      <p className="text-sm text-white whitespace-pre-wrap">{o.body}</p>
                      <p className="mt-2 text-xs text-slate-400">
                        {o.author_org_name ?? 'Escribanía'} · {new Date(o.created_at).toLocaleString('es-AR')}
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </MotionCard>
            )
          },
          {
            id: 'cronologia',
            label: '🕑 Cronología',
            content: (
              <div className="space-y-6">
                <CronologiaExpediente items={cronologia} />
                <MotionCard index={0}>
            <h3 className="font-display text-lg font-semibold text-white">Línea de tiempo del expediente</h3>
            <p className="mt-1 text-sm text-slate-400">Registro cronológico de actuaciones, audiencias y movimientos.</p>
            
            <form action={async (formData: FormData) => {
              'use server';
              await createCaseEvent({
                caseId: caseRecord.id,
                eventDate: String(formData.get('eventDate')),
                eventType: String(formData.get('eventType')),
                title: String(formData.get('title')),
                description: String(formData.get('description') || '')
              });
            }} className="mt-5 grid gap-4 rounded-2xl border border-white/10 bg-white/[0.04] p-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Fecha</label>
                  <input type="date" name="eventDate" required className="mt-1 w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-white placeholder:text-slate-500 outline-none focus:ring-2 focus:ring-sky-400" />
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Tipo</label>
                  <select name="eventType" defaultValue="otro" className="mt-1 w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-white placeholder:text-slate-500 outline-none focus:ring-2 focus:ring-sky-400">
                    {Object.entries(CASE_EVENT_TYPE_LABELS).map(([val, label]) => (
                      <option key={val} value={val} style={darkOptionStyle} className="bg-[#0C2340] text-white">{label}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Título</label>
                <input type="text" name="title" required placeholder="Ej: Se presentó la demanda" className="mt-1 w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-white placeholder:text-slate-500 outline-none focus:ring-2 focus:ring-sky-400" />
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Descripción (opcional)</label>
                <textarea name="description" rows={2} className="mt-1 w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-white placeholder:text-slate-500 outline-none focus:ring-2 focus:ring-sky-400" />
              </div>
              <button type="submit" className="justify-self-start rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white hover:bg-slate-800 transition-all">
                Agregar actuación
              </button>
            </form>

            <div className="mt-6 space-y-4 border-l-2 border-white/10 pl-4">
              {eventos.length === 0 ? (
                <div className="text-sm text-slate-400">Todavía no hay actuaciones registradas en este expediente.</div>
              ) : (
                eventos.map((item) => (
                  <div key={item.id} className="relative mb-6 last:mb-0">
                    <span className="absolute -left-[23px] top-1 flex h-3 w-3 items-center justify-center rounded-full bg-slate-300 ring-4 ring-[#0a1830]" />
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-bold text-slate-400">{formatPlazoDate(item.event_date)}</span>
                      <Badge tone={getEventTypeBadgeColor(item.event_type)}>
                        {CASE_EVENT_TYPE_LABELS[item.event_type] || CASE_EVENT_TYPE_LABELS.otro}
                      </Badge>
                    </div>
                    <div className="mt-2 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="font-bold text-white">{item.title}</p>
                          {item.description && <p className="mt-1 text-sm text-slate-400">{item.description}</p>}
                        </div>
                        <form action={async () => {
                          'use server';
                          await deleteCaseEvent({ eventId: item.id, caseId: caseRecord.id });
                        }}>
                          <button type="submit" className="text-xs font-bold text-rose-500 hover:text-rose-400 transition-colors">Eliminar</button>
                        </form>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </MotionCard>
              </div>
            )
          },
          {
            id: 'checklist',
            label: '✅ Checklist',
            content: (
          <MotionCard index={0}>
            <h3 className="font-display text-lg font-semibold text-white">
              Checklist documental
            </h3>
            <p className="mt-1 text-sm text-slate-400">
              Lista sugerida. Marcá lo que no aplica o agregá lo que necesites.
            </p>

            {checklistItems.length === 0 && (
              <p className="mt-5 text-sm text-slate-400">
                Aún no hay ítems en este checklist.
              </p>
            )}

            {checklistItems.length > 0 ? (
              <>
                <div className="mt-5 rounded-2xl bg-[#0C2340] p-5 text-white shadow-sm">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-bold">
                      {checklistProgress.isComplete ? (
                        <span className="flex items-center gap-2 text-[#22C55E]">
                          ✓ Documentación completa
                        </span>
                      ) : (
                        <span>
                          <span className="text-slate-600">{checklistProgress.total - checklistProgress.missing}</span> de {checklistProgress.total} documentos sugeridos
                        </span>
                      )}
                    </p>
                    <div className="flex items-center gap-4">
                      {checklistItems.length > 0 && (
                        <form action={autoMarcarChecklist}>
                          <input type="hidden" name="case_id" value={caseRecord.id} />
                          <button
                            type="submit"
                            className="rounded-lg bg-gradient-to-r from-cyan-500 to-violet-500 px-3 py-1.5 text-sm font-medium text-white transition hover:opacity-90"
                          >
                            ✨ Detectar documentos ya cargados
                          </button>
                        </form>
                      )}
                      <span className="text-sm font-bold text-[#C2CCD9]">{checklistProgress.percent}%</span>
                    </div>
                  </div>
                  
                  <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-700/50">
                    <div
                      className="h-full bg-[#22C55E] transition-all duration-500"
                      style={{ width: `${checklistProgress.percent}%` }}
                    />
                  </div>

                  {!checklistProgress.isComplete && missingItems.length > 0 && (
                    <div className="mt-4 border-t border-slate-700/50 pt-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-[#C2CCD9]">
                        Sugeridos sin cargar:
                      </p>
                      <ul className="mt-3 space-y-2">
                        {missingItems.map((item) => (
                          <li key={`missing-${item.id}`} className="text-sm flex items-start gap-2">
                            <span className="text-[#F59E0B] mt-0.5 font-bold">!</span>
                            <span className="text-white">{item.title}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                <div className="mt-5 space-y-3">
                  {checklistItems.map((item, idx) => {
                    const isDone = item.status === 'received' || item.status === 'reviewed';
                    const isMissing = item.status === 'pending' || item.status === 'rejected';
                    const isNotRequired = item.status === 'not_required';

                    return (
                      <div key={item.id} className={`space-y-3 ${isNotRequired ? 'opacity-60' : ''}`}>
                      <div className={`flex items-center gap-3 rounded-2xl border p-3 transition-colors ${
                          isMissing
                            ? 'border-[#F59E0B] bg-white/[0.04]'
                            : isNotRequired
                            ? 'border-white/10 bg-white/[0.02]'
                            : 'border-white/10 bg-white/[0.05]'
                        }`}>
                        
                        {!isNotRequired ? (
                          <form action={toggleChecklistItem} className="shrink-0">
                            <input type="hidden" name="case_id" value={caseRecord.id} />
                            <input type="hidden" name="item_id" value={item.id} />
                            <input type="hidden" name="current_status" value={item.status} />
                            <button
                              type="submit"
                              data-testid={`checklist-toggle-${idx}`}
                              aria-label={isDone ? 'Marcar como pendiente' : 'Marcar como recibido'}
                              className={`flex h-5 w-5 items-center justify-center rounded-md border text-xs font-bold ${
                                isDone
                                  ? 'border-sky-500 bg-sky-500 text-white'
                                  : 'border-white/20 bg-white/[0.02] text-transparent'
                              }`}
                            >
                              ✓
                            </button>
                          </form>
                        ) : (
                          <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md border border-white/10 bg-white/[0.02] text-xs text-transparent">✓</div>
                        )}

                        <div className="min-w-0 flex-1">
                          <p
                            className={`text-sm font-semibold ${
                              isDone || isNotRequired
                                ? 'text-slate-500 line-through'
                                : 'text-white'
                            }`}
                          >
                            {item.title}
                          </p>
                          <div className="mt-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                            <Badge tone={isDone ? 'success' : isNotRequired ? 'neutral' : 'warning'}>{checklistStatusLabel(item.status)}</Badge>
                            <span>•</span>
                            <form action={toggleChecklistItemNotRequired} className="inline-block">
                              <input type="hidden" name="case_id" value={caseRecord.id} />
                              <input type="hidden" name="item_id" value={item.id} />
                              <input type="hidden" name="current_status" value={item.status} />
                              <button type="submit" className="text-slate-500 hover:text-slate-700 underline decoration-slate-300 underline-offset-2">
                                {isNotRequired ? 'Restaurar' : 'No aplica'}
                              </button>
                            </form>
                            <span>•</span>
                            <form action={removeChecklistItem} className="inline-block">
                              <input type="hidden" name="case_id" value={caseRecord.id} />
                              <input type="hidden" name="item_id" value={item.id} />
                              <button type="submit" className="text-rose-400 hover:text-rose-600 underline decoration-rose-200 underline-offset-2">
                                Quitar
                              </button>
                            </form>
                          </div>
                        </div>
                      </div>

                    {item.documents && !isNotRequired ? (
                      <p className="rounded-xl bg-sky-50 px-3 py-2 text-xs font-semibold text-sky-700">
                        Vinculado: {item.documents.file_name}
                      </p>
                    ) : null}

                    {!isNotRequired && (
                      <details className="group">
                        <summary className="list-none cursor-pointer text-xs font-semibold uppercase tracking-wide text-slate-400 hover:text-slate-600 select-none outline-none">
                          Vincular documento
                        </summary>
                        <form
                          action={linkChecklistItemDocument}
                          className="mt-2 rounded-2xl border border-slate-200 bg-white p-3"
                        >
                          <input type="hidden" name="case_id" value={caseRecord.id} />
                          <input type="hidden" name="item_id" value={item.id} />

                          <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                            <select
                              name="document_id"
                              defaultValue={item.document_id ?? ''}
                              className="w-full rounded-xl border border-slate-200 bg-[#0C2340] px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-sky-400"
                            >
                              <option
                                value=""
                                className="bg-[#0C2340] text-white"
                                style={darkOptionStyle}
                              >
                                -- sin vincular --
                              </option>
                              {availableDocuments.map((document) => (
                                <option
                                  key={document.id}
                                  value={document.id}
                                  className="bg-[#0C2340] text-white"
                                  style={darkOptionStyle}
                                >
                                  {document.file_name}
                                </option>
                              ))}
                            </select>

                            <button className="rounded-xl border border-white/10 px-3 py-2 text-sm font-bold text-slate-300 hover:border-sky-400 hover:text-sky-400">
                              Guardar
                            </button>
                          </div>
                        </form>
                      </details>
                    )}
                    </div>
                  );
                })}
              </div>
            </>
            ) : null}
            <form action={addChecklistItem} className="mt-5 flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] p-2">
              <input type="hidden" name="case_id" value={caseRecord.id} />
              <input 
                type="text" 
                name="title" 
                placeholder="Agregar documento al checklist…" 
                required
                className="min-w-0 flex-1 bg-transparent px-3 py-2 text-sm text-white outline-none placeholder:text-slate-500"
              />
              <button className="shrink-0 rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white transition-all hover:bg-slate-800">
                Agregar
              </button>
            </form>
          </MotionCard>
            )
          }
        ]}
      />

      {/* Zona de administración */}
      {(canArchiveCase(profile.role) || canDeleteCase(profile.role)) && (
        <div className="mt-12 rounded-3xl border border-rose-500/10 bg-rose-500/5 p-6">
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-widest text-rose-400">
            Zona de administración
          </h3>
          <div className="flex flex-wrap items-center gap-4">
            {canArchiveCase(profile.role) && (
              caseRecord.status !== 'archived' ? (
                <form action={archiveCase}>
                  <input type="hidden" name="case_id" value={caseRecord.id} />
                  <button type="submit" className="rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-2 text-sm font-bold text-white transition-all hover:bg-white/10">
                    Archivar operación
                  </button>
                </form>
              ) : (
                <form action={unarchiveCase}>
                  <input type="hidden" name="case_id" value={caseRecord.id} />
                  <button type="submit" className="rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-2 text-sm font-bold text-white transition-all hover:bg-white/10">
                    Desarchivar
                  </button>
                </form>
              )
            )}
            
            {canDeleteCase(profile.role) && (
              <form action={deleteCase}>
                <input type="hidden" name="case_id" value={caseRecord.id} />
                <DeleteCaseButton />
              </form>
            )}
          </div>
        </div>
      )}
    </AppShell>
  );
}
