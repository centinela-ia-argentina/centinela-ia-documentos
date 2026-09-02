import { describe, it, expect, vi, beforeEach } from 'vitest';
import { canUseAi } from '@/lib/permissions/roles';
import { extraerDatosParaModelo, redactarEscritoIA } from './actions';

vi.mock('server-only', () => ({}));
vi.mock('@/lib/auth/getUserProfile', () => ({
  getUserProfile: vi.fn(),
}));
vi.mock('@/lib/auth/getStrictIndustry', () => ({
  getStrictIndustryForOrganization: vi.fn().mockResolvedValue('legal'),
}));
vi.mock('@/lib/audit/createAuditLog', () => ({
  createAuditLog: vi.fn(),
}));
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}));

import { getUserProfile } from '@/lib/auth/getUserProfile';
import { createClient } from '@/lib/supabase/server';

describe('T-AUD-P2-015: Controles de IA para Rol Auditor en Modelos', () => {
  const globalFetchMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = globalFetchMock;
    process.env.GEMINI_API_KEY = 'test-key';
  });

  it('1. canUseAi bloquea auditor y client, pero autoriza admin y employee', () => {
    expect(canUseAi('auditor')).toBe(false);
    expect(canUseAi('client')).toBe(false);
    expect(canUseAi('admin')).toBe(true);
    expect(canUseAi('employee')).toBe(true);
  });

  it('2. Rol auditor es rechazado en extraerDatosParaModelo sin llamar a fetch ni a la DB', async () => {
    vi.mocked(getUserProfile).mockResolvedValue({
      user: { id: 'user-auditor' },
      profile: {
        id: 'user-auditor',
        organization_id: 'org-1',
        role: 'auditor',
      },
    } as any);

    const res = await extraerDatosParaModelo('case-1', 'demanda-laboral-despido');
    expect(res).toEqual({});
    expect(createClient).not.toHaveBeenCalled();
    expect(globalFetchMock).not.toHaveBeenCalled();
  });

  it('3. Rol auditor es rechazado en redactarEscritoIA con motivo sin_permiso sin llamar a fetch', async () => {
    vi.mocked(getUserProfile).mockResolvedValue({
      user: { id: 'user-auditor' },
      profile: {
        id: 'user-auditor',
        organization_id: 'org-1',
        role: 'auditor',
      },
    } as any);

    const res = await redactarEscritoIA({
      titulo: 'Test Escrito',
      cuerpo: 'Cuerpo base del escrito',
      valores: {},
      instruccion: 'Redactar con IA',
    });

    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.motivo).toBe('sin_permiso');
    }
    expect(globalFetchMock).not.toHaveBeenCalled();
  });

  it('4. Rol admin autorizado conserva acceso operativo completo a redactarEscritoIA', async () => {
    vi.mocked(getUserProfile).mockResolvedValue({
      user: { id: 'user-admin' },
      profile: {
        id: 'user-admin',
        organization_id: 'org-1',
        role: 'admin',
      },
    } as any);

    globalFetchMock.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        candidates: [{ content: { parts: [{ text: 'Escrito generado con éxito por IA' }] } }],
      }),
    });

    const res = await redactarEscritoIA({
      titulo: 'Demanda Laboral',
      cuerpo: 'Cuerpo base',
      valores: { actor: 'Juan Pérez' },
      instruccion: 'Completar hechos',
    });

    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.texto).toContain('Escrito generado');
    }
    expect(globalFetchMock).toHaveBeenCalledTimes(1);
  });
});
