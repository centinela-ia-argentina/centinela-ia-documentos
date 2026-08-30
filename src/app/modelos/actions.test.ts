import { describe, it, expect, vi, beforeEach } from 'vitest';
import { extraerDatosParaModelo } from './actions';

// Mock dependencias
vi.mock('server-only', () => ({}));
vi.mock('@/lib/auth/getUserProfile', () => ({
  getUserProfile: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}));

import { createClient } from '@/lib/supabase/server';

describe('extraerDatosParaModelo', () => {
  const globalFetchMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = globalFetchMock;
    
    // Configurar API Key por defecto para que no falle por esto prematuramente
    process.env.GEMINI_API_KEY = 'test-key';
  });

  const runTest = async (profileOverrides: any) => {
    const { getUserProfile } = await import('@/lib/auth/getUserProfile');
    vi.mocked(getUserProfile).mockResolvedValue({
      user: { id: 'user-1' },
      profile: {
        id: 'user-1',
        organization_id: 'org-1',
        role: 'admin',
        ...profileOverrides
      },
    } as any);

    return extraerDatosParaModelo('case-1');
  };

  it('1. Sin usuario devuelve {} y no llama a fetch ni supabase', async () => {
    const { getUserProfile } = await import('@/lib/auth/getUserProfile');
    vi.mocked(getUserProfile).mockResolvedValue({ user: null, profile: null });

    const result = await extraerDatosParaModelo('case-1');
    expect(result).toEqual({});
    expect(createClient).not.toHaveBeenCalled();
    expect(globalFetchMock).not.toHaveBeenCalled();
  });

  it('2. Sin profile devuelve {} y no llama a fetch ni supabase', async () => {
    const { getUserProfile } = await import('@/lib/auth/getUserProfile');
    vi.mocked(getUserProfile).mockResolvedValue({ user: { id: 'u' }, profile: null } as any);

    const result = await extraerDatosParaModelo('case-1');
    expect(result).toEqual({});
    expect(createClient).not.toHaveBeenCalled();
    expect(globalFetchMock).not.toHaveBeenCalled();
  });

  it('3. Sin organization_id devuelve {} y no llama a fetch ni supabase', async () => {
    const result = await runTest({ organization_id: null });
    expect(result).toEqual({});
    expect(createClient).not.toHaveBeenCalled();
    expect(globalFetchMock).not.toHaveBeenCalled();
  });

  it('4. Rol auditor devuelve {} (canUseAi false)', async () => {
    const result = await runTest({ role: 'auditor' });
    expect(result).toEqual({});
    expect(createClient).not.toHaveBeenCalled();
    expect(globalFetchMock).not.toHaveBeenCalled();
  });

  it('5. Rol client devuelve {} (canUseAi false)', async () => {
    const result = await runTest({ role: 'client' });
    expect(result).toEqual({});
    expect(createClient).not.toHaveBeenCalled();
    expect(globalFetchMock).not.toHaveBeenCalled();
  });

  it('6. Rol desconocido devuelve {} (fail-closed)', async () => {
    const result = await runTest({ role: 'unknown_role' });
    expect(result).toEqual({});
    expect(createClient).not.toHaveBeenCalled();
    expect(globalFetchMock).not.toHaveBeenCalled();
  });

  it('7. Admin autorizado ejecuta el flujo normal (aunque haya DB vacía)', async () => {
    const mockOrder = vi.fn().mockResolvedValue({ data: [] });
    const mockEq2 = vi.fn().mockReturnValue({ order: mockOrder });
    const mockEq1 = vi.fn().mockReturnValue({ eq: mockEq2 });
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEq1 });
    const mockFrom = vi.fn().mockReturnValue({ select: mockSelect });

    vi.mocked(createClient).mockResolvedValue({ from: mockFrom } as any);

    await runTest({ role: 'admin' });

    expect(createClient).toHaveBeenCalled();
    expect(mockFrom).toHaveBeenCalledWith('ai_outputs');
    expect(mockEq1).toHaveBeenCalledWith('case_id', 'case-1');
    expect(mockEq2).toHaveBeenCalledWith('organization_id', 'org-1');
  });

  it('8. Employee autorizado ejecuta el flujo normal', async () => {
    const mockOrder = vi.fn().mockResolvedValue({ data: [] });
    const mockEq2 = vi.fn().mockReturnValue({ order: mockOrder });
    const mockEq1 = vi.fn().mockReturnValue({ eq: mockEq2 });
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEq1 });
    const mockFrom = vi.fn().mockReturnValue({ select: mockSelect });

    vi.mocked(createClient).mockResolvedValue({ from: mockFrom } as any);

    await runTest({ role: 'employee' });

    expect(createClient).toHaveBeenCalled();
    expect(mockFrom).toHaveBeenCalledWith('ai_outputs');
  });

  it('9. Sin GEMINI_API_KEY para rol autorizado devuelve {} y no llama a fetch', async () => {
    process.env.GEMINI_API_KEY = '';
    
    const mockOrder = vi.fn().mockResolvedValue({ data: [{ result_json: { test: '1' } }] });
    const mockEq2 = vi.fn().mockReturnValue({ order: mockOrder });
    const mockEq1 = vi.fn().mockReturnValue({ eq: mockEq2 });
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEq1 });
    const mockFrom = vi.fn().mockReturnValue({ select: mockSelect });

    vi.mocked(createClient).mockResolvedValue({ from: mockFrom } as any);

    const result = await runTest({ role: 'admin' });
    expect(result).toEqual({});
    expect(createClient).toHaveBeenCalled(); // llega a la base pero se corta después
    expect(globalFetchMock).not.toHaveBeenCalled();
  });
});
