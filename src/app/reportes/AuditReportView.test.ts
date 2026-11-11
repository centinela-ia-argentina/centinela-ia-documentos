import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import { createElement as h } from 'react';
import { AuditReportView } from './AuditReportView';
import {
  getActorLabel,
  getActorRole,
  getAuditDetail,
  getResourceLabel,
  filterAuditLogs,
  formatAuditDate,
} from './auditPresentation';
import { buildAuditReportData } from './auditReportData';
import { getIndustryTerms } from '@/lib/industries/uiLabels';
import type { AuditReportData, AuditReportFilter } from './auditReportContract';
import type { AuditLogRecordForReport } from './reportHelpers';

const terms = getIndustryTerms('general');

const profilesById = new Map([
  ['u1', { id: 'u1', full_name: 'Ana Pérez', email: 'ana@x', role: 'admin' }],
]);

const makeSupabase = (rows: AuditLogRecordForReport[]) => ({
  from: () => {
    const api: any = {
      select: () => api,
      eq: () => api,
      or: () => api,
      not: () => api,
      order: () => api,
      range: () => api,
      in: () => api,
      then: (resolve: (v: unknown) => void) =>
        resolve({ data: rows, error: null, count: rows.length }),
    };
    return api;
  },
});

const logs: AuditLogRecordForReport[] = [
  {
    id: 'l1',
    organization_id: 'org-1',
    user_id: 'u1',
    action: 'document_uploaded',
    resource_type: 'document',
    resource_id: 'd1',
    metadata: { file_name: 'contrato.pdf', case_title: 'Operación 1' },
    created_at: '2026-11-01T10:00:00.000Z',
  },
];

const baseData = async (rows: AuditLogRecordForReport[], filter: AuditReportFilter = 'todos') =>
  buildAuditReportData(makeSupabase(rows) as any, 'org-1', filter, 1);

const filters = (data: AuditReportData) =>
  (['todos', 'documentos', 'ia', 'expedientes', 'invitaciones'] as AuditReportFilter[]).map(
    (value) => ({ label: value, value, href: `?tipo=${value}`, count: data.counts[value] })
  );

const render = async (rows = logs, filter: AuditReportFilter = 'todos', data?: AuditReportData) => {
  const resolved = data ?? (await baseData(rows, filter));
  return renderToString(
    h(AuditReportView, {
      data: resolved,
      activeFilter: filter,
      filters: filters(resolved),
      terms,
      documentsById: new Map(),
      casesById: new Map(),
      profilesById,
      prevHref: null,
      nextHref: null,
    })
  );
};

describe('AuditReportView — vista renderizada', () => {
  it('estado resultado: tabla con evento, usuario y fecha', async () => {
    const html = await render();
    expect(html).toContain('Centro de auditoría operativa');
    expect(html).toContain('Ana Pérez');
    expect(html).toContain('contrato.pdf');
    expect(html).toMatch(/1\/11\/26/);
  });

  it('estado vacío confirmado: mensaje de sin eventos, no error', async () => {
    const html = await render([]);
    expect(html).toContain('No hay eventos para este filtro');
    expect(html).not.toContain('No se pudieron consultar');
  });

  it('fallo de la página de eventos: alerta de error y sin tabla vacía', async () => {
    const data = await buildAuditReportData(
      {
        from: () => {
          const api: any = {
            select: () => api,
            eq: () => api,
            or: () => api,
            not: () => api,
            order: () => api,
            range: () => api,
            in: () => api,
            then: (resolve: (v: unknown) => void) => resolve({ data: null, error: { message: 'x' }, count: null }),
          };
          return api;
        },
      } as any,
      'org-1',
      'todos',
      1
    );

    const html = await render(logs, 'todos', data);
    expect(html).toContain('No se pudieron consultar los eventos');
    expect(html).not.toContain('No hay eventos para este filtro');
  });

  it('conteo desconocido se muestra como guion, no como cero', async () => {
    const data = await baseData(logs);
    const broken: AuditReportData = {
      ...data,
      counts: { ...data.counts, ia: { ok: false } },
    };
    const html = await render(logs, 'todos', broken);
    expect(html).toContain('—');
  });

  it('paginación se muestra solo con total conocido y varias páginas', async () => {
    const data = await baseData(logs);
    const paged: AuditReportData = {
      ...data,
      totalFiltered: { ok: true, value: 120 },
      totalPages: 3,
      page: 2,
    };
    const html = await render(logs, 'todos', paged);
    expect(html).toMatch(/Página\s*(?:<!-- -->)?2/);
    expect(html).toContain('120');
    expect(html).toContain('eventos en este filtro');
  });
});

describe('auditPresentation — helpers puros', () => {
  const profilesEmpty = new Map();

  it('actor: sistema, perfil y fallback parcial', () => {
    const systemLog = { ...logs[0], user_id: null };
    expect(getActorLabel(systemLog, profilesEmpty)).toBe('Sistema');
    expect(getActorRole(systemLog, profilesEmpty)).toBe('Automático');

    const unknownUser = { ...logs[0], user_id: 'abcdef1234567890' };
    expect(getActorLabel(unknownUser, profilesEmpty)).toBe('Usuario abcdef12...');
    expect(getActorRole(unknownUser, profilesEmpty)).toBe('Usuario');
  });

  it('detalle compone modelo, estados e invitado con límite de tres', () => {
    expect(
      getAuditDetail({ ...logs[0], metadata: { model: 'm1', output_type: 'document_analysis' } })
    ).toContain('Modelo: m1');

    const many = getAuditDetail({
      ...logs[0],
      metadata: { model: 'm1', output_type: 'x', document_type: 'Contrato', sensitivity: 'high', file_name: 'a.pdf', email: 'b@x', role: 'admin', status: 'pending' },
    });
    expect(many.split(' · ').length).toBe(3);

    const industryUpdate = getAuditDetail({
      ...logs[0],
      action: 'organization_industry_updated',
      metadata: { from: 'legal', to: 'inmobiliaria' },
    });
    expect(industryUpdate).toContain('Rubro:');
  });

  it('recurso: documento con expediente, caso e invitación', () => {
    expect(getResourceLabel(logs[0], new Map(), new Map(), terms)).toBe('Operación 1 — contrato.pdf');

    const caseLog = { ...logs[0], action: 'case_created', resource_type: 'case', resource_id: 'c1', metadata: {} };
    expect(getResourceLabel(caseLog, new Map(), new Map([['c1', { id: 'c1', title: 'Juicio A' }]]), terms)).toBe('Juicio A');

    const invLog = { ...logs[0], action: 'user_invitation_created', resource_type: 'user_invitation', metadata: { email: 'nuevo@x' } };
    expect(getResourceLabel(invLog, new Map(), new Map(), terms)).toBe('nuevo@x');
  });

  it('filtro transversal clasifica por recurso excluyendo IA de documentos', () => {
    const aiLog: AuditLogRecordForReport = {
      ...logs[0],
      action: 'document_analyzed',
      metadata: { output_type: 'document_analysis' },
    };
    expect(filterAuditLogs([logs[0], aiLog], 'documentos')).toEqual([logs[0]]);
    expect(filterAuditLogs([logs[0], aiLog], 'ia')).toEqual([aiLog]);
  });

  it('fecha inválida no se presenta como fecha', () => {
    expect(formatAuditDate('no-es-fecha')).toBe('-');
    expect(formatAuditDate(null)).toBe('-');
  });
});
