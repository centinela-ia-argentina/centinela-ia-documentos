import { getDocumentExpiryStatus, type ExpiryStatus } from '@/lib/documents/expiry';
import { esPlazoRadar } from '@/lib/plazos/plazos';

/**
 * Datos del reporte "Documentos e IA".
 *
 * Regla de estados: un resultado de consulta vacío ([]) es un cero válido;
 * una consulta fallida o sin datos no se convierte en cero: la sección
 * dependiente queda "desconocida" y la vista lo presenta como tal.
 */

export interface DocumentRecordForDocumentReport {
  id: string;
  sensitivity_level?: string | null;
  expires_at?: string | null;
}

export interface AiAnalysisRecordForDocumentReport {
  document_id?: string | null;
  result_json?: {
    fechas_plazos?: Array<{ fecha?: unknown; descripcion?: unknown }> | null;
  } | null;
}

export interface DocumentRecordForReport extends DocumentRecordForDocumentReport {}

export type ValueState<T> = { ok: true; value: T } | { ok: false };

export interface DocumentReportCounts {
  total: ValueState<number>;
  analyzed: ValueState<number>;
  pending: ValueState<number>;
  coveragePct: ValueState<number>;
}

export interface DocumentReportSensitivity {
  low: ValueState<number>;
  medium: ValueState<number>;
  high: ValueState<number>;
  critical: ValueState<number>;
}

export interface DocumentReportExpiry {
  vigente: ValueState<number>;
  porVencer: ValueState<number>;
  vencido: ValueState<number>;
  sinVencimiento: ValueState<number>;
}

export type DocumentReportStatus = 'ok' | 'partial' | 'unavailable';

export interface DocumentReportData {
  status: DocumentReportStatus;
  counts: DocumentReportCounts;
  sensitivity: DocumentReportSensitivity;
  expiry: DocumentReportExpiry;
  /** Nombres de dependencias de consulta cuyo resultado no está disponible. */
  failedDependencies: string[];
}

export function sensitivityRank(value?: string | null): number {
  const normalized = String(value ?? '').toLowerCase();

  if (normalized === 'critical' || normalized === 'critico' || normalized === 'crítico') return 4;
  if (normalized === 'high' || normalized === 'alto') return 3;
  if (normalized === 'medium' || normalized === 'medio') return 2;
  if (normalized === 'low' || normalized === 'bajo') return 1;

  return 0;
}

function unknown<T>(): ValueState<T> {
  return { ok: false };
}

function known<T>(value: T): ValueState<T> {
  return { ok: true, value };
}

/**
 * Fecha efectiva de vencimiento: usa expires_at; si no hay, deriva del primer
 * plazo de radar detectado por el análisis documental (comportamiento histórico).
 */
export function getEffectiveExpiry(
  document: DocumentRecordForDocumentReport,
  analysisByDocument: Map<string, AiAnalysisRecordForDocumentReport>
): string | null {
  if (document.expires_at) return document.expires_at;

  const analysis = analysisByDocument.get(document.id);
  const plazos = analysis?.result_json?.fechas_plazos;

  if (Array.isArray(plazos)) {
    const radarPlazos = plazos.filter((item) => esPlazoRadar(String(item?.descripcion ?? '')));
    const first = radarPlazos[0]?.fecha;

    if (first) return String(first).slice(0, 10);
  }

  return null;
}

export function classifyExpiry(
  documents: DocumentRecordForDocumentReport[],
  analysisByDocument: Map<string, AiAnalysisRecordForDocumentReport>
): { vigente: number; porVencer: number; vencido: number; sinVencimiento: number } {
  const result = { vigente: 0, porVencer: 0, vencido: 0, sinVencimiento: 0 };

  for (const document of documents) {
    const effectiveExpiry = getEffectiveExpiry(document, analysisByDocument);
    const status: ExpiryStatus = getDocumentExpiryStatus(effectiveExpiry);

    if (status === 'vigente') result.vigente += 1;
    else if (status === 'por_vencer') result.porVencer += 1;
    else if (status === 'vencido') result.vencido += 1;
    else result.sinVencimiento += 1;
  }

  return result;
}

export function getAnalysisCountByDocument(
  aiOutputs: AiAnalysisRecordForDocumentReport[]
): Map<string, number> {
  const map = new Map<string, number>();

  for (const item of aiOutputs) {
    const documentId = String(item.document_id || '');
    if (!documentId) continue;

    map.set(documentId, (map.get(documentId) ?? 0) + 1);
  }

  return map;
}

interface DocumentReportQueryResult {
  documents: DocumentRecordForDocumentReport[] | null;
  aiOutputs: AiAnalysisRecordForDocumentReport[] | null;
  failedDependencies: string[];
}

