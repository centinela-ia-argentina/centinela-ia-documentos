import { describe, it, expect, vi, beforeEach } from 'vitest';
import { extraerDatosParaModelo } from './actions';

// Mock dependencias
vi.mock('server-only', () => ({}));
vi.mock('@/lib/auth/getUserProfile', () => ({
  getUserProfile: vi.fn(),
}));

vi.mock('@/lib/audit/createAuditLog', () => ({
  createAuditLog: vi.fn(),
}));

vi.mock('@/lib/auth/getStrictIndustry', () => ({
  getStrictIndustryForOrganization: vi.fn().mockResolvedValue('legal'),
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

  it('7. Admin autorizado ejecuta el flujo normal', async () => {
    const mockOrder = vi.fn().mockResolvedValue({
      data: [{ result_json: { vendedor: "Persona Ficticia", matricula: "TEST-123" } }]
    });
    const mockEq2 = vi.fn().mockReturnValue({ order: mockOrder });
    const mockEq1 = vi.fn().mockReturnValue({ eq: mockEq2 });
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEq1 });
    const mockFrom = vi.fn().mockReturnValue({ select: mockSelect });

    vi.mocked(createClient).mockResolvedValue({ from: mockFrom } as any);

    const mockJsonResponse = {
      candidates: [
        {
          content: {
            parts: [
              {
                text: JSON.stringify({
                  vendedor: "Persona Ficticia",
                  matricula: "TEST-123",
                  campo_vacio: "",
                  campo_numerico: 123
                })
              }
            ]
          }
        }
      ]
    };

    globalFetchMock.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue(mockJsonResponse)
    });

    const result = await runTest({ role: 'admin' });

    expect(createClient).toHaveBeenCalledTimes(1);
    expect(mockFrom).toHaveBeenCalledWith('ai_outputs');
    expect(mockEq1).toHaveBeenCalledWith('case_id', 'case-1');
    expect(mockEq2).toHaveBeenCalledWith('organization_id', 'org-1');

    expect(globalFetchMock).toHaveBeenCalledTimes(1);

    expect(result).toEqual({
      vendedor: "Persona Ficticia",
      matricula: "TEST-123"
    });

    expect(result.campo_vacio).toBeUndefined();
    expect(result.campo_numerico).toBeUndefined();
  });

  it('8. Employee autorizado ejecuta el flujo normal', async () => {
    const mockOrder = vi.fn().mockResolvedValue({
      data: [{ result_json: { comprador: "Empresa S.A." } }]
    });
    const mockEq2 = vi.fn().mockReturnValue({ order: mockOrder });
    const mockEq1 = vi.fn().mockReturnValue({ eq: mockEq2 });
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEq1 });
    const mockFrom = vi.fn().mockReturnValue({ select: mockSelect });

    vi.mocked(createClient).mockResolvedValue({ from: mockFrom } as any);

    const mockJsonResponse = {
      candidates: [
        {
          content: {
            parts: [
              {
                text: JSON.stringify({
                  comprador: "Empresa S.A."
                })
              }
            ]
          }
        }
      ]
    };

    globalFetchMock.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue(mockJsonResponse)
    });

    const result = await runTest({ role: 'employee' });

    expect(createClient).toHaveBeenCalledTimes(1);
    expect(mockFrom).toHaveBeenCalledWith('ai_outputs');

    expect(globalFetchMock).toHaveBeenCalledTimes(1);

    expect(result).toEqual({
      comprador: "Empresa S.A."
    });
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

import { revisarEscritoIA } from './actions';
import { createAuditLog } from '@/lib/audit/createAuditLog';

describe('revisarEscritoIA', () => {

  let mockInsert: any;
  const globalFetchMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = globalFetchMock;
    process.env.GEMINI_API_KEY = 'test-key';

    mockInsert = vi.fn();
    const mockFrom = vi.fn().mockReturnValue({ insert: mockInsert });
    vi.mocked(createClient).mockResolvedValue({ from: mockFrom } as any);
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

    return revisarEscritoIA({ texto: 'Texto de prueba que sea lo suficientemente largo para superar el limite de cuarenta caracteres' });
  };

  it('A. Caso positivo con checklist array (PR #10 post-merge regression)', async () => {
    const mockJsonResponse = {
      candidates: [
        {
          content: {
            parts: [
              {
                text: JSON.stringify({
                  semaforo: "verde",
                  puntuacion: 8,
                  errores: [],
                  datos_incompletos: [],
                  sugerencias: [],
                  checklist: [
                    { item: "Firma", ok: true },
                    { item: "Fecha", ok: false }
                  ]
                })
              }
            ]
          }
        }
      ]
    };

    globalFetchMock.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue(mockJsonResponse)
    });




    const result = await runTest({ industry_type: 'legal' });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.revision.checklist).toHaveLength(2);
      expect(result.revision.checklist[0]).toEqual({ item: "Firma", ok: true });
      expect(result.revision.checklist[1]).toEqual({ item: "Fecha", ok: false });
    }

    expect(globalFetchMock).toHaveBeenCalledTimes(1);
    expect(mockInsert).toHaveBeenCalledTimes(1);
  });

  it('B. Caso límite sin array en checklist', async () => {
    const mockJsonResponse = {
      candidates: [
        {
          content: {
            parts: [
              {
                text: JSON.stringify({
                  semaforo: "verde",
                  puntuacion: 8,
                  errores: [],
                  datos_incompletos: [],
                  sugerencias: [],
                  checklist: "no soy un array"
                })
              }
            ]
          }
        }
      ]
    };

    globalFetchMock.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue(mockJsonResponse)
    });

    const result = await runTest({ industry_type: 'legal' });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.revision.checklist).toEqual([]);
    }
  });
});
