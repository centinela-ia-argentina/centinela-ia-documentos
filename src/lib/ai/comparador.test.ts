import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
vi.mock('server-only', () => ({}));
import {
  compararInstrumentosConIA,
  parseComparacion,
  buildPromptComparacion,
  comparacionVacia,
} from './comparador';

const base = {
  nombreA: 'minuta.pdf',
  textoA: 'Texto de la minuta aprobada por las partes con cláusulas y datos.',
  nombreB: 'protocolizada.pdf',
  textoB: 'Texto de la escritura protocolizada con cláusulas y datos.',
};

const apiKeyOriginal = process.env.GEMINI_API_KEY;
const fetchOriginal = global.fetch;

beforeEach(() => {
  process.env.GEMINI_API_KEY = 'test_key';
});

afterEach(() => {
  if (apiKeyOriginal === undefined) delete process.env.GEMINI_API_KEY;
  else process.env.GEMINI_API_KEY = apiKeyOriginal;
  global.fetch = fetchOriginal;
  vi.clearAllMocks();
});

function mockGemini(json: string, ok = true) {
  global.fetch = vi.fn().mockResolvedValue({
    ok,
    json: async () => ({ candidates: [{ content: { parts: [{ text: json }] } }] }),
    text: async () => json,
  });
}

const respuestaOk = JSON.stringify({
  resumen: 'Los instrumentos coinciden en partes e inmueble.',
  diferencias: [{ seccion: 'Precio', detalle: 'A dice $100.000; B dice $150.000.' }],
  coincidencias: ['Partes idénticas'],
  advertencias: [],
});

describe('compararInstrumentosConIA', () => {
  it('sin texto en un instrumento → sin_datos, sin llamar API', async () => {
    mockGemini(respuestaOk);
    const res = await compararInstrumentosConIA({ ...base, textoB: '   ' });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.motivo).toBe('sin_datos');
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('sin API key → sin_api_key', async () => {
    delete process.env.GEMINI_API_KEY;
    mockGemini(respuestaOk);
    const res = await compararInstrumentosConIA(base);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.motivo).toBe('sin_api_key');
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('respuesta válida → comparación parseada con el prompt notarial', async () => {
    mockGemini(respuestaOk);
    const res = await compararInstrumentosConIA(base);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.comparacion.diferencias).toHaveLength(1);
      expect(res.comparacion.diferencias[0].seccion).toBe('Precio');
      expect(res.comparacion.coincidencias).toEqual(['Partes idénticas']);
    }
    const body = (global.fetch as any).mock.calls[0][1].body;
    expect(body).toContain('escribano senior argentino');
    expect(body).toContain('matrícula');
    expect(body).toContain('minuta.pdf');
  });

  it('respuesta no JSON → error sin romper', async () => {
    mockGemini('no es json');
    const res = await compararInstrumentosConIA(base);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.motivo).toBe('error');
  });

  it('API error HTTP → error', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500, text: async () => 'boom' });
    const res = await compararInstrumentosConIA(base);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.motivo).toBe('error');
  });
});

describe('parseComparacion', () => {
  it('degrada a arrays vacíos sin campos', () => {
    const p = parseComparacion('{"resumen":"hola"}');
    expect(p?.diferencias).toEqual([]);
    expect(p?.coincidencias).toEqual([]);
    expect(p?.resumen).toBe('hola');
  });
  it('filtra diferencias incompletas', () => {
    const p = parseComparacion(JSON.stringify({
      resumen: 'r',
      diferencias: [{ seccion: 'A', detalle: 'b' }, { seccion: '', detalle: 'x' }, {}],
    }));
    expect(p?.diferencias).toHaveLength(1);
  });
  it('no-JSON devuelve null', () => {
    expect(parseComparacion('xyz')).toBeNull();
  });
});

describe('buildPromptComparacion', () => {
  it('incluye los nombres de ambos instrumentos y reglas anti-invencción', () => {
    const p = buildPromptComparacion(base);
    expect(p).toContain('INSTRUMENTO A — minuta.pdf');
    expect(p).toContain('INSTRUMENTO B — protocolizada.pdf');
    expect(p).toContain('NO inventes');
    expect(p).toContain('nomenclatura');
  });
});

describe('comparacionVacia', () => {
  it('detecta textos vacíos', () => {
    expect(comparacionVacia({ ...base, textoA: '' })).toBe(true);
    expect(comparacionVacia(base)).toBe(false);
  });
});
