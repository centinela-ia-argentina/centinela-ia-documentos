import { describe, it, expect } from 'vitest';
import {
  AUDIT_PAGE_SIZE,
  isAuditReportFilter,
  resolveAuditPageParam,
  finalizeAuditRedirect,
} from './auditReportContract';

describe('auditReportContract — resolución server-side del parámetro página', () => {
  it('sin parámetro usa la página 1 sin redirigir', () => {
    const result = resolveAuditPageParam(undefined, 120);
    expect(result).toEqual({ action: 'use', page: 1 });
  });

  it('valor no numérico redirige a página 1', () => {
    const result = finalizeAuditRedirect(resolveAuditPageParam('abc', 120), 'ia');
    expect(result).toEqual({
      action: 'redirect',
      page: 1,
      redirectTo: '/reportes?vista=auditoria&tipo=ia&pagina=1',
    });
  });

  it('rechaza cero, negativos y valores no enteros', () => {
    for (const raw of ['0', '-1', '1.5', '1e3', '  ']) {
      expect(resolveAuditPageParam(raw, 120).action).toBe('redirect');
    }
  });

  it('fuera de rango redirige a la última página', () => {
    const total = AUDIT_PAGE_SIZE * 3 + 10;
    const result = finalizeAuditRedirect(resolveAuditPageParam('99', total), 'documentos');
    expect(result).toEqual({
      action: 'redirect',
      page: 4,
      redirectTo: '/reportes?vista=auditoria&tipo=documentos&pagina=4',
    });
  });

  it('sin resultados solo acepta la página 1', () => {
    expect(resolveAuditPageParam('1', 0)).toEqual({ action: 'use', page: 1 });
    expect(resolveAuditPageParam('2', 0).action).toBe('redirect');
  });

  it('acepta la última página exacta sin redirigir', () => {
    const total = AUDIT_PAGE_SIZE * 2;
    expect(resolveAuditPageParam('2', total)).toEqual({ action: 'use', page: 2 });
    expect(resolveAuditPageParam('3', total).action).toBe('redirect');
  });

  it('limita a enteros seguros', () => {
    expect(resolveAuditPageParam(String(Number.MAX_SAFE_INTEGER), 10).action).toBe('redirect');
  });
});

describe('auditReportContract — validación de filtro', () => {
  it('acepta solo los filtros definidos', () => {
    expect(isAuditReportFilter('todos')).toBe(true);
    expect(isAuditReportFilter('documentos')).toBe(true);
    expect(isAuditReportFilter('ia')).toBe(true);
    expect(isAuditReportFilter('expedientes')).toBe(true);
    expect(isAuditReportFilter('invitaciones')).toBe(true);
    expect(isAuditReportFilter('otro')).toBe(false);
    expect(isAuditReportFilter(undefined)).toBe(false);
  });
});
