import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getWritableCaseStatuses } from '@/lib/industries/caseConfig';

vi.mock('server-only', () => ({}));
vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));
vi.mock('next/navigation', () => ({
  redirect: vi.fn().mockImplementation((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
  revalidatePath: vi.fn(),
}));
vi.mock('@/lib/permissions/roles', async (importOriginal) => {
  const actual = await importOriginal<any>();
  return {
    ...actual,
    canCreateCase: vi.fn().mockReturnValue(true),
    canUpdateCase: vi.fn().mockReturnValue(true),
    canArchiveCase: vi.fn().mockReturnValue(true),
    requireCaseAccess: vi.fn(),
  };
});
vi.mock('@/lib/audit/createAuditLog', () => ({
  createAuditLog: vi.fn(),
}));
vi.mock('@/lib/auth/getUserProfile', () => ({
  getUserProfile: vi.fn(),
}));
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}));

import { createCase, updateCaseStatus } from './actions';
import { createClient } from '@/lib/supabase/server';
import { getUserProfile } from '@/lib/auth/getUserProfile';

describe('T-AUD-P2-016: Validación estricta de estados de casos (Writable Statuses)', () => {
  const mockInsert = vi.fn();
  const mockUpdate = vi.fn();
  const mockSelect = vi.fn();
  const mockEq = vi.fn();
  const mockMaybeSingle = vi.fn();
  const mockFrom = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(getUserProfile).mockResolvedValue({
      user: { id: 'user-123' },
      profile: { organization_id: 'org-123', role: 'admin' },
    } as any);

    mockFrom.mockReturnValue({
      select: mockSelect,
      insert: mockInsert,
      update: mockUpdate,
    });
    mockSelect.mockReturnValue({
      eq: mockEq,
      single: vi.fn(),
    });
    mockEq.mockReturnValue({
      maybeSingle: mockMaybeSingle,
      eq: mockEq,
    });
    mockInsert.mockReturnValue({
      select: vi.fn().mockReturnValue({ single: vi.fn().mockResolvedValue({ data: { id: 'case-new' }, error: null }) }),
    });
    mockUpdate.mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
    });

    vi.mocked(createClient).mockResolvedValue({
      from: mockFrom,
    } as any);
  });

  describe('getWritableCaseStatuses helper', () => {
    it('devuelve únicamente los valores canónicos para legal, escribanía e inmobiliaria', () => {
      const legalStatuses = getWritableCaseStatuses('legal');
      expect(legalStatuses).toContain('active');
      expect(legalStatuses).toContain('in_review');
      expect(legalStatuses).toContain('new');
      expect(legalStatuses).not.toContain('activo');
      expect(legalStatuses).not.toContain('en_tramite');

      const escribaniaStatuses = getWritableCaseStatuses('escribania');
      expect(escribaniaStatuses).toContain('active');
      expect(escribaniaStatuses).not.toContain('activo');

      const inmobStatuses = getWritableCaseStatuses('inmobiliaria');
      expect(inmobStatuses).toContain('active');
      expect(inmobStatuses).not.toContain('activo');
    });
  });

  describe('createCase validación estricta', () => {
    it('1. Rechaza estado legacy "activo" sin convertirlo silenciosamente', async () => {
      mockMaybeSingle.mockResolvedValue({
        data: { industry_type: 'legal' },
        error: null,
      });

      const formData = new FormData();
      formData.append('title', 'Caso Test');
      formData.append('case_type', 'Demanda');
      formData.append('status', 'activo');

      await expect(createCase(formData)).rejects.toThrow('NEXT_REDIRECT:/expedientes/nuevo?error=invalid_status');
      expect(mockInsert).not.toHaveBeenCalled();
    });

    it('2. Rechaza estado inexistente o manipulado', async () => {
      mockMaybeSingle.mockResolvedValue({
        data: { industry_type: 'legal' },
        error: null,
      });

      const formData = new FormData();
      formData.append('title', 'Caso Test');
      formData.append('case_type', 'Demanda');
      formData.append('status', 'invalido_total');

      await expect(createCase(formData)).rejects.toThrow('NEXT_REDIRECT:/expedientes/nuevo?error=invalid_status');
      expect(mockInsert).not.toHaveBeenCalled();
    });

    it('3. Acepta estado canónico permitido ("active")', async () => {
      mockMaybeSingle.mockResolvedValue({
        data: { industry_type: 'legal' },
        error: null,
      });

      const formData = new FormData();
      formData.append('title', 'Caso Test');
      formData.append('case_type', 'Demanda');
      formData.append('status', 'active');

      await expect(createCase(formData)).rejects.toThrow('NEXT_REDIRECT:/expedientes/case-new');
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'active',
        })
      );
    });
  });

  describe('updateCaseStatus validación estricta', () => {
    it('4. Rechaza en updateCaseStatus estado legacy "activo"', async () => {
      mockMaybeSingle.mockResolvedValue({
        data: { industry_type: 'legal' },
        error: null,
      });

      const formData = new FormData();
      formData.append('case_id', 'case-1');
      formData.append('status', 'activo');

      await expect(updateCaseStatus(formData)).rejects.toThrow('NEXT_REDIRECT:/expedientes/case-1?error=invalid_status');
      expect(mockUpdate).not.toHaveBeenCalled();
    });

    it('5. Rechaza en updateCaseStatus estado no soportado', async () => {
      mockMaybeSingle.mockResolvedValue({
        data: { industry_type: 'legal' },
        error: null,
      });

      const formData = new FormData();
      formData.append('case_id', 'case-1');
      formData.append('status', 'estado_no_permitido');

      await expect(updateCaseStatus(formData)).rejects.toThrow('NEXT_REDIRECT:/expedientes/case-1?error=invalid_status');
      expect(mockUpdate).not.toHaveBeenCalled();
    });

    it('6. Acepta estado canónico permitido ("in_review") en updateCaseStatus', async () => {
      mockMaybeSingle.mockResolvedValue({
        data: { industry_type: 'legal' },
        error: null,
      });

      const formData = new FormData();
      formData.append('case_id', 'case-1');
      formData.append('status', 'in_review');

      await expect(updateCaseStatus(formData)).rejects.toThrow('NEXT_REDIRECT:/expedientes/case-1');
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'in_review',
        })
      );
    });
  });
});
