import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import { createElement as h } from 'react';
import { DocumentReport } from './DocumentReport';
import {
  valueOrDash,
  percentageOrDash,
} from './DocumentReportView';
import { buildDocumentReportData } from './documentReportData';
import { getIndustryTerms } from '@/lib/industries/uiLabels';

const terms = getIndustryTerms('general');

const okData = buildDocumentReportData({
  documents: [
    { id: 'd1', sensitivity_level: 'low', expires_at: '2020-01-01' },
    { id: 'd2', sensitivity_level: 'high', expires_at: null },
  ],
  aiOutputs: [{ document_id: 'd1', result_json: null }],
  failedDependencies: [],
});

describe('DocumentReport — vista renderizada', () => {
  it('estado resultado: muestra métricas y cobertura', () => {
    const html = renderToString(h(DocumentReport, { data: okData, terms }));

    expect(html).toContain('Documentos totales');
    expect(html).toContain('Cobertura IA');
    expect(html).toContain('50%');
    expect(html).toContain('Estado del análisis documental');
  });

  it('estado vacío: mensaje explícito, sin "todo en orden"', () => {
    const empty = buildDocumentReportData({ documents: [], aiOutputs: [], failedDependencies: [] });
    const html = renderToString(h(DocumentReport, { data: empty, terms }));

    expect(html).toContain('no hay documentos');
    expect(html).not.toContain('Todo en orden');
    expect(html).not.toContain('Estado del análisis documental');
  });

  it('estado error: los guiones no significan cero', () => {
    const unavailable = buildDocumentReportData({
      documents: null,
      aiOutputs: null,
      failedDependencies: ['documentos'],
    });
    const html = renderToString(h(DocumentReport, { data: unavailable, terms }));

    expect(html).toContain('No se pudieron consultar los datos');
    expect(html).toContain('—');
  });

  it('estado parcial: avisa datos parciales y conserva total conocido', () => {
    const fixed = buildDocumentReportData({
      documents: [{ id: 'd1', sensitivity_level: 'low', expires_at: null }],
      aiOutputs: null,
      failedDependencies: ['analisis'],
    });
    expect(fixed.status).toBe('partial');
    const html = renderToString(h(DocumentReport, { data: fixed, terms }));
    expect(html).toContain('Datos parciales');
    expect(html).toContain('Documentos totales');
    expect(html).toContain('—');
  });
});

describe('DocumentReportView — helpers de valores', () => {
  it('valueOrDash devuelve guion para desconocido', () => {
    expect(valueOrDash({ ok: false })).toBe('—');
    expect(valueOrDash({ ok: true, value: 7 })).toBe('7');
  });

  it('percentageOrDash distingue cero válido de desconocido', () => {
    expect(percentageOrDash({ ok: true, value: 0 }, { ok: true, value: 0 })).toBe('0%');
    expect(percentageOrDash({ ok: true, value: 5 }, { ok: true, value: 10 })).toBe('50%');
    expect(percentageOrDash({ ok: false }, { ok: true, value: 10 })).toBe('—');
    expect(percentageOrDash({ ok: true, value: 5 }, { ok: false })).toBe('—');
  });
});
