/** @vitest-environment jsdom */
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
vi.mock('server-only', () => ({}));
vi.mock('next/navigation', () => ({ redirect: (path: string) => { throw new Error(`redirect:${path}`); }, notFound: () => { throw new Error('not-found'); } }));
vi.mock('@/lib/auth/getUserProfile', () => ({ getUserProfile: vi.fn() }));
vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }));
vi.mock('@/components/layout/AppShell', () => ({ AppShell: ({ children }: { children: React.ReactNode }) => React.createElement('div', null, children) }));
vi.mock('@/components/ui/FormSubmitButton', () => ({ FormSubmitButton: () => React.createElement('button', null, 'Guardar cambios') }));
vi.mock('../actions', () => ({ updateRentalContract: vi.fn(), aplicarAjusteAlquiler: vi.fn() }));
vi.mock('./AplicarAjusteButton', () => ({ AplicarAjusteButton: () => React.createElement('button', null, 'Aplicar ajuste fixture') }));
import { getUserProfile } from '@/lib/auth/getUserProfile';
import { createClient } from '@/lib/supabase/server';
import RentalDetailPage from './page';
const scopes = vi.fn(); const periods = vi.fn(); let record: Record<string, unknown>;
beforeEach(() => {
  vi.resetAllMocks(); vi.stubGlobal('fetch', vi.fn(() => { throw new Error('Network forbidden'); }));
  vi.mocked(getUserProfile).mockResolvedValue({ user: { id: 'fixture-user' }, profile: { role: 'admin', organization_id: 'fixture-org' } } as never);
  record = { id: 'fixture-rental', tenant_name: 'Fixture tenant', status: 'vigente', start_date: '2026-01-31T00:00:00.000Z', last_adjustment_date: null, adjustment_period_months: 1, index_type: 'ICL', current_amount: 1000, updated_at: 'fixture-token' };
  vi.mocked(createClient).mockResolvedValue({ from: (table: string) => {
    const query: Record<string, unknown> = {};
    for (const method of ['select', 'is', 'order']) query[method] = () => query;
    query.eq = (key: string, value: string) => { scopes(table, key, value); return query; };
    query.in = (key: string, values: unknown) => { periods(key, values); return query; };
    query.single = async () => ({ data: record, error: null });
    query.then = (resolve: (value: unknown) => unknown) => Promise.resolve({ data: table === 'rent_index_values' ? [{ period: '2026-01', value: 100 }, { period: '2026-02', value: 120 }] : [], error: null }).then(resolve);
    return query;
  } } as never);
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
describe('rental detail calendar compatibility', () => {
  it('keeps the date input, display and index month coherent', async () => {
    const { container } = render(await RentalDetailPage({ params: Promise.resolve({ id: 'fixture-rental' }) }));
    expect(screen.getByText('28/2/2026')).toBeTruthy();
    expect((container.querySelector('input[name="start_date"]') as HTMLInputElement).value).toBe('2026-01-31');
    expect(periods).toHaveBeenCalledWith('period', ['2026-01', '2026-02']);
    expect(screen.getByText('$1.200')).toBeTruthy();
    expect(scopes).toHaveBeenCalledWith('rental_contracts', 'organization_id', 'fixture-org');
    expect(scopes).toHaveBeenCalledWith('rent_index_values', 'organization_id', 'fixture-org'); expect(fetch).not.toHaveBeenCalled();
  });
  it('preserves auditor read-only access and does not render apply controls', async () => {
    vi.mocked(getUserProfile).mockResolvedValue({ user: { id: 'fixture-user' }, profile: { role: 'auditor', organization_id: 'fixture-org' } } as never);
    render(await RentalDetailPage({ params: Promise.resolve({ id: 'fixture-rental' }) }));
    expect(screen.getByText('Inicio: 31/1/2026')).toBeTruthy(); expect(screen.getByText('28/2/2026')).toBeTruthy(); expect(screen.queryByRole('button', { name: 'Aplicar ajuste fixture' })).toBeNull();
  });
  it('does not suggest an index month or amount from an ambiguous offset', async () => {
    record.last_adjustment_date = '2026-01-31T23:30:00-03:00';
    render(await RentalDetailPage({ params: Promise.resolve({ id: 'fixture-rental' }) }));
    expect(screen.getByText('Faltan datos de fecha o periodicidad para calcular.')).toBeTruthy();
    expect(periods).not.toHaveBeenCalled(); expect(screen.queryByRole('button', { name: 'Aplicar ajuste fixture' })).toBeNull();
  });
});
