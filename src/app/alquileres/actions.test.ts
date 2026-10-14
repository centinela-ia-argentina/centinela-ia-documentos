import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
vi.mock('next/navigation', () => ({ redirect: vi.fn((url: string) => { throw new Error(`redirect:${url}`); }) }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }));
vi.mock('@/lib/auth/getUserProfile', () => ({ getUserProfile: vi.fn() }));
vi.mock('@/lib/audit/createAuditLog', () => ({ createAuditLog: vi.fn() }));
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getUserProfile } from '@/lib/auth/getUserProfile';
import { createAuditLog } from '@/lib/audit/createAuditLog';
import { aplicarAjusteAlquiler } from './actions';
import { calcularProximoAjuste } from '@/lib/rentals/labels';
import { rentalDateISO } from '@/lib/rentals/calendar';
const from = vi.fn(); const scopes = vi.fn(); const periods = vi.fn(); const update = vi.fn();
let record: Record<string, unknown>; let updated: unknown[] | null; let indexValues: { period: string; value: number }[];
function form(token = '2026-01-31T00:00:00Z') { const f = new FormData(); f.set('rental_id', 'fixture-rental'); f.set('expected_updated_at', token); return f; }
function session(role = 'admin') { vi.mocked(getUserProfile).mockResolvedValue({ user: { id: 'fixture-user' }, profile: { role, organization_id: 'fixture-org' } } as never); }
beforeEach(() => {
  vi.resetAllMocks(); vi.useFakeTimers(); vi.setSystemTime(new Date('2026-02-28T03:00:00Z'));
  vi.mocked(redirect).mockImplementation((url: string) => { throw new Error(`redirect:${url}`); });
  vi.stubGlobal('fetch', vi.fn(() => { throw new Error('Network forbidden'); })); session();
  record = { id: 'fixture-rental', start_date: '2026-01-31', last_adjustment_date: null, adjustment_period_months: 1, current_amount: 1000, index_type: 'ICL', fixed_pct: null, updated_at: '2026-01-31T00:00:00Z' };
  updated = [{ id: 'fixture-rental' }]; indexValues = [{ period: '2026-01', value: 100 }, { period: '2026-02', value: 120 }, { period: '2026-03', value: 150 }];
  from.mockImplementation((table: string) => {
    let writing = false; const query: Record<string, unknown> = {};
    query.select = () => query;
    query.eq = (key: string, value: unknown) => { scopes(table, writing, key, value); return query; };
    query.in = (key: string, values: unknown) => { periods(key, values); return query; };
    query.update = (payload: unknown) => { writing = true; update(payload); return query; };
    query.single = async () => ({ data: record, error: null });
    query.then = (resolve: (value: unknown) => unknown) => Promise.resolve({ data: table === 'rent_index_values' ? indexValues : updated, error: null }).then(resolve);
    return query;
  });
  vi.mocked(createClient).mockResolvedValue({ from } as never);
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
describe('apply rental adjustment — mocked writes only', () => {
  it.each(['admin', 'employee'])('allows %s on BA today with February index and canonical ISO persistence', async role => {
    session(role); await expect(aplicarAjusteAlquiler(form())).rejects.toThrow('redirect:/alquileres/fixture-rental');
    expect(periods).toHaveBeenCalledWith('period', ['2026-01', '2026-02']);
    expect(update).toHaveBeenCalledWith({ current_amount: 1200, last_adjustment_date: '2026-02-28T00:00:00.000Z', updated_at: '2026-02-28T03:00:00.000Z' });
    expect(scopes).toHaveBeenCalledWith('rental_contracts', false, 'organization_id', 'fixture-org');
    expect(scopes).toHaveBeenCalledWith('rent_index_values', false, 'organization_id', 'fixture-org');
    expect(scopes).toHaveBeenCalledWith('rental_contracts', true, 'id', 'fixture-rental');
    expect(scopes).toHaveBeenCalledWith('rental_contracts', true, 'organization_id', 'fixture-org');
    expect(scopes).toHaveBeenCalledWith('rental_contracts', true, 'updated_at', '2026-01-31T00:00:00Z');
    expect(createAuditLog).toHaveBeenCalledWith(expect.objectContaining({ organizationId: 'fixture-org', action: 'rental_adjusted', metadata: { monto_anterior: 1000, monto_nuevo: 1200, coeficiente: 1.2 } }));
    expect(revalidatePath).toHaveBeenCalledWith('/alquileres'); expect(fetch).not.toHaveBeenCalled();
    const stored = update.mock.calls[0][0].last_adjustment_date;
    expect(rentalDateISO(calcularProximoAjuste(record.start_date as string, stored, 1))).toBe('2026-03-28');
  });
  it('rejects before BA midnight, even though UTC day is already February 28', async () => {
    vi.setSystemTime(new Date('2026-02-28T02:59:59Z'));
    await expect(aplicarAjusteAlquiler(form())).rejects.toThrow(encodeURIComponent('El ajuste todavía no corresponde. Podrás aplicarlo a partir del 28/02/2026.'));
    expect(periods).not.toHaveBeenCalled(); expect(update).not.toHaveBeenCalled(); expect(createAuditLog).not.toHaveBeenCalled();
  });
  it('preserves fixed percentage math without index queries', async () => {
    record.index_type = 'FIJO'; record.fixed_pct = 10;
    await expect(aplicarAjusteAlquiler(form())).rejects.toThrow('redirect:/alquileres/fixture-rental');
    expect(periods).not.toHaveBeenCalled(); expect(update).toHaveBeenCalledWith(expect.objectContaining({ current_amount: 1100 }));
  });
  it('preserves legacy midnight ISO as the registered January day', async () => {
    record.start_date = '2026-01-31T00:00:00.000Z';
    await expect(aplicarAjusteAlquiler(form())).rejects.toThrow('redirect:/alquileres/fixture-rental');
    expect(periods).toHaveBeenCalledWith('period', ['2026-01', '2026-02']);
  });
  it.each(['auditor', 'client', 'unknown'])('denies %s before reading or writing', async role => {
    session(role); await expect(aplicarAjusteAlquiler(form())).rejects.toThrow('redirect:/acceso-denegado');
    expect(createClient).not.toHaveBeenCalled(); expect(update).not.toHaveBeenCalled();
  });
  it('preserves optimistic pre-check', async () => {
    await expect(aplicarAjusteAlquiler(form('stale'))).rejects.toThrow(encodeURIComponent('El contrato cambió'));
    expect(update).not.toHaveBeenCalled(); expect(createAuditLog).not.toHaveBeenCalled();
  });
  it('does not audit/revalidate if optimistic write affects no rows', async () => {
    updated = [];
    await expect(aplicarAjusteAlquiler(form())).rejects.toThrow(encodeURIComponent('El contrato cambió'));
    expect(createAuditLog).not.toHaveBeenCalled(); expect(revalidatePath).not.toHaveBeenCalled();
  });
  it.each(['bad', '2026-01-31T23:30:00-03:00'])('does not apply ambiguous/invalid date %s', async value => {
    record.last_adjustment_date = value;
    await expect(aplicarAjusteAlquiler(form())).rejects.toThrow('No se puede calcular el próximo ajuste');
    expect(periods).not.toHaveBeenCalled(); expect(update).not.toHaveBeenCalled(); expect(createAuditLog).not.toHaveBeenCalled();
  });
  it('does not apply when corrected objective index is missing', async () => {
    indexValues = indexValues.filter(v => v.period !== '2026-02');
    await expect(aplicarAjusteAlquiler(form())).rejects.toThrow(encodeURIComponent('El índice objetivo de 2026-02 es inválido'));
    expect(update).not.toHaveBeenCalled(); expect(createAuditLog).not.toHaveBeenCalled();
  });
});
