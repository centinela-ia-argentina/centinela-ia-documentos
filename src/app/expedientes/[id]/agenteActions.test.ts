import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ejecutarAccionAgenteInner } from './agenteActions';
import { getUserProfile } from '@/lib/auth/getUserProfile';
import { getStrictIndustryForOrganization } from '@/lib/auth/getStrictIndustry';
import { canUseAi } from '@/lib/permissions/roles';
import { redactarBorradorInmobiliaria, redactarEscrituraExpediente } from '@/app/expedientes/actions';

vi.mock('server-only', () => ({}));
vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

const { mockMaybeSingle } = vi.hoisted(() => {
  return { mockMaybeSingle: vi.fn() };
});

vi.mock('@/lib/supabase/server', () => {
  const eqMock = vi.fn();
  eqMock.mockReturnValue({ eq: eqMock, maybeSingle: mockMaybeSingle });
  
  return {
    createClient: vi.fn().mockResolvedValue({
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: eqMock
        })
      }),
    }),
  };
});

vi.mock('@/lib/auth/getUserProfile', () => ({
  getUserProfile: vi.fn(),
}));

vi.mock('@/lib/auth/getStrictIndustry', () => ({
  getStrictIndustryForOrganization: vi.fn(),
}));

vi.mock('@/lib/permissions/roles', () => ({
  canUseAi: vi.fn(),
  isUserRole: vi.fn().mockReturnValue(true),
}));

vi.mock('@/app/expedientes/actions', () => ({
  redactarBorradorInmobiliaria: vi.fn().mockResolvedValue({}),
  redactarEscrituraExpediente: vi.fn().mockResolvedValue({}),
}));

describe('ejecutarAccionAgenteInner - redactar_borrador', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const setupMock = (role: string, industry: string, canAi: boolean = true) => {
    vi.mocked(getUserProfile).mockResolvedValue({
      user: { id: 'u1' } as any,
      profile: { organization_id: 'org1', role } as any,
    });
    vi.mocked(canUseAi).mockReturnValue(canAi);
    vi.mocked(getStrictIndustryForOrganization).mockResolvedValue(industry as any);
    mockMaybeSingle.mockResolvedValue({ data: { industry_type: industry } });
  };

  it('A. Jurídico autorizado (legal)', async () => {
    setupMock('admin', 'legal');
    const result = await ejecutarAccionAgenteInner({ caseId: 'case1', accion: { tipo: 'redactar_borrador' as any, titulo: '', motivo: '' } });
    
    expect(result.ok).toBe(false);
    if ('mensaje' in result) {
      expect(result.mensaje).toContain('Modelos de escritos');
    }
    expect(redactarBorradorInmobiliaria).not.toHaveBeenCalled();
    expect(redactarEscrituraExpediente).not.toHaveBeenCalled();
  });

  it('B. Escribanía autorizada', async () => {
    setupMock('admin', 'escribania');
    const result = await ejecutarAccionAgenteInner({ caseId: 'case1', accion: { tipo: 'redactar_borrador' as any, titulo: '', motivo: '' } });
    
    expect(result.ok).toBe(true);
    expect(redactarEscrituraExpediente).toHaveBeenCalledTimes(1);
    expect(redactarBorradorInmobiliaria).not.toHaveBeenCalled();
  });

  it('C. Inmobiliaria autorizada', async () => {
    setupMock('admin', 'inmobiliaria');
    const result = await ejecutarAccionAgenteInner({ caseId: 'case1', accion: { tipo: 'redactar_borrador' as any, titulo: '', motivo: '' } });
    
    expect(result.ok).toBe(true);
    expect(redactarBorradorInmobiliaria).toHaveBeenCalledTimes(1);
    expect(redactarEscrituraExpediente).not.toHaveBeenCalled();
  });

  it('D. Industria ausente o desconocida', async () => {
    setupMock('admin', 'unknown');
    const result = await ejecutarAccionAgenteInner({ caseId: 'case1', accion: { tipo: 'redactar_borrador' as any, titulo: '', motivo: '' } });
    
    expect(result.ok).toBe(false);
    if ('mensaje' in result) {
      expect(result.mensaje).toContain('La industria no está habilitada');
    }
    expect(redactarBorradorInmobiliaria).not.toHaveBeenCalled();
    expect(redactarEscrituraExpediente).not.toHaveBeenCalled();
  });

  it('E. Rol sin canUseAi', async () => {
    setupMock('client', 'inmobiliaria', false);
    const result = await ejecutarAccionAgenteInner({ caseId: 'case1', accion: { tipo: 'redactar_borrador' as any, titulo: '', motivo: '' } });
    
    expect(result.ok).toBe(false);
    if ('mensaje' in result) {
      expect(result.mensaje).toContain('Sin permiso para usar la IA');
    }
    expect(redactarBorradorInmobiliaria).not.toHaveBeenCalled();
    expect(redactarEscrituraExpediente).not.toHaveBeenCalled();
  });
});
