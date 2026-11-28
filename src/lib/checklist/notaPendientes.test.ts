/** @vitest-environment jsdom */
import { describe, it, expect } from 'vitest';
import { buildNotaPendientes } from './notaPendientes';
import type { ChecklistRow } from '@/app/expedientes/[id]/CaseChecklistPanel';

const row = (over: Partial<ChecklistRow>): ChecklistRow => ({
  id: 'i1', title: 'Título', status: 'pending', document_id: null, documents: null, ...over,
});

const REF = new Date('2026-11-26T00:00:00');

describe('buildNotaPendientes', () => {
  it('lista los pendientes del checklist y no interpreta estados recibidos/revisados', () => {
    const res = buildNotaPendientes([
      row({ title: 'DNI del vendedor', status: 'pending' }),
      row({ title: 'Certificado de dominio', status: 'received' }),
      row({ title: 'Boleto', status: 'reviewed' }),
    ], 'legajo', REF);
    expect(res.faltantes).toEqual(['DNI del vendedor']);
    expect(res.texto).toContain('Documentación pendiente para completar el legajo:');
    expect(res.texto).toContain('• DNI del vendedor');
    expect(res.texto).not.toContain('Certificado de dominio');
  });

  it('sin pendientes lo declara explícito, nunca vacío ni falso cero', () => {
    const res = buildNotaPendientes([row({ status: 'reviewed' })], 'legajo', REF);
    expect(res.faltantes).toEqual([]);
    expect(res.texto).toContain('(No hay requisitos pendientes en el checklist.)');
  });

  it('agrega certificados vencidos y por vencer del documento vinculado', () => {
    const res = buildNotaPendientes([
      row({ title: 'Certificado de inhibiciones', status: 'reviewed', document_id: 'd1', documents: { id: 'd1', file_name: 'inhibiciones.pdf', expires_at: '2026-11-20' } }),
      row({ title: 'Certificado catastral', status: 'reviewed', document_id: 'd2', documents: { id: 'd2', file_name: 'catastral.pdf', expires_at: '2026-12-01' } }),
      row({ title: 'Libre deuda', status: 'reviewed', document_id: 'd3', documents: { id: 'd3', file_name: 'libredeuda.pdf', expires_at: '2027-06-01' } }),
    ], 'legajo', REF);
    expect(res.vigencias).toHaveLength(2);
    expect(res.vigencias[0]).toEqual({ titulo: 'Certificado de inhibiciones', documento: 'inhibiciones.pdf', estado: 'vencido', dias: expect.any(Number), venceEl: '20/11/2026' });
    expect(res.vigencias[1]).toEqual({ titulo: 'Certificado catastral', documento: 'catastral.pdf', estado: 'por_vencer', dias: expect.any(Number), venceEl: '01/12/2026' });
    expect(res.texto).toContain('• Certificado de inhibiciones (inhibiciones.pdf — VENCIDO)');
    expect(res.texto).toContain('• Certificado catastral (catastral.pdf — vence el 01/12/2026)');
    expect(res.texto).not.toContain('Libre deuda');
  });

  it('ignora vencimientos de ítems sin documento vinculado', () => {
    const res = buildNotaPendientes([row({ title: 'X', status: 'pending', documents: { id: 'd9', file_name: 'a.pdf', expires_at: '2020-01-01' } })], 'expediente', REF);
    expect(res.vigencias).toHaveLength(0);
    expect(res.texto).not.toContain('VENCIDO');
  });

  it('acepta fechas en formato AR dd/mm/aaaa', () => {
    const res = buildNotaPendientes([row({ title: 'C', status: 'reviewed', document_id: 'd1', documents: { id: 'd1', file_name: 'c.pdf', expires_at: '20/11/2026' } })], 'legajo', REF);
    expect(res.vigencias[0]?.estado).toBe('vencido');
    expect(res.vigencias[0]?.venceEl).toBe('20/11/2026');
  });
});
