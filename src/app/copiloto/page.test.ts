/** @vitest-environment jsdom */
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';

vi.mock('server-only', () => ({}));
vi.mock('next/navigation', () => ({ redirect: vi.fn((path: string) => { throw new Error(`redirect:${path}`); }) }));
vi.mock('@/lib/auth/getUserProfile', () => ({ getUserProfile: vi.fn() }));
vi.mock('@/lib/auth/getStrictIndustry', () => ({ getStrictIndustry: vi.fn() }));
vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }));
vi.mock('@/components/layout/AppShell', () => ({ AppShell: ({ children }: { children: React.ReactNode }) => React.createElement('div', { 'data-testid': 'shell' }, children) }));
vi.mock('./CopilotoClient', () => ({ CopilotoClient: ({ canUsePortfolioAi }: { canUsePortfolioAi: boolean }) => React.createElement('div', { 'data-testid': 'capability', 'data-ai': String(canUsePortfolioAi) }) }));
import { redirect } from 'next/navigation';
import { getUserProfile } from '@/lib/auth/getUserProfile';
import { getStrictIndustry } from '@/lib/auth/getStrictIndustry';
import { createClient } from '@/lib/supabase/server';
import CopilotoPage from './page';
const auth = vi.mocked(getUserProfile); const industry = vi.mocked(getStrictIndustry); const db = vi.mocked(createClient);
type Reply = { data: unknown[] | null; error: unknown };
let responses: Record<string, Reply>;
const from = vi.fn(); const scopes = vi.fn(); const archived = vi.fn(); const selects = vi.fn();
function session(role = 'admin') { auth.mockResolvedValue({ user: { id: 'fixture-user' }, profile: { role, organization_id: 'fixture-org' } } as never); }
beforeEach(() => {
  vi.resetAllMocks(); vi.mocked(redirect).mockImplementation((path: string) => { throw new Error(`redirect:${path}`); }); vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-11T12:00:00Z'));
  vi.stubGlobal('fetch', vi.fn(() => { throw new Error('Network forbidden in page tests'); }));
  session(); industry.mockResolvedValue('inmobiliaria');
  responses = { properties: { data: [{ id: 'p1' }, { id: 'p2' }], error: null }, cases: { data: [{ id: 'c1', status: 'archived' }], error: null }, clients: { data: [], error: null }, rental_contracts: { data: [], error: null } };
  from.mockImplementation((table: string) => {
    const query: Record<string, unknown> = {};
    query.select = (fields: string) => { selects(table, fields); return query; };
    query.eq = (field: string, value: string) => { scopes(table, field, value); return query; };
    query.is = (field: string, value: null) => { archived(table, field, value); return query; };
    query.then = (resolve: (v: Reply) => unknown) => Promise.resolve(responses[table]).then(resolve);
    return query;
  });
  db.mockResolvedValue({ from } as never);
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); });
async function page() { return render(await CopilotoPage()); }
function metric(name: string) { return within(screen.getByText(name, { exact: true }).parentElement!); }

