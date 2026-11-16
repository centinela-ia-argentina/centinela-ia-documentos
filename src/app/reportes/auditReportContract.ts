import type { AuditLogRecordForReport } from './reportHelpers';

/** Tamaño de página server-side de la vista Auditoría. */
export const AUDIT_PAGE_SIZE = 50;

export type AuditReportFilter = 'todos' | 'documentos' | 'ia' | 'expedientes' | 'invitaciones';

export function isAuditReportFilter(value?: string | null): value is AuditReportFilter {
  return (
    value === 'todos' ||
    value === 'documentos' ||
    value === 'ia' ||
    value === 'expedientes' ||
    value === 'invitaciones'
  );
}

export type ValueState<T> = { ok: true; value: T } | { ok: false };

export interface AuditReportCounts {
  todos: ValueState<number>;
  documentos: ValueState<number>;
  ia: ValueState<number>;
  expedientes: ValueState<number>;
  invitaciones: ValueState<number>;
}

export interface AuditReportProfileRecord {
  id: string;
  full_name?: string | null;
  email?: string | null;
  role?: string | null;
}

export type AuditReportStatus = 'ok' | 'partial' | 'unavailable';

export interface AuditReportData {
  status: AuditReportStatus;
  counts: AuditReportCounts;
  /** Eventos de la página solicitada. `ok: false` = la consulta de la página falló. */
  logs: ValueState<AuditLogRecordForReport[]>;
  /** Perfiles de los usuarios de la página. Fallo no borra eventos. */
  profiles: ValueState<AuditReportProfileRecord[]>;
  page: number;
  totalFiltered: ValueState<number>;
  totalPages: number;
  failedDependencies: string[];
}

export type AuditPageResolution =
  | { action: 'use'; page: number }
  | { action: 'redirect'; page: number; redirectTo: string };

/**
 * Resuelve el parámetro `pagina` de forma server-side y estricta:
 * valor inválido → redirige a la página 1; fuera de rango → última página;
 * sin resultados → solo la página 1 es válida.
 */
export function resolveAuditPageParam(
  raw: unknown,
  totalFiltered: number
): AuditPageResolution {
  const buildHref = (page: number) => `/reportes?vista=auditoria&tipo=__FILTRO__&pagina=${page}`;

  if (raw === undefined || raw === null) {
    return { action: 'use', page: 1 };
  }

  const text = String(raw).trim();
  if (!/^[1-9]\d*$/.test(text)) {
    return { action: 'redirect', page: 1, redirectTo: buildHref(1) };
  }

  const parsed = Number(text);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    return { action: 'redirect', page: 1, redirectTo: buildHref(1) };
  }

  const totalPages = Math.max(1, Math.ceil(Math.max(0, totalFiltered) / AUDIT_PAGE_SIZE));

  if (totalFiltered === 0) {
    if (parsed > 1) return { action: 'redirect', page: 1, redirectTo: buildHref(1) };
    return { action: 'use', page: 1 };
  }

  if (parsed > totalPages) {
    return { action: 'redirect', page: totalPages, redirectTo: buildHref(totalPages) };
  }

  return { action: 'use', page: parsed };
}

/** Reemplaza el placeholder del filtro en el destino de redirección. */
export function finalizeAuditRedirect(resolution: AuditPageResolution, filter: AuditReportFilter): AuditPageResolution {
  if (resolution.action === 'use') return resolution;
  return {
    ...resolution,
    redirectTo: resolution.redirectTo.replace('__FILTRO__', filter),
  };
}
