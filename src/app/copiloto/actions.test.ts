import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('@/lib/auth/getUserProfile', () => ({ getUserProfile: vi.fn() }));
vi.mock('@/lib/auth/getStrictIndustry', () => ({ getStrictIndustry: vi.fn() }));
vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }));
vi.mock('@/lib/ai/copilotoInmobiliaria', () => ({
  generarBriefingInmobiliaria: vi.fn(),
  responderPreguntaInmobiliaria: vi.fn(),
}));

import { getUserProfile } from '@/lib/auth/getUserProfile';
import { getStrictIndustry } from '@/lib/auth/getStrictIndustry';
import { createClient } from '@/lib/supabase/server';
import { generarBriefingInmobiliaria, responderPreguntaInmobiliaria } from '@/lib/ai/copilotoInmobiliaria';
import { generarBriefing, preguntarCopiloto } from './actions';

const auth = vi.mocked(getUserProfile);
const industry = vi.mocked(getStrictIndustry);
const db = vi.mocked(createClient);
const briefingProvider = vi.mocked(generarBriefingInmobiliaria);
const questionProvider = vi.mocked(responderPreguntaInmobiliaria);
const from = vi.fn();
const eq = vi.fn();

function setSession(role = 'admin') {
  // Synthetic fixture deliberately includes an unknown role to verify fail-closed behavior.
  auth.mockResolvedValue({ user: { id: 'fixture-user' }, profile: { role, organization_id: 'fixture-org' } } as never);
}

function expectNoDataOrAi() {
  expect(db).not.toHaveBeenCalled();
  expect(briefingProvider).not.toHaveBeenCalled();
  expect(questionProvider).not.toHaveBeenCalled();
  expect(fetch).not.toHaveBeenCalled();
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubGlobal('fetch', vi.fn(() => { throw new Error('Network forbidden in permission tests'); }));
  setSession();
  industry.mockResolvedValue('inmobiliaria');
  const query: Record<string, unknown> = {};
  for (const method of ['select', 'eq', 'is', 'not', 'order', 'limit']) {
    query[method] = vi.fn(() => query);
  }
  eq.mockImplementation(() => query);
  query.eq = eq;
  from.mockImplementation(() => query);
  query.then = (resolve: (value: unknown) => unknown) => Promise.resolve({ data: [], error: null }).then(resolve);
  db.mockResolvedValue({ from } as never);
  briefingProvider.mockResolvedValue({ ok: true, model: 'fixture-model', briefing: { panorama: 'Fixture', prioridades: [], alertas: [], oportunidades: [] } });
  questionProvider.mockResolvedValue({ ok: true, model: 'fixture-model', respuesta: 'Fixture answer' });
});

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

for (const [label, action] of [
  ['briefing', () => generarBriefing()],
  ['question', () => preguntarCopiloto('  pregunta ficticia  ')],
] as const) {
  describe(`Panel AI permission: ${label}`, () => {
    it.each(['auditor', 'client', 'unknown'])('rejects %s before industry, data and provider access', async (role) => {
      setSession(role);
      expect(await action()).toEqual({ ok: false, motivo: 'sin_permiso' });
      expect(industry).not.toHaveBeenCalled();
      expectNoDataOrAi();
    });

    it.each(['admin', 'employee'])('preserves the allowed %s path and organization scope', async (role) => {
      setSession(role);
      const result = await action();
      expect(result.ok).toBe(true);
      expect(industry).toHaveBeenCalledOnce();
      expect(db).toHaveBeenCalledOnce();
      expect(from.mock.calls.map(([table]) => table)).toEqual(['properties', 'cases', 'clients', 'rental_contracts']);
      expect(eq.mock.calls).toEqual(Array.from({ length: 4 }, () => ['organization_id', 'fixture-org']));
      if (label === 'briefing') {
        expect(briefingProvider).toHaveBeenCalledOnce();
        expect(questionProvider).not.toHaveBeenCalled();
      } else {
        expect(questionProvider).toHaveBeenCalledWith(expect.objectContaining({ pregunta: 'pregunta ficticia' }));
        expect(briefingProvider).not.toHaveBeenCalled();
      }
      expect(fetch).not.toHaveBeenCalled();
    });

    it.each([
      { user: null, profile: null },
      { user: { id: 'fixture-user' }, profile: null },
      { user: null, profile: { role: 'admin', organization_id: 'fixture-org' } },
    ])('preserves missing-session rejection %#', async (session) => {
      auth.mockResolvedValue(session as never);
      expect(await action()).toEqual({ ok: false, motivo: 'sin_sesion' });
      expect(industry).not.toHaveBeenCalled();
      expectNoDataOrAi();
    });

    it.each(['legal', 'escribania'])('rejects %s before data and provider access', async (sector) => {
      industry.mockResolvedValue(sector as never);
      expect(await action()).toEqual({ ok: false, motivo: 'sin_permiso' });
      expectNoDataOrAi();
    });

    it('preserves fail-closed behavior when industry validation throws', async () => {
      industry.mockRejectedValue(new Error('Synthetic invalid industry'));
      expect(await action()).toEqual({ ok: false, motivo: 'sin_permiso' });
      expectNoDataOrAi();
    });
  });
}

it('rejects a blank question for an allowed role without querying portfolio or AI', async () => {
  expect(await preguntarCopiloto('   ')).toEqual({ ok: false, motivo: 'sin_pregunta' });
  expectNoDataOrAi();
});

it('rejects a blank question from an auditor by permission first', async () => {
  setSession('auditor');
  expect(await preguntarCopiloto('')).toEqual({ ok: false, motivo: 'sin_permiso' });
  expect(industry).not.toHaveBeenCalled();
  expectNoDataOrAi();
});


describe('Panel IA calendar context, provider mocked', () => {
  it.each([['2026-02-28T02:59:59Z', 'Ajusta en 1 día(s)'], ['2026-02-28T03:00:00Z', 'Ajusta hoy']])('uses the same February date and BA day on %s', async (instant, label) => {
    vi.useFakeTimers(); vi.setSystemTime(new Date(instant));
    from.mockImplementation((table: string) => {
      const query: Record<string, unknown> = {};
      for (const method of ['select', 'eq', 'is', 'not', 'order', 'limit']) query[method] = () => query;
      query.then = (resolve: (value: unknown) => unknown) => Promise.resolve({ data: table === 'rental_contracts' ? [{ tenant_name: 'Fixture tenant', status: 'vigente', start_date: '2026-01-31T00:00:00.000Z', last_adjustment_date: null, adjustment_period_months: 1 }] : [], error: null }).then(resolve);
      return query;
    });
    await generarBriefing(); await preguntarCopiloto('fecha ficticia');
    expect(briefingProvider).toHaveBeenCalledWith(expect.objectContaining({ alquileres: expect.objectContaining({ vencidos: [], proximos: [`Fixture tenant — 28/2/2026 (${label})`] }) }));
    expect(questionProvider).toHaveBeenCalledWith(expect.objectContaining({ contexto: expect.stringContaining(`próximo ajuste 28/2/2026 (${label})`) }));
    expect(fetch).not.toHaveBeenCalled();
  });
});
