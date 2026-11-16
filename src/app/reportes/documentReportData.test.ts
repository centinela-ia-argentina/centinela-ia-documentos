import { describe, it, expect } from 'vitest';
import {
  buildDocumentReportData,
  classifyExpiry,
  getAnalysisCountByDocument,
  getEffectiveExpiry,
  sensitivityRank,
  fetchDocumentReportSources,
} from './documentReportData';

function makeSupabase(documentsResult: unknown, aiOutputsResult: unknown) {
  return {
    from: (table: string) => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            order: async () => (table === 'documents' ? documentsResult : aiOutputsResult),
          }),
          order: async () => (table === 'documents' ? documentsResult : aiOutputsResult),
        }),
      }),
    }),
  };
}

const doc = (id: string, sensitivity = 'low', expires?: string) => ({
  id,
  sensitivity_level: sensitivity,
  expires_at: expires ?? null,
});

describe('documentReportData — estados de datos y dependencias', () => {
  it('consulta fallida de documentos → unavailable y secciones desconocidas (no cero)', () => {
    const data = buildDocumentReportData({
      documents: null,
      aiOutputs: [],
      failedDependencies: ['documentos'],
    });

    expect(data.status).toBe('unavailable');
    expect(data.counts.total.ok).toBe(false);
    expect(data.sensitivity.low.ok).toBe(false);
    expect(data.expiry.vigente.ok).toBe(false);
    expect(data.failedDependencies).toContain('documentos');
  });

  it('consulta fallida de análisis → partial con total conocido y analizados desconocidos', () => {
    const data = buildDocumentReportData({
      documents: [doc('d1'), doc('d2', 'high')],
      aiOutputs: null,
      failedDependencies: ['analisis'],
    });

    expect(data.status).toBe('partial');
    expect(data.counts.total).toEqual({ ok: true, value: 2 });
    expect(data.counts.analyzed.ok).toBe(false);
    expect(data.counts.coveragePct.ok).toBe(false);
    expect(data.sensitivity.high).toEqual({ ok: true, value: 1 });
  });

  it('resultado vacío válido → ceros explícitos y cobertura 0%', () => {
    const data = buildDocumentReportData({ documents: [], aiOutputs: [], failedDependencies: [] });

    expect(data.status).toBe('ok');
    expect(data.counts.total).toEqual({ ok: true, value: 0 });
    expect(data.counts.coveragePct).toEqual({ ok: true, value: 0 });
    expect(data.expiry.sinVencimiento).toEqual({ ok: true, value: 0 });
  });

  it('cuenta analizadas, pendientes y cobertura con redondeo', () => {
    const data = buildDocumentReportData({
      documents: [doc('d1'), doc('d2'), doc('d3')],
      aiOutputs: [{ document_id: 'd1' }, { document_id: 'd1' }, { document_id: 'd3' }],
      failedDependencies: [],
    });

    expect(data.counts.analyzed).toEqual({ ok: true, value: 2 });
    expect(data.counts.pending).toEqual({ ok: true, value: 1 });
    expect(data.counts.coveragePct).toEqual({ ok: true, value: 67 });
  });

  it('getAnalysisCountByDocument ignora salidas sin document_id', () => {
    const map = getAnalysisCountByDocument([{ document_id: 'a' }, { document_id: null }, {}]);
    expect(map.get('a')).toBe(1);
    expect(map.size).toBe(1);
  });

  it('sensibilidad desconocida no se cuenta en ninguna categoría', () => {
    expect(sensitivityRank('desconocido')).toBe(0);
    expect(sensitivityRank(null)).toBe(0);
    expect(sensitivityRank('crítico')).toBe(4);
  });
});

describe('documentReportData — vencimientos', () => {
  const analysis = new Map([
    ['d-radar', { document_id: 'd-radar', result_json: { fechas_plazos: [{ fecha: '2099-01-01', descripcion: 'vencimiento de demanda' }] } }],
  ]);

  it('usa expires_at cuando está presente', () => {
    expect(getEffectiveExpiry(doc('d1', 'low', '2030-06-01'), analysis)).toBe('2030-06-01');
  });

  it('deriva del primer plazo de radar cuando no hay expires_at', () => {
    expect(getEffectiveExpiry(doc('d-radar'), analysis)).toBe('2099-01-01');
  });

  it('sin fecha ni análisis → sin_vencimiento', () => {
    expect(classifyExpiry([doc('d1')], new Map())).toEqual({
      vigente: 0, porVencer: 0, vencido: 0, sinVencimiento: 1,
    });
  });

  it('fecha pasada se clasifica vencida; futura lejana vigente', () => {
    const buckets = classifyExpiry([doc('a', 'low', '2001-01-01'), doc('b', 'low', '2099-01-01')], new Map());
    expect(buckets.vencido).toBe(1);
    expect(buckets.vigente).toBe(1);
  });
});

describe('documentReportData — fetch con aislamiento por organización', () => {
  it('filtra por organization_id y clasifica errores por dependencia', async () => {
    const seen: string[] = [];
    const supabase = {
      from: (table: string) => {
        seen.push(table);
        return {
          select: () => ({
            eq: (column: string, value: unknown) => {
              if (column === 'organization_id' && value !== 'org-1') throw new Error('scope');
              return {
                eq: () => ({
                  order: async () => ({ data: [], error: table === 'ai_outputs' ? { message: 'x' } : null }),
                }),
                order: async () => ({ data: [], error: table === 'ai_outputs' ? { message: 'x' } : null }),
              };
            },
          }),
        };
      },
    };

    const sources = await fetchDocumentReportSources(supabase as any, 'org-1');

    expect(seen).toContain('documents');
    expect(seen).toContain('ai_outputs');
    expect(sources.documents).toEqual([]);
    expect(sources.aiOutputs).toBeNull();
    expect(sources.failedDependencies).toEqual(['analisis']);
  });

  it('sin organización no consulta nada y marca la dependencia', async () => {
    const sources = await fetchDocumentReportSources(makeSupabase({ data: [], error: null }, { data: [], error: null }) as any, '');
    expect(sources.failedDependencies).toEqual(['organizacion']);
    expect(sources.documents).toBeNull();
  });
});
