import { describe, it, expect, vi } from 'vitest';
import { buildAuditReportData, fetchAuditCounts, AUDIT_FILTER_DEFINITIONS } from './auditReportData';
import { classifyAuditLogs } from './auditReportData';
import type { AuditReportFilter } from './auditReportContract';

/**
 * Cliente Supabase simulado: registra los filtros aplicados a cada consulta
 * para verificar aislamiento por organización y clasificación por filtro.
 */
function makeSupabase(options?: {
  failCounts?: boolean;
  failPage?: boolean;
  failProfiles?: boolean;
  counts?: Partial<Record<string, number>>;
  pageRows?: unknown[];
  appliedOr?: string[];
}) {
  const applied: string[] = [];
  const countMap: Record<string, number> = {
    todos: 5,
    documentos: 2,
    ia: 1,
    expedientes: 1,
    invitaciones: 1,
    ...(options?.counts ?? {}),
  };

  const build = (table: string) => {
    const state: {
      countMode: boolean;
      isPage: boolean;
      filters: string[];
      withoutAi: boolean;
      rangeUsed: [number, number] | null;
      ordered: string[];
    } = {
      countMode: false,
      isPage: false,
      filters: [],
      withoutAi: false,
      rangeUsed: null,
      ordered: [],
    };

    const api: any = {
      select(_cols: unknown, opts?: { count?: string; head?: boolean }) {
        state.countMode = Boolean(opts?.head);
        state.isPage = !state.countMode && table === 'audit_logs';
        return api;
      },
      eq(column: string, value: unknown) {
        state.filters.push(`${column}:${String(value)}`);
        return api;
      },
      or(expr: string) {
        state.filters.push(`or:${expr}`);
        applied.push(expr);
        return api;
      },
      not(column: string, op: string, value: string) {
        state.withoutAi = true;
        return api;
      },
      order(column: string, o: { ascending: boolean }) {
        state.ordered.push(column);
        return api;
      },
      range(from: number, to: number) {
        state.rangeUsed = [from, to];
        return api;
      },
      in() {
        return api;
      },
      then(resolve: (v: unknown) => void) {
        const failed = (options?.failCounts && state.countMode) || (options?.failPage && state.isPage);
        if (failed) {
          return resolve({ data: null, error: { message: 'boom' }, count: null });
        }
        if (state.countMode) {
          const orFilter = state.filters.find((f) => f.startsWith('or:'));
          let key = 'todos';
          if (orFilter?.includes('document_%')) key = 'documentos';
          else if (orFilter?.includes('analyzed') || orFilter?.includes('ai_%')) key = 'ia';
          else if (orFilter?.includes('case')) key = 'expedientes';
          else if (orFilter?.includes('invitation')) key = 'invitaciones';
          return resolve({ data: null, error: null, count: countMap[key] ?? 0 });
        }
        if (state.isPage) {
          return resolve({ data: options?.pageRows ?? [], error: null, count: countMap['pagina'] ?? (options?.pageRows ?? []).length });
        }
        // profiles
        if (options?.failProfiles) {
          return resolve({ data: null, error: { message: 'boom' }, count: null });
        }
        return resolve({
          data: [
            { id: 'u1', full_name: 'Ana', email: 'ana@x', role: 'admin' },
          ],
          error: null,
          count: null,
        });
      },
    };

    return api;
  };

  return {
    client: { from: (table: string) => build(table) } as any,
    applied,
  };
}

const log = (overrides: Partial<Record<string, unknown>> = {}) => ({
  id: 'l1',
  organization_id: 'org-1',
  user_id: 'u1',
  action: 'document_uploaded',
  resource_type: 'document',
  resource_id: 'd1',
  metadata: {},
  created_at: '2026-11-01T10:00:00.000Z',
  ...overrides,
});

describe('auditReportData — conteos independientes', () => {
  it('consulta fallida de un conteo queda desconocido, no cero', async () => {
    const { client } = makeSupabase({ failCounts: true });
    const data = await buildAuditReportData(client, 'org-1', 'todos', 1);

    expect(data.counts.todos.ok).toBe(false);
    expect(data.counts.documentos.ok).toBe(false);
    expect(data.status).toBe('unavailable');
  });

  it('conteos ok con filtro activo conocido y página vacía → ok', async () => {
    const { client } = makeSupabase({ counts: { todos: 5, pagina: 5 }, pageRows: [log()] });
    const data = await buildAuditReportData(client, 'org-1', 'todos', 1);

    expect(data.status).toBe('ok');
    expect(data.counts.todos).toEqual({ ok: true, value: 5 });
    expect(data.logs.ok).toBe(true);
    expect(data.page).toBe(1);
  });

  it('fallo de la página de eventos → lista desconocida sin inventar vacío', async () => {
    const { client } = makeSupabase({ failPage: true });
    const data = await buildAuditReportData(client, 'org-1', 'todos', 1);

    expect(data.logs.ok).toBe(false);
    expect(data.status).toBe('unavailable');
    expect(data.failedDependencies).toContain('pagina_eventos');
  });

  it('fallo de perfiles no borra eventos y marca dependencia', async () => {
    const { client } = makeSupabase({ failProfiles: true, pageRows: [log()] });
    const data = await buildAuditReportData(client, 'org-1', 'todos', 1);

    expect(data.logs.ok).toBe(true);
    expect(data.profiles.ok).toBe(false);
    expect(data.failedDependencies).toContain('perfiles');
    expect(data.status).toBe('partial');
  });
});