function parseDocumentsPayload(payload: unknown): DocumentRecordForDocumentReport[] {
  if (!Array.isArray(payload)) return [];
  return payload as DocumentRecordForDocumentReport[];
}

function parseAiOutputsPayload(payload: unknown): AiAnalysisRecordForDocumentReport[] {
  if (!Array.isArray(payload)) return [];
  return payload as AiAnalysisRecordForDocumentReport[];
}

/**
 * Ejecuta las dos consultas del reporte y clasifica cada fallo por
 * dependencia. El cliente se recibe de forma estructural (mínima) para
 * permitir mocks en pruebas sin depender del paquete de Supabase.
 */
export async function fetchDocumentReportSources(
  supabase: { from: (table: string) => any },
  organizationId: string
): Promise<DocumentReportQueryResult> {
  const failedDependencies: string[] = [];

  if (!organizationId) {
    return { documents: null, aiOutputs: null, failedDependencies: ['organizacion'] };
  }

  const [documentsResult, aiOutputsResult] = await Promise.all([
    supabase
      .from('documents')
      .select('id, sensitivity_level, expires_at')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false }),
    supabase
      .from('ai_outputs')
      .select('document_id, result_json')
      .eq('organization_id', organizationId)
      .eq('output_type', 'document_analysis')
      .order('created_at', { ascending: false }),
  ]);

  const documents = documentsResult.error ? null : parseDocumentsPayload(documentsResult.data);
  const aiOutputs = aiOutputsResult.error ? null : parseAiOutputsPayload(aiOutputsResult.data);

  if (documentsResult.error) failedDependencies.push('documentos');
  if (aiOutputsResult.error) failedDependencies.push('analisis');

  return { documents, aiOutputs, failedDependencies };
}

export function buildDocumentReportData(
  sources: { documents: DocumentRecordForDocumentReport[] | null; aiOutputs: AiAnalysisRecordForDocumentReport[] | null; failedDependencies: string[] }
): DocumentReportData {
  const { documents, aiOutputs, failedDependencies } = sources;

  const documentsKnown = documents !== null;
  const analysisKnown = aiOutputs !== null;

  const docs = documents ?? [];
  const outputs = aiOutputs ?? [];

  const analysisByDocument = new Map<string, AiAnalysisRecordForDocumentReport>();
  for (const output of outputs) {
    const id = String(output.document_id || '');
    if (id && !analysisByDocument.has(id)) analysisByDocument.set(id, output);
  }

  const total = documentsKnown ? docs.length : null;
  const analyzedCount = analysisKnown
    ? docs.filter((document) => (analysisByDocument.get(document.id) ? true : false)).length
    : null;

  let counts: DocumentReportCounts;

  if (documentsKnown && analysisKnown && total !== null && analyzedCount !== null) {
    const pending = total - analyzedCount;
    counts = {
      total: known(total),
      analyzed: known(analyzedCount),
      pending: known(pending),
      coveragePct: known(total > 0 ? Math.round((analyzedCount / total) * 100) : 0),
    };
  } else {
    counts = {
      total: documentsKnown && total !== null ? known(total) : unknown(),
      analyzed: unknown(),
      pending: unknown(),
      coveragePct: unknown(),
    };
  }

  let sensitivity: DocumentReportSensitivity;
  if (documentsKnown) {
    sensitivity = {
      low: known(docs.filter((d) => sensitivityRank(d.sensitivity_level) === 1).length),
      medium: known(docs.filter((d) => sensitivityRank(d.sensitivity_level) === 2).length),
      high: known(docs.filter((d) => sensitivityRank(d.sensitivity_level) === 3).length),
      critical: known(docs.filter((d) => sensitivityRank(d.sensitivity_level) === 4).length),
    };
  } else {
    sensitivity = { low: unknown(), medium: unknown(), high: unknown(), critical: unknown() };
  }

  let expiry: DocumentReportExpiry;
  if (documentsKnown) {
    const buckets = classifyExpiry(docs, analysisByDocument);
    expiry = {
      vigente: known(buckets.vigente),
      porVencer: known(buckets.porVencer),
      vencido: known(buckets.vencido),
      sinVencimiento: known(buckets.sinVencimiento),
    };
  } else {
    expiry = { vigente: unknown(), porVencer: unknown(), vencido: unknown(), sinVencimiento: unknown() };
  }

  const status: DocumentReportStatus = !documentsKnown
    ? 'unavailable'
    : failedDependencies.length > 0
      ? 'partial'
      : 'ok';

  return { status, counts, sensitivity, expiry, failedDependencies: [...failedDependencies] };
}

export async function loadDocumentReportData(
  supabase: Parameters<typeof fetchDocumentReportSources>[0],
  organizationId: string
): Promise<DocumentReportData> {
  const sources = await fetchDocumentReportSources(supabase, organizationId);
  return buildDocumentReportData(sources);
}
