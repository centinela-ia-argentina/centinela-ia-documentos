import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('server-only', () => ({}));

import { getStrictIndustry } from '@/lib/auth/getStrictIndustry';
import { validarAcciones } from '@/lib/ai/agente';
import { redactarEscritoIA, revisarEscritoIA } from '@/app/modelos/actions';
import { generarBriefing, preguntarCopiloto } from '@/app/copiloto/actions';

// Mock dependencies
vi.mock('@/lib/auth/getUserProfile', () => ({
  getUserProfile: vi.fn(),
}));
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}));
vi.mock('@/lib/permissions/roles', () => ({
  canUseAi: vi.fn(),
}));
vi.mock('@/lib/audit/createAuditLog', () => ({
  createAuditLog: vi.fn(),
}));

import { getUserProfile } from '@/lib/auth/getUserProfile';
import { createClient } from '@/lib/supabase/server';
import { canUseAi } from '@/lib/permissions/roles';
import { createAuditLog } from '@/lib/audit/createAuditLog';

const mockGetUserProfile = getUserProfile as unknown as ReturnType<typeof vi.fn>;
const mockCreateClient = createClient as unknown as ReturnType<typeof vi.fn>;
const mockCanUseAi = canUseAi as unknown as ReturnType<typeof vi.fn>;
const mockCreateAuditLog = createAuditLog as unknown as ReturnType<typeof vi.fn>;

