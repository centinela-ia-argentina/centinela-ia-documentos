/** @vitest-environment jsdom */
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
vi.mock('next/navigation', () => ({ redirect: vi.fn((path: string) => { throw new Error(`redirect:${path}`); }) }));
vi.mock('@/lib/auth/getUserProfile', () => ({ getUserProfile: vi.fn() }));
vi.mock('@/components/layout/AppShell', () => ({ AppShell: ({ children }: { children: React.ReactNode }) => React.createElement('main', null, children) }));
vi.mock('./NewPropertyForm', () => ({ NewPropertyForm: () => React.createElement('h1', null, 'Creation form') }));
import { getUserProfile } from '@/lib/auth/getUserProfile';
import Page from './page';
function auth(role = 'admin') { vi.mocked(getUserProfile).mockResolvedValue({ user: { id: 'fixture' }, profile: { role, organization_id: 'fixture-org' } } as never); }
beforeEach(() => { vi.clearAllMocks(); auth(); }); afterEach(cleanup);
describe('unchanged new property page entry permissions', () => {
  it.each(['admin', 'employee'])('shows form for %s', async role => { auth(role); render(await Page()); expect(screen.getByRole('heading', { name: 'Creation form' })).toBeTruthy(); });
  it.each(['client', 'auditor', 'unknown'])('returns %s to list', async role => { auth(role); await expect(Page()).rejects.toThrow('redirect:/propiedades'); });
  it('keeps unauthenticated redirect', async () => { vi.mocked(getUserProfile).mockResolvedValue({ user: null, profile: null }); await expect(Page()).rejects.toThrow('redirect:/login'); });
  it('keeps missing profile redirect', async () => { vi.mocked(getUserProfile).mockResolvedValue({ user: { id: 'fixture' }, profile: null } as never); await expect(Page()).rejects.toThrow('redirect:/onboarding'); });
});
