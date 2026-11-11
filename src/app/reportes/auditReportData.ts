import {
  AUDIT_PAGE_SIZE,
  type AuditReportCounts,
  type AuditReportData,
  type AuditReportFilter,
  type AuditReportProfileRecord,
  type ValueState,
} from './auditReportContract';
import { isAiAudit, type AuditLogRecordForReport } from './reportHelpers';

/**
 * Constructor server-side de los datos de la vista Auditoría.
 * Cada conteo es una dependencia separada; un fallo queda "desconocido"
 * y nunca se presenta como cero ni como vacío.
 */

const AI_AUDIT_FILTER =
  'action.ilike.%analyzed%,action.ilike.ai_%,action.ilike.%uif%,action.ilike.%ros%,action.ilike.%prescore%,metadata->>output_type.eq.document_analysis';

function withoutAiActions<T extends {
  not: (column: string, operator: string, value: string) => T;
}>(query: T): T {
  return query
    .not('action', 'ilike', '%analyzed%')
    .not('action', 'ilike', 'ai_%')
    .not('action', 'ilike', '%uif%')
    .not('action', 'ilike', '%ros%')
    .not('action', 'ilike', '%prescore%');
}

export interface AuditFilterDefinition {
  value: AuditReportFilter;
  /** Filtro PostgREST aplicado a la consulta de página. */
  or?: string;
  /** Filtro equivalente usado para el conteo head:true. */
  countOr?: string;
  applyWithoutAi?: boolean;
}

export const AUDIT_FILTER_DEFINITIONS: Record<AuditReportFilter, AuditFilterDefinition> = {
  todos: { value: 'todos' },
  documentos: {
    value: 'documentos',
    or: 'resource_type.eq.document,action.ilike.document_%',
    countOr: 'resource_type.eq.document,action.ilike.document_%',
    applyWithoutAi: true,
  },
  ia: { value: 'ia', or: AI_AUDIT_FILTER, countOr: AI_AUDIT_FILTER },
  expedientes: {
    value: 'expedientes',
    or: 'resource_type.eq.case,action.ilike.case_%',
    countOr: 'resource_type.eq.case,action.ilike.case_%',
    applyWithoutAi: true,
  },
  invitaciones: {
    value: 'invitaciones',
    or: 'resource_type.in.(user_invitation,invitation),action.ilike.%invitation%,action.ilike.%invitacion%',
    countOr: 'resource_type.in.(user_invitation,invitation),action.ilike.%invitation%,action.ilike.%invitacion%',
  },
};

interface AuditSupabaseClient {
  from: (table: string) => any;
}

function unknown<T>(): ValueState<T> {
  return { ok: false };
}

function known<T>(value: T): ValueState<T> {
  return { ok: true, value };
}

function classifyAuditLog(log: AuditLogRecordForReport): Exclude<AuditReportFilter, 'todos'> {
  const action = log.action.toLowerCase();

  if (
    log.resource_type === 'user_invitation' ||
    log.resource_type === 'invitation' ||
    action.includes('invitation') ||
    action.includes('invitacion')
  ) {
    return 'invitaciones';
  }

  if (isAiAudit(log)) return 'ia';

  if (log.resource_type === 'document' || action.startsWith('document_')) return 'documentos';
  if (log.resource_type === 'case' || action.startsWith('case_')) return 'expedientes';

  return 'todos' as unknown as Exclude<AuditReportFilter, 'todos'>;
}

/**
 * Clasificación client-side de un lote de eventos (usada por la vista para
 * totales de la página y por las pruebas de contraste con los conteos SQL).
 */
export function classifyAuditLogs(logs: AuditLogRecordForReport[]) {
  const buckets = { documentos: 0, ia: 0, expedientes: 0, invitaciones: 0, otros: 0 };

  for (const log of logs) {
    const bucket: string = classifyAuditLog(log);
    if (bucket === 'todos') buckets.otros += 1;
    else buckets[bucket as keyof typeof buckets] += 1;
  }

  return buckets;
}

async function countQuery(
  supabase: AuditSupabaseClient,
  organizationId: string,
  definition: AuditFilterDefinition
): Promise<ValueState<number>> {
  let query = supabase
    .from('audit_logs')
    .select('*', { count: 'exact', head: true })
    .eq('organization_id', organizationId);

  if (definition.countOr) {
    query = query.or(definition.countOr);
  }

  if (definition.applyWithoutAi) {
    query = withoutAiActions(query);
  }

  const result = await query;

  if (result.error) return unknown();

  return known(typeof result.count === 'number' ? result.count : 0);
}

