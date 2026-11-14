import { getDocumentExpiryStatus, getDaysUntilExpiry } from '@/lib/documents/expiry';
import { summarizeChecklistStatuses } from '@/lib/checklist/progress';
import { isSensitiveDocument } from '@/lib/documents/sensitivity';
import { extraerFechasAccionablesLegajo } from '@/lib/plazos/fechasCanonicas';
import type { IndustryType } from '@/lib/industries/documentTypes';

/**
 * Modelo de datos del centro de Observaciones.
 *
 * Reglas OB-T01: una consulta fallida o sin datos no se convierte en cero ni
 * en "todo en orden": la categoría queda no disponible. El aviso de "todo en
 * orden" solo corresponde cuando todas las categorías aplicables al rubro
 * fueron consultadas con éxito y todas están en cero.
 *
 * Regla OB-T03: la antigüedad se mide en períodos completos de 24 horas
 * desde updated_at. Fechas futuras, ausentes o no interpretables no se
 * presentan como antigüedad; el resultado se señala como parcial cuando
 * existan fechas indeterminadas.
 */

export type CategoryState<T> =
  | { kind: 'ok'; total: number; items: T[] }
  | { kind: 'unknown' };

export interface ObservacionesSources {
  documents: DocumentRecord[] | null;
  aiOutputs: AiOutputRecord[] | null;
  cases: CaseRecord[] | null;
  checklistItems: ChecklistItemRecord[] | null;
  clients: ClientRecord[] | null;
  properties: PropertyRecord[] | null;
  agendaPlazos: AgendaPlazoRecord[] | null;
  industry: IndustryType | null;
}

export interface DocumentRecord {
  id: string;
  file_name: string;
  document_type?: string | null;
  sensitivity_level?: string | null;
  expires_at?: string | null;
  case_id?: string | null;
  file_mime_type?: string | null;
}

export interface AiOutputRecord {
  id: string;
  document_id?: string | null;
  output_type: string;
  case_id?: string | null;
  created_at?: string | null;
  result_json?: {
    fechas_plazos?: Array<{ fecha?: unknown; descripcion?: unknown }> | null;
  } | null;
}

export interface CaseRecord {
  id: string;
  title: string | null;
  status?: string | null;
  metadata?: Record<string, unknown> | null;
}

export interface ChecklistItemRecord {
  status?: string | null;
  checklists: { case_id: string };
}

export interface ClientRecord {
  id: string;
  name?: string | null;
  updated_at?: string | null;
}

export interface PropertyRecord {
  id: string;
  name?: string | null;
  updated_at?: string | null;
  status?: string | null;
}

export interface AgendaPlazoRecord {
  id: string;
  titulo?: string | null;
  fecha?: string | null;
  detalle?: string | null;
  categoria?: string | null;
  case_id?: string | null;
}

export interface PlazoItem {
  id: string;
  caseId: string;
  title: string;
  fecha: string;
  tipo: string;
}

export interface ReservaItem {
  id: string;
  title: string;
  fecha: string;
  tipo: 'Reserva';
}

export interface StaleItem {
  id: string;
  name: string;
  updatedAt: string | null;
  days: number | null;
}

export interface ObservacionesModel {
  /** true solo si TODAS las categorías aplicables fueron consultadas con éxito. */
  queriesComplete: boolean;
  failedDependencies: string[];
  sensibles: CategoryState<DocumentRecord>;
  vencimientos: CategoryState<DocumentRecord>;
  incompletos: CategoryState<{ id: string; title: string; total: number; fulfilled: number; hasUnknown: boolean }>;
  iaPendientes: CategoryState<DocumentRecord>;
  sinClasificar: CategoryState<DocumentRecord>;
  plazos: CategoryState<PlazoItem>;
  clientesSinSeguimiento: CategoryState<StaleItem> & { hasIndeterminate: boolean };
  propiedadesSinMovimiento: CategoryState<StaleItem> & { hasIndeterminate: boolean };
  reservasPorVencer: CategoryState<ReservaItem>;
  totalObservaciones: number | null;
}

export const CLIENT_STALE_DAYS = 15;
export const PROPERTY_STALE_DAYS = 30;
export const LIST_LIMIT = 8;

function ok<T>(items: T[]): CategoryState<T> {
  return { kind: 'ok', total: items.length, items };
}

function unknown<T>(): CategoryState<T> {
  return { kind: 'unknown' };
}

/**
 * Antigüedad en períodos completos de 24 horas. Devuelve null para fechas
 * ausentes, futuras o no interpretables (no se presentan como antigüedad).
 */
export function getStaleDays(updatedAt?: string | null, now: Date = new Date()): number | null {
  if (!updatedAt) return null;

  const date = new Date(updatedAt);
  if (Number.isNaN(date.getTime())) return null;
  if (date.getTime() > now.getTime()) return null;

  const diffMs = now.getTime() - date.getTime();
  return Math.floor(diffMs / (24 * 60 * 60 * 1000));
}