describe('auditReportData — aislamiento y filtros', () => {
  it('todas las consultas filtran por organización', async () => {
    const seen: string[] = [];
    const client = {
      from: () => {
        const state: any = { filters: [] };
        const api: any = {
          select: () => api,
          eq: (c: string, v: unknown) => {
            state.filters.push(`${c}:${v}`);
            seen.push(`${c}:${v}`);
            return api;
          },
          or: () => api,
          not: () => api,
          order: () => api,
          range: () => api,
          in: () => api,
          then: (r: (v: unknown) => void) => r({ data: null, error: { message: 'stop' }, count: null }),
        };
        return api;
      },
    };

    await buildAuditReportData(client as any, 'org-9', 'todos', 1);
    expect(seen.length).toBeGreaterThan(0);
    for (const entry of seen) {
      expect(entry).toContain('organization_id:org-9');
    }
  });

  it('el filtro documentos excluye acciones IA (withoutAi)', async () => {
    const { client, applied } = makeSupabase({ pageRows: [] });
    await buildAuditReportData(client, 'org-1', 'documentos', 1);

    const docFilter = AUDIT_FILTER_DEFINITIONS.documentos;
    expect(applied).toContain(docFilter.or);
  });

  it('rango de paginación corresponde a la página solicitada', async () => {
    let captured: [number, number] | null = null;
    const client = {
      from: () => {
        const api: any = {
          select: () => api,
          eq: () => api,
          or: () => api,
          not: () => api,
          order: () => api,
          range: (from: number, to: number) => {
            captured = [from, to];
            return api;
          },
          in: () => api,
          then: (r: (v: unknown) => void) => r({ data: [], error: null, count: 120 }),
        };
        return api;
      },
    };

    const data = await buildAuditReportData(client as any, 'org-1', 'todos', 3);
    expect(captured).toEqual([100, 149]);
    expect(data.page).toBe(3);
    expect(data.totalFiltered).toEqual({ ok: true, value: 120 });
    expect(data.totalPages).toBe(3);
  });
});

describe('auditReportData — clasificación client-side de eventos', () => {
  it('separa IA, documentos, expedientes, invitaciones y otros', () => {
    const buckets = classifyAuditLogs([
      log({ action: 'document_analyzed', resource_type: 'document', metadata: { output_type: 'document_analysis' } }),
      log({ action: 'document_uploaded' }),
      log({ action: 'case_created', resource_type: 'case' }),
      log({ action: 'user_invitation_created', resource_type: 'user_invitation' }),
      log({ action: 'organization_industry_updated', resource_type: 'organization' }),
    ]);

    expect(buckets).toEqual({ documentos: 1, ia: 1, expedientes: 1, invitaciones: 1, otros: 1 });
  });

  it('el conteo head del filtro IA coincide con la clasificación local en el fixture', async () => {
    const rows = [
      log({ action: 'document_analyzed', metadata: { output_type: 'document_analysis' } }),
      log({ action: 'document_uploaded' }),
    ];
    const { client } = makeSupabase({ counts: { ia: 1, pagina: 1 }, pageRows: rows });
    const data = await buildAuditReportData(client, 'org-1', 'ia', 1);

    expect(data.counts.ia).toEqual({ ok: true, value: 1 });
    const buckets = classifyAuditLogs(rows);
    expect(buckets.ia).toBe(1);
  });
});

describe('auditReportData — contrato de conteos exportable', () => {
  it('fetchAuditCounts devuelve los cinco conteos con organización', async () => {
    const { client } = makeSupabase();
    const result = await fetchAuditCounts(client, 'org-1');
    expect(Object.keys(result.counts).sort()).toEqual(['documentos', 'expedientes', 'ia', 'invitaciones', 'todos']);
    expect(result.failedDependencies).toEqual([]);
  });
});
