import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}));
vi.mock('@/lib/auth/getUserProfile', () => ({
  getUserProfile: vi.fn(),
}));
vi.mock('@/lib/audit/createAuditLog', () => ({
  createAuditLog: vi.fn().mockResolvedValue({ ok: true }),
}));

import { editarEventoAgenda } from './actions';
import { createClient } from '@/lib/supabase/server';
import { getUserProfile } from '@/lib/auth/getUserProfile';
import { createAuditLog } from '@/lib/audit/createAuditLog';

describe('Agenda - Edición de Eventos Manuales (Permisos, Persistencia y Aislamiento)', () => {
  let mockSupabase: any;
  let updatePayload: any = null;
  let updateEqs: Record<string, any> = {};
  let selectEqs: Record<string, any> = {};

  beforeEach(() => {
    vi.clearAllMocks();
    updatePayload = null;
    updateEqs = {};
    selectEqs = {};

    vi.mocked(getUserProfile).mockResolvedValue({
      user: { id: 'user-admin-1' } as any,
      profile: { id: 'prof-admin-1', organization_id: 'org-escribania-1', role: 'admin' } as any,
    });

    mockSupabase = {
      from: vi.fn((table: string) => {
        if (table === 'cases') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn((col1: string, val1: string) => ({
                eq: vi.fn((col2: string, val2: string) => ({
                  maybeSingle: vi.fn().mockImplementation(() => {
                    // Solo el legajo case-org-1 existe en org-escribania-1
                    if (val1 === 'case-org-1' && val2 === 'org-escribania-1') {
                      return Promise.resolve({ data: { id: 'case-org-1' }, error: null });
                    }
                    return Promise.resolve({ data: null, error: null });
                  }),
                })),
              })),
            }),
          };
        }
        if (table === 'agenda_plazos') {
          return {
            select: vi.fn().mockImplementation(() => ({
              eq: vi.fn((col1: string, val1: string) => {
                selectEqs[col1] = val1;
                return {
                  eq: vi.fn((col2: string, val2: string) => {
                    selectEqs[col2] = val2;
                    return {
                      maybeSingle: vi.fn().mockImplementation(() => {
                        // Evento 'evt-1' pertenece a 'org-escribania-1'
                        if (val1 === 'evt-1' && val2 === 'org-escribania-1') {
                          return Promise.resolve({ data: { id: 'evt-1', case_id: null }, error: null });
                        }
                        return Promise.resolve({ data: null, error: null });
                      }),
                    };
                  }),
                };
              }),
            })),
            update: vi.fn().mockImplementation((payload: any) => {
              updatePayload = payload;
              return {
                eq: vi.fn((col1: string, val1: string) => {
                  updateEqs[col1] = val1;
                  return {
                    eq: vi.fn((col2: string, val2: string) => {
                      updateEqs[col2] = val2;
                      return {
                        select: vi.fn().mockReturnValue({
                          single: vi.fn().mockResolvedValue({
                            data: { id: 'evt-1' },
                            error: null,
                          }),
                        }),
                      };
                    }),
                  };
                }),
              };
            }),
          };
        }
        return {} as any;
      }),
    };

    vi.mocked(createClient).mockResolvedValue(mockSupabase);
  });

  describe('Permisos y Autorización Server-Side', () => {
    it('1. rechaza si no hay sesión autenticada', async () => {
      vi.mocked(getUserProfile).mockResolvedValueOnce({ user: null, profile: null } as any);
      const res = await editarEventoAgenda({
        id: 'evt-1',
        titulo: 'Nuevo título',
        fecha: '2026-09-15',
      });
      expect(res.ok).toBe(false);
      expect(res.motivo).toBe('no_auth');
    });

    it('2. rechaza si el rol no tiene permisos para actualizar expedientes/agenda (auditor)', async () => {
      vi.mocked(getUserProfile).mockResolvedValueOnce({
        user: { id: 'user-auditor' } as any,
        profile: { id: 'prof-auditor', organization_id: 'org-escribania-1', role: 'auditor' } as any,
      });
      const res = await editarEventoAgenda({
        id: 'evt-1',
        titulo: 'Modificación auditor',
        fecha: '2026-09-15',
      });
      expect(res.ok).toBe(false);
      expect(res.motivo).toBe('no_auth');
      expect(res.mensaje).toContain('Sin permisos');
    });

    it('3. rechaza si el rol es client', async () => {
      vi.mocked(getUserProfile).mockResolvedValueOnce({
        user: { id: 'user-client' } as any,
        profile: { id: 'prof-client', organization_id: 'org-escribania-1', role: 'client' } as any,
      });
      const res = await editarEventoAgenda({
        id: 'evt-1',
        titulo: 'Modificación cliente',
        fecha: '2026-09-15',
      });
      expect(res.ok).toBe(false);
      expect(res.motivo).toBe('no_auth');
    });

    it('4. permite edición para rol employee u operador', async () => {
      vi.mocked(getUserProfile).mockResolvedValueOnce({
        user: { id: 'user-emp' } as any,
        profile: { id: 'prof-emp', organization_id: 'org-escribania-1', role: 'employee' } as any,
      });
      const res = await editarEventoAgenda({
        id: 'evt-1',
        titulo: 'Firma de escritura - López',
        fecha: '2026-09-20',
      });
      expect(res.ok).toBe(true);
    });
  });

  describe('Validación de Inputs y Confirmación de Persistencia', () => {
    it('5. rechaza ID de evento vacío', async () => {
      const res = await editarEventoAgenda({
        id: '   ',
        titulo: 'Válido',
        fecha: '2026-09-20',
      });
      expect(res.ok).toBe(false);
      expect(res.mensaje).toContain('ID de evento');
    });

    it('6. rechaza título vacío', async () => {
      const res = await editarEventoAgenda({
        id: 'evt-1',
        titulo: '   ',
        fecha: '2026-09-20',
      });
      expect(res.ok).toBe(false);
      expect(res.mensaje).toContain('título es obligatorio');
    });

    it('7. rechaza fecha inválida', async () => {
      const res = await editarEventoAgenda({
        id: 'evt-1',
        titulo: 'Audiencia',
        fecha: 'fecha-invalida',
      });
      expect(res.ok).toBe(false);
      expect(res.mensaje).toContain('Fecha inválida');
    });

    it('8. rechaza hora inválida fuera del formato HH:MM', async () => {
      const res = await editarEventoAgenda({
        id: 'evt-1',
        titulo: 'Audiencia',
        fecha: '2026-09-20',
        hora: '25:99',
      });
      expect(res.ok).toBe(false);
      expect(res.mensaje).toBeDefined();
    });

    it('9. rechaza asociar un caseId de otra organización', async () => {
      const res = await editarEventoAgenda({
        id: 'evt-1',
        titulo: 'Firma de boleto',
        fecha: '2026-09-20',
        caseId: 'case-otra-org-999',
      });
      expect(res.ok).toBe(false);
      expect(res.mensaje).toContain('Expediente no encontrado o sin acceso');
    });
  });

  describe('Persistencia Real, Auditoría y Aislamiento Organizacional', () => {
    it('10. no encuentra evento si pertenece a otra organización (aislamiento multi-tenant)', async () => {
      const res = await editarEventoAgenda({
        id: 'evt-otra-org-77',
        titulo: 'Intento de modificar evento ajeno',
        fecha: '2026-09-20',
      });
      expect(res.ok).toBe(false);
      expect(res.motivo).toBe('no_encontrado');
      expect(selectEqs['organization_id']).toBe('org-escribania-1');
    });

    it('11. actualiza exitosamente título, fecha, hora, categoría, detalle y caseId', async () => {
      const res = await editarEventoAgenda({
        id: 'evt-1',
        titulo: 'Firma de protocolización de compraventa',
        fecha: '2026-09-25',
        hora: '11:30',
        categoria: 'firma',
        detalle: 'Comparece comprador con poder especial.',
        caseId: 'case-org-1',
      });

      expect(res.ok).toBe(true);

      // Verificación de los datos persistidos
      expect(updatePayload).toEqual({
        titulo: 'Firma de protocolización de compraventa',
        fecha: '2026-09-25',
        hora: '11:30',
        categoria: 'firma',
        detalle: 'Comparece comprador con poder especial.',
        case_id: 'case-org-1',
      });

      // Verificación de aislamiento en la cláusula where del update
      expect(updateEqs['id']).toBe('evt-1');
      expect(updateEqs['organization_id']).toBe('org-escribania-1');

      // Verificación de evento de auditoría
      expect(createAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationId: 'org-escribania-1',
          userId: 'user-admin-1',
          action: 'agenda_event_updated',
          resourceType: 'case',
          resourceId: 'case-org-1',
          metadata: expect.objectContaining({
            id: 'evt-1',
            titulo: 'Firma de protocolización de compraventa',
            fecha: '2026-09-25',
            hora: '11:30',
            categoria: 'firma',
            caseId: 'case-org-1',
          }),
        })
      );
    });

    it('12. actualiza evento sin caseId asociando auditoría a la organización', async () => {
      const res = await editarEventoAgenda({
        id: 'evt-1',
        titulo: 'Reunión de equipo notarial',
        fecha: '2026-09-28',
        hora: '16:00',
        categoria: 'turno',
        caseId: null,
      });

      expect(res.ok).toBe(true);
      expect(updatePayload.case_id).toBeNull();

      expect(createAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'agenda_event_updated',
          resourceType: 'organization',
          resourceId: 'org-escribania-1',
        })
      );
    });
  });
});