describe('Panel server presentation', () => {
  it('uses five simple horizontal arrows for real module links', async () => {
    const { container } = await page();
    const links = screen.getAllByRole('link');
    expect(links).toHaveLength(5);
    for (const link of links) expect(link.querySelector('svg.lucide-arrow-right')).toBeTruthy();
    expect(container.querySelector('.lucide-arrow-up-right')).toBeNull();
  });
  it('zero adjustments show noninteractive neutral status labels', async () => {
    await page();
    expect(screen.getByText('Sin vencidos').getAttribute('data-status')).toBe('clear');
    expect(screen.getByText('Sin próximos').getAttribute('data-status')).toBe('next');
    expect(screen.queryByRole('button', { name: 'Sin vencidos' })).toBeNull();
  });
  it('unavailable adjustments do not show reassuring zero labels', async () => {
    responses.rental_contracts = { data: null, error: { message: 'fixture' } };
    await page(); expect(screen.queryByText('Sin vencidos')).toBeNull();
    expect(screen.queryByText('Sin próximos')).toBeNull();
    expect(screen.getAllByText('No disponible')).toHaveLength(3);
  });

  it.each(['admin', 'employee', 'auditor', 'unknown'])('uses real IA role policy for %s', async (role) => {
    session(role); await page(); expect(screen.getByTestId('capability').getAttribute('data-ai')).toBe(String(role === 'admin' || role === 'employee'));
  });
  it('unauthenticated users redirect before queries', async () => {
    auth.mockResolvedValue({ user: null, profile: null }); await expect(CopilotoPage()).rejects.toThrow('redirect:/login'); expect(db).not.toHaveBeenCalled();
  });
  it('missing profile redirects before queries', async () => {
    auth.mockResolvedValue({ user: { id: 'fixture' }, profile: null } as never); await expect(CopilotoPage()).rejects.toThrow('redirect:/onboarding'); expect(db).not.toHaveBeenCalled();
  });
  it('client access is still denied', async () => {
    session('client'); await expect(CopilotoPage()).rejects.toThrow('redirect:/acceso-denegado'); expect(industry).not.toHaveBeenCalled(); expect(db).not.toHaveBeenCalled();
  });
  it.each(['legal', 'escribania'] as const)('other vertical %s redirects before portfolio data', async (name) => {
    industry.mockResolvedValue(name); await expect(CopilotoPage()).rejects.toThrow('redirect:/dashboard'); expect(db).not.toHaveBeenCalled();
  });
  it('industry error redirects before portfolio queries', async () => {
    industry.mockRejectedValue(new Error('fixture')); await expect(CopilotoPage()).rejects.toThrow('redirect:/dashboard'); expect(db).not.toHaveBeenCalled();
  });
  it('preserves query scope and does not claim active operations', async () => {
    await page(); expect(from.mock.calls.map(([t]) => t)).toEqual(['properties', 'cases', 'clients', 'rental_contracts']);
    for (const t of ['properties', 'cases', 'clients', 'rental_contracts']) expect(scopes).toHaveBeenCalledWith(t, 'organization_id', 'fixture-org');
    expect(archived.mock.calls).toEqual([['properties', 'archived_at', null], ['clients', 'archived_at', null], ['rental_contracts', 'archived_at', null]]);
    expect(selects.mock.calls).toEqual([['properties', 'id'], ['cases', 'id'], ['clients', 'id'], ['rental_contracts', '*']]);
    expect(metric('Operaciones').getByText('Todos los estados')).toBeTruthy(); expect(metric('Operaciones').getByText('1')).toBeTruthy();
    expect(screen.queryByText(/operaciones activas/i)).toBeNull(); expect(fetch).not.toHaveBeenCalled();
  });
  it('has real module links and no fixture contract rows', async () => {
    await page(); for (const [label, href] of [['Ver propiedades', '/propiedades'], ['Ver operaciones', '/operaciones'], ['Ver clientes', '/clientes']]) expect(screen.getByRole('link', { name: label }).getAttribute('href')).toBe(href);
    for (const a of screen.getAllByRole('link', { name: 'Ver alquileres' })) expect(a.getAttribute('href')).toBe('/alquileres');
    expect(screen.queryByText(/DEMO-/)).toBeNull(); expect(screen.queryByRole('link', { name: 'Abrir alquiler' })).toBeNull();
  });
  it('confirmed empty responses display zero, not unavailable', async () => {
    await page(); expect(metric('Clientes').getByText('0')).toBeTruthy(); expect(metric('Alquileres').getByText('0')).toBeTruthy(); expect(screen.queryByText('No disponible')).toBeNull();
  });
  it.each(['properties', 'cases', 'clients'])('error for %s is unavailable, not zero', async (table) => {
    responses[table] = { data: [], error: { message: 'Internal fixture detail' } }; await page();
    const names: Record<string, string> = { properties: 'Propiedades', cases: 'Operaciones', clients: 'Clientes' };
    expect(metric(names[table]).getByText('No disponible')).toBeTruthy(); expect(metric(names[table]).queryByText('0')).toBeNull(); expect(screen.queryByText('Internal fixture detail')).toBeNull();
  });
  it('rental error keeps both adjustment counts unavailable', async () => {
    responses.rental_contracts = { data: null, error: { message: 'fixture' } }; await page();
    expect(metric('Alquileres').getByText('No disponible')).toBeTruthy(); expect(screen.getAllByText('Recuento no disponible')).toHaveLength(2); expect(screen.getByRole('status').textContent).toContain('No pudimos cargar');
  });
  it('null data without an explicit error is not a confirmed zero', async () => {
    responses.properties = { data: null, error: null }; await page(); expect(metric('Propiedades').getByText('No disponible')).toBeTruthy();
  });
  it('preserves existing adjustment classification without sending contracts to IA client', async () => {
    const rental = { status: 'vigente', start_date: '2026-09-06T12:00:00Z', last_adjustment_date: null, adjustment_period_months: 1 };
    responses.rental_contracts.data = [rental, { ...rental, start_date: '2026-09-11T12:00:00Z' }, { ...rental, start_date: '2026-09-21T12:00:00Z' }, { ...rental, status: 'finalizado' }];
    await page(); expect(metric('Alquileres').getByText('4')).toBeTruthy();
    const late = screen.getByRole('heading', { name: 'Ajustes vencidos' }).parentElement!.parentElement!;
    const next = screen.getByRole('heading', { name: 'Ajustes próximos' }).parentElement!.parentElement!;
    expect(within(late).getByText('1')).toBeTruthy(); expect(within(next).getByText('2')).toBeTruthy();
    expect(screen.getByTestId('capability').attributes.length).toBe(2);
  });
});


describe('Panel date-only calendar regression', () => {
  it.each(['2026-02-28T02:59:59Z', '2026-02-28T03:00:00Z'])('keeps clamped February date upcoming on %s', async instant => {
    vi.setSystemTime(new Date(instant));
    responses.rental_contracts.data = [{ status: 'vigente', start_date: '2026-01-31', last_adjustment_date: null, adjustment_period_months: 1 }];
    await page();
    const late = screen.getByRole('heading', { name: 'Ajustes vencidos' }).parentElement!.parentElement!;
    const next = screen.getByRole('heading', { name: 'Ajustes próximos' }).parentElement!.parentElement!;
    expect(within(late).getByText('0')).toBeTruthy(); expect(within(next).getByText('1')).toBeTruthy();
    expect(fetch).not.toHaveBeenCalled();
  });
});