/** Categoría de inactividad: cuenta solo antigüedades interpretables; señala indeterminadas. */
export function staleCategory<T extends { updated_at?: string | null; id: string; name?: string | null }>(
  records: T[],
  thresholdDays: number,
  now: Date,
  filter?: (record: T) => boolean
): CategoryState<StaleItem> & { hasIndeterminate: boolean } {
  const items: StaleItem[] = [];
  let hasIndeterminate = false;

  for (const record of records) {
    if (filter && !filter(record)) continue;

    const days = getStaleDays(record.updated_at, now);

    if (days === null) {
      hasIndeterminate = true;
      continue;
    }

    if (days > thresholdDays) {
      items.push({ id: record.id, name: record.name ?? '', updatedAt: record.updated_at ?? null, days });
    }
  }

  items.sort((a, b) => (a.days ?? 0) - (b.days ?? 0));

  return { kind: 'ok', total: items.length, items: items.slice(0, LIST_LIMIT), hasIndeterminate };
}

function collectPlazos(
  cases: CaseRecord[],
  documents: DocumentRecord[],
  aiOutputs: AiOutputRecord[],
  agendaPlazos: AgendaPlazoRecord[],
  now: Date,
  fallbackTitle: string
): PlazoItem[] {
  const docCaseMap = new Map<string, string>();
  for (const d of documents) {
    if (d.case_id) docCaseMap.set(d.id, d.case_id);
  }

  const caseTitleMap = new Map(cases.map((c) => [c.id, c.title || fallbackTitle]));

  const sortedAiOutputs = [...aiOutputs].sort(
    (a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
  );

  const aiOutputsByCase = new Map<string, AiOutputRecord[]>();
  const seenDocByCase = new Map<string, Set<string>>();

  for (let idx = 0; idx < sortedAiOutputs.length; idx++) {
    const output = sortedAiOutputs[idx];
    const caseId = output.case_id || (output.document_id ? docCaseMap.get(String(output.document_id)) : null);
    if (!caseId) continue;

    if (!aiOutputsByCase.has(caseId)) {
      aiOutputsByCase.set(caseId, []);
      seenDocByCase.set(caseId, new Set());
    }
    const docKey = output.document_id ? String(output.document_id) : `out-${output.id || idx}`;
    const seen = seenDocByCase.get(caseId)!;
    if (!seen.has(docKey)) {
      seen.add(docKey);
      aiOutputsByCase.get(caseId)!.push(output);
    }
  }

  const agendaEventsByCase = new Map<string, AgendaPlazoRecord[]>();
  for (const a of agendaPlazos) {
    if (a.case_id) {
      if (!agendaEventsByCase.has(a.case_id)) agendaEventsByCase.set(a.case_id, []);
      agendaEventsByCase.get(a.case_id)!.push(a);
    }
  }

  const plazos: PlazoItem[] = [];
  const seen = new Set<string>();

  for (const c of cases) {
    const outputs = aiOutputsByCase.get(c.id) || [];
    const agendaParaCaso = agendaEventsByCase.get(c.id) || [];
    const fechas = extraerFechasAccionablesLegajo(c, outputs, agendaParaCaso);

    for (const f of fechas) {
      const status = getDocumentExpiryStatus(String(f.fecha));
      if (status !== 'por_vencer' && status !== 'vencido') continue;

      const dedupKey = `${c.id}-${f.fecha}-${f.tipo}`;
      if (seen.has(dedupKey)) continue;
      seen.add(dedupKey);

      plazos.push({
        id: f.id || `${c.id}-${f.fecha}`,
        caseId: c.id,
        title: caseTitleMap.get(c.id) ?? fallbackTitle,
        fecha: String(f.fecha),
        tipo: String(f.tipo),
      });
    }
  }

  plazos.sort((a, b) => (getDaysUntilExpiry(a.fecha, now) ?? 0) - (getDaysUntilExpiry(b.fecha, now) ?? 0));
  return plazos;
}

export function buildObservacionesModel(sources: ObservacionesSources, now: Date = new Date()): ObservacionesModel {
  const { documents, aiOutputs, cases, checklistItems, clients, properties, agendaPlazos, industry } = sources;
  const failedDependencies: string[] = [];

  const isRealEstate = industry === 'inmobiliaria';

  const sensibles = documents
    ? ok(documents.filter((doc) => isSensitiveDocument(doc.sensitivity_level)))
    : (failedDependencies.push('documentos'), unknown<DocumentRecord>());

  const vencimientos = documents
    ? ok(
        documents
          .filter((doc) => {
            if (!doc.expires_at) return false;
            const status = getDocumentExpiryStatus(doc.expires_at, now);
            return status === 'por_vencer' || status === 'vencido';
          })
          .sort((a, b) => (getDaysUntilExpiry(a.expires_at, now) ?? 0) - (getDaysUntilExpiry(b.expires_at, now) ?? 0))
      )
    : unknown<DocumentRecord>();

  let incompletos: CategoryState<{ id: string; title: string; total: number; fulfilled: number; hasUnknown: boolean }>;

  if (cases && checklistItems) {
    const statusesByCase: Record<string, string[]> = {};
    for (const item of checklistItems) {
      const caseId = item.checklists?.case_id;
      if (!caseId) continue;
      (statusesByCase[caseId] ??= []).push(String(item.status ?? ''));
    }

    const items = cases
      .filter((c) => c.status !== 'archived' && c.status !== 'Archivado')
      .map((c) => {
        const summary = summarizeChecklistStatuses(statusesByCase[c.id] || []);
        return {
          id: c.id,
          title: c.title || '',
          total: summary.total,
          fulfilled: summary.fulfilled,
          hasUnknown: summary.hasUnknown,
        };
      })
      .filter((c) => c.total > 0 && !(c.total > 0 && !c.hasUnknown && c.fulfilled === c.total));

    incompletos = ok(items);
  } else {
    if (!cases) failedDependencies.push('casos');
    if (!checklistItems) failedDependencies.push('checklist');
    incompletos = unknown();
  }

  let iaPendientes: CategoryState<DocumentRecord>;
  if (documents && aiOutputs) {
    const analyzedDocIds = new Set(
      aiOutputs
        .filter((o) => o.output_type === 'document_analysis' && o.document_id)
        .map((o) => String(o.document_id))
    );
    iaPendientes = ok(documents.filter((doc) => !analyzedDocIds.has(String(doc.id))));
  } else {
    if (!aiOutputs) failedDependencies.push('analisis');
    iaPendientes = unknown<DocumentRecord>();
  }

  const sinClasificar = documents
    ? ok(documents.filter((doc) => !doc.document_type || doc.document_type.trim() === ''))
    : unknown<DocumentRecord>();

  let plazos: CategoryState<PlazoItem>;
  if (cases && aiOutputs && agendaPlazos && documents) {
    plazos = ok(collectPlazos(cases, documents, aiOutputs, agendaPlazos, now, ''));
  } else {
    if (!agendaPlazos) failedDependencies.push('agenda');
    plazos = unknown<PlazoItem>();
  }

  // Categorías exclusivas de inmobiliaria: fuera del rubro no se consultan
  // (null) ni se exigen para el estado global.
  let clientesSinSeguimiento: CategoryState<StaleItem> & { hasIndeterminate: boolean };
  let propiedadesSinMovimiento: CategoryState<StaleItem> & { hasIndeterminate: boolean };
  let reservasPorVencer: CategoryState<ReservaItem>;

  if (!isRealEstate) {
    clientesSinSeguimiento = { kind: 'ok', total: 0, items: [], hasIndeterminate: false };
    propiedadesSinMovimiento = { kind: 'ok', total: 0, items: [], hasIndeterminate: false };
    reservasPorVencer = ok<ReservaItem>([]);
  } else if (clients && properties && cases) {
    clientesSinSeguimiento = staleCategory(clients, CLIENT_STALE_DAYS, now);
    propiedadesSinMovimiento = staleCategory(
      properties,
      PROPERTY_STALE_DAYS,
      now,
      (p) => p.status === 'disponible'
    );

    const reservas: ReservaItem[] = [];
    for (const c of cases) {
      const meta = (c.metadata ?? null) as Record<string, unknown> | null;
      const fecha = (meta?.fecha_fin_reserva as string | undefined)?.trim();
      if (!fecha) continue;
      const status = getDocumentExpiryStatus(fecha, now);
      if (status === 'por_vencer' || status === 'vencido') {
        reservas.push({ id: c.id, title: c.title || '', fecha, tipo: 'Reserva' });
      }
    }
    reservas.sort((a, b) => (getDaysUntilExpiry(a.fecha, now) ?? 0) - (getDaysUntilExpiry(b.fecha, now) ?? 0));
    reservasPorVencer = ok(reservas);
  } else {
    if (!clients) failedDependencies.push('clientes');
    if (!properties) failedDependencies.push('propiedades');
    clientesSinSeguimiento = unknown<StaleItem>() as CategoryState<StaleItem> & { hasIndeterminate: boolean };
    propiedadesSinMovimiento = unknown<StaleItem>() as CategoryState<StaleItem> & { hasIndeterminate: boolean };
    reservasPorVencer = unknown<ReservaItem>();
  }

  const knownCategories = [
    sensibles, vencimientos, incompletos, iaPendientes, sinClasificar, plazos,
    ...(isRealEstate ? [clientesSinSeguimiento, propiedadesSinMovimiento, reservasPorVencer] : []),
  ];

  const queriesComplete = knownCategories.every((category) => category.kind === 'ok');
  const totalObservaciones = queriesComplete
    ? knownCategories.reduce((sum, category) => sum + (category.kind === 'ok' ? category.total : 0), 0)
    : null;

  return {
    queriesComplete,
    failedDependencies: [...new Set(failedDependencies)],
    sensibles,
    vencimientos,
    incompletos,
    iaPendientes,
    sinClasificar,
    plazos,
    clientesSinSeguimiento,
    propiedadesSinMovimiento,
    reservasPorVencer,
    totalObservaciones,
  };
}
