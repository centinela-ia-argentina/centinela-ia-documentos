import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('next/navigation', () => ({
  redirect: vi.fn().mockImplementation(() => {
    throw new Error('NEXT_REDIRECT');
  }),
  revalidatePath: vi.fn(),
}));

vi.mock('@/lib/permissions/roles', async (importOriginal) => {
  const actual = await importOriginal<any>();
  return {
    ...actual,
    requireCaseAccess: vi.fn(),
  };
});

vi.mock('@/lib/supabase/server', () => {
  return {
    createClient: vi.fn(),
  };
});

vi.mock('@/lib/audit/createAuditLog', () => ({
  createAuditLog: vi.fn(),
}));

vi.mock('@/lib/auth/getUserProfile', () => ({
  getUserProfile: vi.fn(),
}));

import { createCase } from './actions';
import { createClient } from '@/lib/supabase/server';
import { createAuditLog } from '@/lib/audit/createAuditLog';
import { getUserProfile } from '@/lib/auth/getUserProfile';

describe('createCase Server Action', () => {
  const mockInsert = vi.fn();
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
    });
    mockSelect.mockReturnValue({
      eq: mockEq,
      single: vi.fn(),
    });
    mockEq.mockReturnValue({
      maybeSingle: mockMaybeSingle,
    });
    mockInsert.mockReturnValue({
      select: vi.fn().mockReturnValue({ single: vi.fn() }),
    });

    vi.mocked(createClient).mockResolvedValue({
      from: mockFrom,
    } as any);
  });

  it('Debe abortar si el case_type es inválido para la industria (ej. legal + Escritura)', async () => {
    const { redirect } = await import('next/navigation');

    mockMaybeSingle.mockResolvedValue({
      data: { industry_type: 'legal' },
      error: null,
    });

    const formData = new FormData();
    formData.append('title', 'Caso de prueba');
    formData.append('case_type', 'Escritura'); // Invalid for legal

    await expect(createCase(formData)).rejects.toThrow('NEXT_REDIRECT');

    expect(redirect).toHaveBeenCalledWith('/expedientes/nuevo?error=invalid_case_type');
    expect(mockInsert).not.toHaveBeenCalled();
    expect(createAuditLog).not.toHaveBeenCalled();
  });

  it('Debe abortar con invalid_industry si falla la consulta de organization', async () => {
    const { redirect } = await import('next/navigation');

    mockMaybeSingle.mockResolvedValue({
      data: null,
      error: { message: 'Not found' },
    });

    const formData = new FormData();
    formData.append('title', 'Caso de prueba');
    formData.append('case_type', 'Demanda');

    await expect(createCase(formData)).rejects.toThrow('NEXT_REDIRECT');

    expect(redirect).toHaveBeenCalledWith('/expedientes/nuevo?error=invalid_industry');
    expect(mockInsert).not.toHaveBeenCalled();
    expect(createAuditLog).not.toHaveBeenCalled();
  });
});
