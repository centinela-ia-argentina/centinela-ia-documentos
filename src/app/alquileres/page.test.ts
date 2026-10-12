/** @vitest-environment jsdom */
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
vi.mock('server-only', () => ({}));
vi.mock('next/navigation', () => ({ redirect: (path: string) => { throw new Error(`redirect:${path}`); } }));
vi.mock('@/lib/auth/getUserProfile', () => ({ getUserProfile: vi.fn() }));
vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }));
vi.mock('@/components/layout/AppShell', () => ({ AppShell: ({ children }: { children: React.ReactNode }) => React.createElement('div', null, children) }));
vi.mock('@/components/ui/MotionCard', () => ({ MotionCard: ({ children }: { children: React.ReactNode }) => React.createElement('div', null, children) }));
import { getUserProfile } from '@/lib/auth/getUserProfile';
import { createClient } from '@/lib/supabase/server';
import RentalsPage from './page';
const scopes = vi.fn(); let records: Record<string, unknown>[];
beforeEach(() => {
  vi.resetAllMocks(); vi.useFakeTimers(); vi.setSystemTime(new Date('2026-02-28T03:00:00Z'));
  vi.stubGlobal('fetch', vi.fn(() => { throw new Error('Network forbidden'); }));
  vi.mocked(getUserProfile).mockResolvedValue({ user: { id: 'fixture-user' }, profile: { role: 'admin', organization_id: 'fixture-org' } } as never);
  records = [{ id: 'fixture-rental', tenant_name: 'Fixture tenant', status: 'vigente', start_date: '2026-01-31', last_adjustment_date: null, adjustment_period_months: 1 }];
  vi.mocked(createClient).mockResolvedValue({ from: (table: string) => {
    const query: Record<string, unknown> = {};
    for (const method of ['select', 'is', 'order']) query[method] = () => query;
    query.eq = (key: string, value: string) => { scopes(table, key, value); return query; };
    query.single = async () => ({ data: { industry_type: 'inmobiliaria' }, error: null });
    query.then = (resolve: (value: unknown) => unknown) => Promise.resolve({ data: records, error: null }).then(resolve);
    return query;
  } } as never);
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); });
describe('rental list date adapter only', () => {
  it('shows the clamped date and BA today without layout changes', async () => {
    render(await RentalsPage()); expect(screen.getByText('28/2/2026')).toBeTruthy(); expect(screen.getByText('⏰ Ajusta hoy')).toBeTruthy();
    expect(scopes).toHaveBeenCalledWith('rental_contracts', 'organization_id', 'fixture-org'); expect(fetch).not.toHaveBeenCalled();
  });
  it('keeps the ISO registered day before BA midnight', async () => {
    records[0].start_date = '2026-01-31T00:00:00.000Z'; vi.setSystemTime(new Date('2026-02-28T02:59:59Z'));
    render(await RentalsPage()); expect(screen.getByText('28/2/2026')).toBeTruthy(); expect(screen.getByText('⏰ Ajusta en 1 día(s)')).toBeTruthy();
  });
  it('does not display a guessed date for an ambiguous legacy offset', async () => {
    records[0].last_adjustment_date = '2026-01-31T23:30:00-03:00';
    render(await RentalsPage()); expect(screen.queryByText('28/2/2026')).toBeNull(); expect(screen.queryByText('Ajusta hoy')).toBeNull();
  });
});
