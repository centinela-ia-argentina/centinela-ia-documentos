import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

vi.mock('@/lib/auth/getUserProfile', () => ({
  getUserProfile: vi.fn(),
}));

vi.mock('@/lib/auth/getStrictIndustry', () => ({
  getStrictIndustryForOrganization: vi.fn().mockResolvedValue('legal'),
}));

vi.mock('@/lib/permissions/roles', () => ({
  canUseAi: vi.fn().mockReturnValue(true),
  isUserRole: vi.fn().mockReturnValue(true),
}));

vi.mock('@/lib/audit/createAuditLog', () => ({
  createAuditLog: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/ai/agente', () => ({
  responderAgenteLegajo: vi.fn().mockResolvedValue({
    ok: true,
    respuesta: 'Esta es una respuesta generada por el Agente IA.',
    acciones: [],
  }),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}));

import { preguntarAgente } from './agenteActions';
import { createClient } from '@/lib/supabase/server';
import { getUserProfile } from '@/lib/auth/getUserProfile';
import { createAuditLog } from '@/lib/audit/createAuditLog';

describe('T-AUD-P2-017: Observabilidad ante fallos de persistencia de memoria del Agente', () => {
  const mockInsert = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(getUserProfile).mockResolvedValue({
      user: { id: 'user-1' },
      profile: { organization_id: 'org-1', role: 'admin' },
    } as any);

    const createQueryProxy = (): any => {
      const target: any = {
        then: (resolve: any) => resolve({ data: [], error: null }),
      };
      return new Proxy(target, {
        get: (_t, prop) => {
          if (prop === 'then') return target.then;
          if (prop === 'single') {
            return () =>
              Promise.resolve({
                data: { id: 'case-1', title: 'Caso Test', case_type: 'Demanda', status: 'active' },
                error: null,
              });
          }
          if (prop === 'maybeSingle') {
            return () => Promise.resolve({ data: null, error: null });
          }
          return () => createQueryProxy();
        },
      });
    };

    const mockFrom = vi.fn().mockImplementation((table: string) => {
      if (table === 'agent_messages') {
        return {
          insert: mockInsert,
        };
      }
      return createQueryProxy();
    });

    vi.mocked(createClient).mockResolvedValue({
      from: mockFrom,
    } as any);
  });

  it('1. Éxito de persistencia: devuelve ok: true, memoryPersisted: true y no emite log de error', async () => {
    mockInsert.mockResolvedValue({ error: null });

    const res = await preguntarAgente({
      caseId: 'case-1',
      pregunta: '¿Cuál es el estado del trámite?',
      historial: [],
    });

    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.respuesta).toBe('Esta es una respuesta generada por el Agente IA.');
      expect(res.memoryPersisted).toBe(true);
    }

    expect(createAuditLog).not.toHaveBeenCalledWith(
      expect.objectContaining({ action: 'AI_AGENT_MEMORY_ERROR' })
    );
  });

  it('2. Fallo de persistencia (error en insert): no rompe la respuesta, emite AI_AGENT_MEMORY_ERROR con motivo estático sanitizado y devuelve memoryPersisted: false', async () => {
    mockInsert.mockResolvedValue({
      error: { code: '23505', message: 'duplicate key value violates unique constraint' },
    });

    const res = await preguntarAgente({
      caseId: 'case-1',
      pregunta: '¿Hay algún vencimiento pendiente?',
      historial: [],
    });

    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.respuesta).toBe('Esta es una respuesta generada por el Agente IA.');
      expect(res.memoryPersisted).toBe(false);
    }

    expect(createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: 'org-1',
        userId: 'user-1',
        action: 'AI_AGENT_MEMORY_ERROR',
        resourceType: 'case',
        resourceId: 'case-1',
        metadata: expect.objectContaining({
          caseId: 'case-1',
          errorCode: '23505',
          motivo: 'duplicate_key',
        }),
      })
    );

    // Verificar que el log no guarda el mensaje crudo de PostgreSQL
    const memoryCall = vi.mocked(createAuditLog).mock.calls.find((c) => (c[0] as any).action === 'AI_AGENT_MEMORY_ERROR');
    expect(memoryCall).toBeDefined();
    const loggedDetails = (memoryCall![0] as any).metadata;
    expect(JSON.stringify(loggedDetails)).not.toContain('duplicate key value violates unique constraint');
    expect(JSON.stringify(loggedDetails)).not.toContain('¿Hay algún vencimiento pendiente?');
  });

  it('3. Fallo por excepción en insert: registra AI_AGENT_MEMORY_ERROR con motivo sanitizado y no rompe respuesta', async () => {
    mockInsert.mockRejectedValue(new Error('Network timeout in PostgreSQL connection'));

    const res = await preguntarAgente({
      caseId: 'case-1',
      pregunta: '¿Cuándo vence el plazo?',
      historial: [],
    });

    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.respuesta).toBe('Esta es una respuesta generada por el Agente IA.');
      expect(res.memoryPersisted).toBe(false);
    }

    expect(createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'AI_AGENT_MEMORY_ERROR',
        metadata: expect.objectContaining({
          errorCode: 'EXCEPTION',
          motivo: 'unexpected_persistence_exception',
        }),
      })
    );

    const memoryCall = vi.mocked(createAuditLog).mock.calls.find((c) => (c[0] as any).action === 'AI_AGENT_MEMORY_ERROR');
    const loggedDetails = (memoryCall![0] as any).metadata;
    expect(JSON.stringify(loggedDetails)).not.toContain('Network timeout in PostgreSQL connection');
  });
});