export async function fetchAuditCounts(
  supabase: AuditSupabaseClient,
  organizationId: string
): Promise<{ counts: AuditReportCounts; failedDependencies: string[] }> {
  const failedDependencies: string[] = [];

  if (!organizationId) {
    return {
      counts: {
        todos: unknown(), documentos: unknown(), ia: unknown(),
        expedientes: unknown(), invitaciones: unknown(),
      },
      failedDependencies: ['organizacion'],
    };
  }

  const [todos, documentos, ia, expedientes, invitaciones] = await Promise.all([
    countQuery(supabase, organizationId, AUDIT_FILTER_DEFINITIONS.todos),
    countQuery(supabase, organizationId, AUDIT_FILTER_DEFINITIONS.documentos),
    countQuery(supabase, organizationId, AUDIT_FILTER_DEFINITIONS.ia),
    countQuery(supabase, organizationId, AUDIT_FILTER_DEFINITIONS.expedientes),
    countQuery(supabase, organizationId, AUDIT_FILTER_DEFINITIONS.invitaciones),
  ]);

  if (!todos.ok) failedDependencies.push('conteo_todos');
  if (!documentos.ok) failedDependencies.push('conteo_documentos');
  if (!ia.ok) failedDependencies.push('conteo_ia');
  if (!expedientes.ok) failedDependencies.push('conteo_expedientes');
  if (!invitaciones.ok) failedDependencies.push('conteo_invitaciones');

  return { counts: { todos, documentos, ia, expedientes, invitaciones }, failedDependencies };
}

export async function buildAuditReportData(
  supabase: AuditSupabaseClient,
  organizationId: string,
  activeFilter: AuditReportFilter,
  page: number,
  precomputedCounts?: { counts: AuditReportCounts; failedDependencies: string[] }
): Promise<AuditReportData> {
  const failedDependencies: string[] = [...(precomputedCounts?.failedDependencies ?? [])];

  if (!organizationId) {
    return {
      status: 'unavailable',
      counts: {
        todos: unknown(), documentos: unknown(), ia: unknown(),
        expedientes: unknown(), invitaciones: unknown(),
      },
      logs: unknown(),
      profiles: unknown(),
      page: 1,
      totalFiltered: unknown(),
      totalPages: 1,
      failedDependencies: ['organizacion'],
    };
  }

  const countsResult = precomputedCounts ?? (await fetchAuditCounts(supabase, organizationId));
  const counts: AuditReportCounts = countsResult.counts;

  const totalFiltered: ValueState<number> = counts[activeFilter];

  if (!totalFiltered.ok) {
    // Sin el total del filtro activo no se puede paginar de forma confiable:
    // se marca la dependencia y la vista presenta el estado como no disponible.
    failedDependencies.push(`conteo_filtro_${activeFilter}`);
  }

  const totalPages = totalFiltered.ok ? Math.max(1, Math.ceil(totalFiltered.value / AUDIT_PAGE_SIZE)) : 1;
  const safePage = Math.min(Math.max(1, page), totalPages);
  const from = (safePage - 1) * AUDIT_PAGE_SIZE;
  const to = from + AUDIT_PAGE_SIZE - 1;

  let logs: ValueState<AuditLogRecordForReport[]> = unknown();

  if (totalFiltered.ok) {
    let pageQuery = supabase
      .from('audit_logs')
      .select('id, organization_id, user_id, action, resource_type, resource_id, metadata, created_at', { count: 'exact' })
      .eq('organization_id', organizationId);

    const definition = AUDIT_FILTER_DEFINITIONS[activeFilter];

    if (definition.or) {
      pageQuery = pageQuery.or(definition.or);
    }

    if (definition.applyWithoutAi) {
      pageQuery = withoutAiActions(pageQuery);
    }

    const result = await pageQuery
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .range(from, to);

    if (result.error) {
      failedDependencies.push('pagina_eventos');
      logs = unknown();
    } else {
      logs = known((result.data ?? []) as AuditLogRecordForReport[]);

      if (typeof result.count === 'number') {
        // El conteo exacto de la consulta filtrada prevalece para paginar.
        (totalFiltered as { ok: true; value: number }).value = result.count;
        failedDependencies.splice(failedDependencies.indexOf(`conteo_filtro_${activeFilter}`), 1);
      }
    }
  }

  let profiles: ValueState<AuditReportProfileRecord[]> = unknown();

  if (logs.ok) {
    const userIds = Array.from(new Set(logs.value.map((log) => log.user_id).filter(Boolean))) as string[];

    if (userIds.length > 0) {
      const profilesResult = await supabase
        .from('profiles')
        .select('id, full_name, email, role')
        .eq('organization_id', organizationId)
        .in('id', userIds);

      if (profilesResult.error) {
        failedDependencies.push('perfiles');
        profiles = unknown();
      } else {
        profiles = known((profilesResult.data ?? []) as AuditReportProfileRecord[]);
      }
    } else {
      profiles = known([]);
    }
  }

  const status: AuditReportData['status'] =
    failedDependencies.length === 0
      ? 'ok'
      : logs.ok && counts.todos.ok
        ? 'partial'
        : 'unavailable';

  return {
    status,
    counts,
    logs,
    profiles,
    page: safePage,
    totalFiltered,
    totalPages,
    failedDependencies: [...new Set(failedDependencies)],
  };
}

export async function loadAuditReportData(
  supabase: AuditSupabaseClient,
  organizationId: string,
  activeFilter: AuditReportFilter,
  page: number
): Promise<AuditReportData> {
  return buildAuditReportData(supabase, organizationId, activeFilter, page);
}