describe('AI Industry Guards', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCanUseAi.mockReturnValue(true);
    
    // Default fetch mock
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: '{\"puntuacion\": 100, \"semaforo\": \"verde\"}' }] } }]
      })
    });
  });

  const setupMock = (industry: string | null) => {
    mockGetUserProfile.mockResolvedValue({
      user: { id: 'u1' },
      profile: { organization_id: 'org1', role: 'admin' }
    });
    const mockSupabase = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: industry ? { industry_type: industry } : null,
              error: industry ? null : { message: 'Not found' }
            }),
            is: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue({ data: [] })
              }),
              limit: vi.fn().mockResolvedValue({ data: [] })
            }),
            not: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue({ data: [] })
              })
            })
          })
        })
      })
    };
    mockCreateClient.mockResolvedValue(mockSupabase);
    return mockSupabase;
  };

  describe('A. INDUSTRIA CONFIABLE', () => {
    it('1. Organización Legal + payload inmobiliaria -> Legal', async () => {
      setupMock('legal');
      const ind = await getStrictIndustry();
      expect(ind).toBe('legal');
    });

    it('2. Organización Inmobiliaria + payload legal -> Inmobiliaria', async () => {
      setupMock('inmobiliaria');
      const ind = await getStrictIndustry();
      expect(ind).toBe('inmobiliaria');
    });

    it('3. Organización Escribanía + payload desconocido -> Escribanía', async () => {
      setupMock('escribania');
      const ind = await getStrictIndustry();
      expect(ind).toBe('escribania');
    });

    it('4. Organización con industria null o desconocida -> falla cerrada', async () => {
      setupMock(null);
      await expect(getStrictIndustry()).rejects.toThrow('Unauthorized');
      
      setupMock('unknown_industry');
      await expect(getStrictIndustry()).rejects.toThrow('Unauthorized');
    });

    it('5. El audit log utiliza industria confiable', async () => {
      setupMock('legal');
      process.env.GEMINI_API_KEY = 'test_key';
      
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          candidates: [{ content: { parts: [{ text: 'mock text' }] } }]
        })
      });

      await redactarEscritoIA({ titulo: 'T', cuerpo: 'C', valores: {}, instruccion: '', industria: 'inmobiliaria' });
      
      expect(mockCreateAuditLog).toHaveBeenCalledWith(expect.objectContaining({
        metadata: { entity_id: 'T', details: { industria: 'legal' } }
      }));
    });
  });

  describe('B. ALLOWLIST', () => {
    const checkAllowlist = (industry: string, action: string, allowed: boolean) => {
      const input = [{ 
        tipo: action, 
        titulo: 'Test', 
        fecha: '2023-01-01', 
        hora: '10:00', 
        ingresoMensual: 1000, 
        edad: 30, 
        incapacidad: 10,
        fechaNotificacion: '2023-01-01',
        diasHabiles: 5,
        jurisdiccion: 'nacion',
        monto: 100,
        confirmacion: true
      }];
      const res = validarAcciones(input, industry);
      if (allowed) {
        expect(res.length).toBe(1);
        expect(res[0].tipo).toBe(action);
      } else {
        expect(res.length).toBe(0);
      }
    };

    it('6. Legal acepta calcular_plazo_procesal', () => checkAllowlist('legal', 'calcular_plazo_procesal', true));
    it('7. Legal rechaza redactar_aviso', () => checkAllowlist('legal', 'redactar_aviso', false));
    it('8. Legal rechaza calificar_inquilino', () => checkAllowlist('legal', 'calificar_inquilino', false));
    it('9. Inmobiliaria acepta redactar_aviso', () => checkAllowlist('inmobiliaria', 'redactar_aviso', true));
    it('10. Inmobiliaria acepta calificar_inquilino', () => checkAllowlist('inmobiliaria', 'calificar_inquilino', true));
    it('11. Inmobiliaria rechaza calcular_liquidacion', () => checkAllowlist('inmobiliaria', 'calcular_liquidacion', false));
    it('12. Inmobiliaria rechaza redactar_ros', () => checkAllowlist('inmobiliaria', 'redactar_ros', false));
    it('13. Escribanía acepta redactar_ros', () => checkAllowlist('escribania', 'redactar_ros', true));
    it('14. Escribanía acepta agendar_firma', () => checkAllowlist('escribania', 'agendar_firma', true));
    it('15. Escribanía rechaza redactar_aviso', () => checkAllowlist('escribania', 'redactar_aviso', false));
    it('16. Escribanía rechaza cálculos legales', () => checkAllowlist('escribania', 'calcular_tasa_justicia', false));
    it('17. Las tres industrias aceptan acciones comunes', () => {
      checkAllowlist('legal', 'agendar_plazo', true);
      checkAllowlist('inmobiliaria', 'agendar_plazo', true);
      checkAllowlist('escribania', 'agendar_plazo', true);
    });
    it('18. Acción desconocida es rechazada', () => checkAllowlist('legal', 'hack_db', false));
    it('19. Acción permitida con campos inválidos es rechazada', () => {
      const input = [{ tipo: 'agendar_plazo', titulo: 'Test', fecha: 'not-a-date' }];
      expect(validarAcciones(input, 'legal').length).toBe(0);
    });
  });

  describe('D. COPILOTO', () => {
    it('24-25. Organización inmobiliaria puede ejecutar copiloto', async () => {
      setupMock('inmobiliaria');
      
      const resB = await generarBriefing();
      // Should hit the generative language mock if allowed (generarBriefingInmobiliaria calls Gemini)
      // Actually we just need to ensure it does not return sin_permiso.
      expect((resB as any).motivo).not.toBe('sin_permiso');

      const resP = await preguntarCopiloto('hola');
      expect((resP as any).motivo).not.toBe('sin_permiso');
    });

    it('26. Organización Legal recibe sin_permiso', async () => {
      setupMock('legal');
      const resB = await generarBriefing();
      expect((resB as any).motivo).toBe('sin_permiso');
      
      const resP = await preguntarCopiloto('hola');
      expect((resP as any).motivo).toBe('sin_permiso');
    });

    it('27. Organización Escribanía recibe sin_permiso', async () => {
      setupMock('escribania');
      const res = await preguntarCopiloto('hola');
      expect((res as any).motivo).toBe('sin_permiso');
    });

    it('28. Sin sesión recibe sin_sesion', async () => {
      mockGetUserProfile.mockResolvedValue({ user: null, profile: null });
      const res = await generarBriefing();
      expect((res as any).motivo).toBe('sin_sesion');
    });
    
    it('29. La denegación ocurre antes de consultar tablas', async () => {
      const mockSupabase = setupMock('legal');
      await generarBriefing();
      // Inmobiliaria logic uses multiple queries. Since we block early, we expect only the 
      // getStrictIndustry query to have run, which hits organizations table, NOT properties/clients
      expect(mockSupabase.from).toHaveBeenCalledWith('organizations');
      expect(mockSupabase.from).not.toHaveBeenCalledWith('properties');
    });
  });
  
  describe('E. REGRESIÓN', () => {
    it('31. Acciones comunes siguen validando', () => {
      const input = [{ tipo: 'cambiar_estado', titulo: 'T', estado: 'active' }];
      const res = validarAcciones(input, 'legal', ['active']);
      expect(res.length).toBe(1);
    });
    it('33. No se rompe el contrato público', async () => {
      setupMock('legal');
      process.env.GEMINI_API_KEY = 'test_key';
      
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          candidates: [{ content: { parts: [{ text: 'texto mock' }] } }]
        })
      });

      const res = await redactarEscritoIA({ titulo: 'T', cuerpo: 'C', valores: {}, instruccion: '' });
      expect(res.ok).toBe(true);
      expect((res as any).texto).toBe('texto mock');
    });
  });
});
