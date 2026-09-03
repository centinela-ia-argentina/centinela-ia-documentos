import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));
vi.mock('@/lib/auth/getUserProfile', () => ({
  getUserProfile: vi.fn(),
}));
vi.mock('@/lib/auth/getStrictIndustry', () => ({
  getStrictIndustryForOrganization: vi.fn(),
}));
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}));

import { ejecutarAccionAgenteInner } from './agenteActions';
import { getUserProfile } from '@/lib/auth/getUserProfile';
import { getStrictIndustryForOrganization } from '@/lib/auth/getStrictIndustry';
import { createClient } from '@/lib/supabase/server';
import { getWritableCaseStatuses } from '@/lib/industries/caseConfig';

describe('T-AUD-P2-016: Validación estricta y fail-closed de cambiar_estado en el Agente', () => {
  const mockUpdate = vi.fn().mockReturnThis();
  const mockEq = vi.fn().mockReturnThis();

  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(getUserProfile).mockResolvedValue({
      user: { id: 'admin-1' },
      profile: {
        id: 'admin-1',
        organization_id: 'org-test',
        role: 'admin',
      },
    } as any);

    vi.mocked(getStrictIndustryForOrganization).mockResolvedValue('legal');

    mockUpdate.mockImplementation(() => ({
      eq: vi.fn().mockImplementation(() => ({
        eq: vi.fn().mockResolvedValue({ error: null }),
      })),
    }));

    vi.mocked(createClient).mockResolvedValue({
      from: (table: string) => {
        if (table === 'cases') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: { id: 'case-1' },
                    error: null,
                  }),
                }),
              }),
            }),
            update: mockUpdate,
          };
        }
        return {};
      },
    } as any);
  });

  it('1. Acepta todos los estados canónicos válidos definidos por getWritableCaseStatuses para la industria', async () => {
    const validStatuses = getWritableCaseStatuses('legal');
    expect(validStatuses).toEqual(['new', 'active', 'in_review', 'waiting_client', 'archived']);

    for (const estado of validStatuses) {
      const res = await ejecutarAccionAgenteInner({
        caseId: 'case-1',
        accion: {
          tipo: 'cambiar_estado',
          titulo: `Cambiar a ${estado}`,
          motivo: 'Actualización procesal',
          estado,
        },
      });

      expect(res.ok).toBe(true);
      expect(mockUpdate).toHaveBeenCalledWith({ status: estado });
    }
  });

  it('2. Rechaza estados legacy en español: activo, archivado, nuevo, en tramite, en trámite, esperando cliente', async () => {
    const legacyStatuses = [
      'activo',
      'archivado',
      'nuevo',
      'en tramite',
      'en trámite',
      'esperando cliente',
    ];

    for (const legacy of legacyStatuses) {
      mockUpdate.mockClear();

      const res = await ejecutarAccionAgenteInner({
        caseId: 'case-1',
        accion: {
          tipo: 'cambiar_estado',
          titulo: `Cambiar a ${legacy}`,
          motivo: 'Actualización procesal',
          estado: legacy,
        },
      });

      expect(res.ok).toBe(false);
      expect(res.mensaje).toBe('El estado propuesto no es válido para este rubro.');
      expect(mockUpdate).not.toHaveBeenCalled();
    }
  });

  it('3. Rechaza cualquier payload inválido o vacío y no ejecuta update', async () => {
    const invalidPayloads = ['', '   ', 'inventado', 'pending', 'deleted', null, undefined];

    for (const invalid of invalidPayloads) {
      mockUpdate.mockClear();

      const res = await ejecutarAccionAgenteInner({
        caseId: 'case-1',
        accion: {
          tipo: 'cambiar_estado',
          titulo: 'Cambiar inválido',
          motivo: 'Actualización procesal',
          estado: invalid as any,
        },
      });

      expect(res.ok).toBe(false);
      expect(mockUpdate).not.toHaveBeenCalled();
    }
  });

  it('4. Falla cerrado inmediatamente si la organización no tiene industria válida habilitada', async () => {
    vi.mocked(getStrictIndustryForOrganization).mockRejectedValue(
      new Error('Organization has no industry assigned or organization not found')
    );

    const res = await ejecutarAccionAgenteInner({
      caseId: 'case-1',
      accion: {
        tipo: 'cambiar_estado',
        titulo: 'Cambiar a active',
        motivo: 'Actualización procesal',
        estado: 'active',
      },
    });

    expect(res.ok).toBe(false);
    expect(res.mensaje).toContain('La industria no está habilitada');
    expect(mockUpdate).not.toHaveBeenCalled();
  });
});
