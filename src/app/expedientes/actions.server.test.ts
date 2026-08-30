import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

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

import { linkChecklistItemDocument, toggleChecklistItem, removeChecklistItem } from './actions';

describe('Checklist mutations (T-AUD-P1-006)', () => {
  const mockUpdate = vi.fn();
  const mockDelete = vi.fn();
  const mockSelect = vi.fn();
  const mockEq = vi.fn();
  const mockMaybeSingle = vi.fn();
  const mockFrom = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(getUserProfile).mockResolvedValue({
      user: { id: 'user-1' },
      profile: { organization_id: 'org-1', role: 'admin' }
    } as any);

    mockUpdate.mockReturnValue({ eq: mockEq });
    mockDelete.mockReturnValue({ eq: mockEq });

    mockFrom.mockReturnValue({
      select: mockSelect,
      update: mockUpdate,
      delete: mockDelete,
    });
    mockSelect.mockReturnValue({ eq: mockEq });

    vi.mocked(createClient).mockResolvedValue({
      from: mockFrom,
    } as any);
  });

  const setupMockQuery = (responses: any[]) => {
    let callIndex = 0;
    mockEq.mockReturnValue({
      eq: mockEq,
      maybeSingle: vi.fn().mockImplementation(() => {
        const resp = responses[callIndex++] || { data: null, error: null };
        return Promise.resolve(resp);
      })
    });
  };

  it('Rechaza vinculación cruzada de items (item pertenece a otro checklist/case)', async () => {
    setupMockQuery([
      { data: { id: 'item-B', checklist_id: 'check-B', status: 'pending' } },
      { data: { id: 'check-B', case_id: 'case-B' } },
    ]);

    const formData = new FormData();
    formData.append('case_id', 'case-A');
    formData.append('item_id', 'item-B');
    formData.append('document_id', 'doc-A');

    await linkChecklistItemDocument(formData);

    expect(mockUpdate).not.toHaveBeenCalled();
    expect(createAuditLog).not.toHaveBeenCalled();
  });

  it('Rechaza vinculación cruzada de document (doc pertenece a otro case)', async () => {
    setupMockQuery([
      { data: { id: 'item-A', checklist_id: 'check-A', status: 'pending' } },
      { data: { id: 'check-A', case_id: 'case-A' } },
      { data: { id: 'doc-B', case_id: 'case-B' } },
    ]);

    const formData = new FormData();
    formData.append('case_id', 'case-A');
    formData.append('item_id', 'item-A');
    formData.append('document_id', 'doc-B');

    await linkChecklistItemDocument(formData);

    expect(mockUpdate).not.toHaveBeenCalled();
    expect(createAuditLog).not.toHaveBeenCalled();
  });

  it('Operación positiva: vinculación válida', async () => {
    setupMockQuery([
      { data: { id: 'item-A', checklist_id: 'check-A', status: 'pending' } },
      { data: { id: 'check-A', case_id: 'case-A' } },
      { data: { id: 'doc-A', case_id: 'case-A' } },
    ]);

    const formData = new FormData();
    formData.append('case_id', 'case-A');
    formData.append('item_id', 'item-A');
    formData.append('document_id', 'doc-A');

    await expect(linkChecklistItemDocument(formData)).rejects.toThrow('NEXT_REDIRECT');

    expect(mockUpdate).toHaveBeenCalled();
  });

  it('Rechaza desvinculación (removeChecklistItem) cruzada', async () => {
    setupMockQuery([
      { data: { id: 'item-B', checklist_id: 'check-B', status: 'pending' } },
      { data: { id: 'check-B', case_id: 'case-B' } },
    ]);

    const formData = new FormData();
    formData.append('case_id', 'case-A');
    formData.append('item_id', 'item-B');

    await removeChecklistItem(formData);

    expect(mockDelete).not.toHaveBeenCalled();
    expect(createAuditLog).not.toHaveBeenCalled();
  });

  it('Rechaza toggle (toggleChecklistItem) cruzada', async () => {
    setupMockQuery([
      { data: { id: 'item-B', checklist_id: 'check-B', status: 'pending' } },
      { data: { id: 'check-B', case_id: 'case-B' } },
    ]);

    const formData = new FormData();
    formData.append('case_id', 'case-A');
    formData.append('item_id', 'item-B');

    await toggleChecklistItem(formData);

    expect(mockUpdate).not.toHaveBeenCalled();
    expect(createAuditLog).not.toHaveBeenCalled();
  });

  it('Operación positiva: toggle válida', async () => {
    setupMockQuery([
      { data: { id: 'item-A', checklist_id: 'check-A', status: 'pending' } },
      { data: { id: 'check-A', case_id: 'case-A' } },
    ]);

    const formData = new FormData();
    formData.append('case_id', 'case-A');
    formData.append('item_id', 'item-A');

    await toggleChecklistItem(formData);

    expect(mockUpdate).toHaveBeenCalled();
    expect(createAuditLog).toHaveBeenCalledTimes(1);
    expect(vi.mocked(createAuditLog).mock.calls[0][0].resourceId).toBe('case-A');
  });

  it('Falla cerrada si el item no existe', async () => {
    setupMockQuery([
      { data: null, error: null }
    ]);

    const formData = new FormData();
    formData.append('case_id', 'case-A');
    formData.append('item_id', 'item-X');

    await toggleChecklistItem(formData);

    expect(mockUpdate).not.toHaveBeenCalled();
    expect(createAuditLog).not.toHaveBeenCalled();
  });
});
