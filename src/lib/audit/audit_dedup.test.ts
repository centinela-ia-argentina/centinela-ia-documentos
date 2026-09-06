import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createAuditLog, _clearDocumentViewedCache } from './createAuditLog';

const mockInsert = vi.fn().mockResolvedValue({ error: null });

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({
    from: vi.fn().mockReturnValue({
      insert: (...args: any[]) => mockInsert(...args),
    }),
  }),
}));

describe('Auditoría - Deduplicación de document_viewed', () => {
  beforeEach(() => {
    mockInsert.mockClear();
    _clearDocumentViewedCache();
  });

  it('registra el primer document_viewed', async () => {
    const res = await createAuditLog({
      organizationId: 'org-1',
      userId: 'user-1',
      action: 'document_viewed',
      resourceType: 'document',
      resourceId: 'doc-1',
    });

    expect(res.ok).toBe(true);
    expect(mockInsert).toHaveBeenCalledTimes(1);
  });

  it('deduplica y no inserta segundo document_viewed para el mismo documento y usuario en ventana corta', async () => {
    await createAuditLog({
      organizationId: 'org-1',
      userId: 'user-1',
      action: 'document_viewed',
      resourceType: 'document',
      resourceId: 'doc-1',
    });

    // Segundo view inmediato
    const res2 = await createAuditLog({
      organizationId: 'org-1',
      userId: 'user-1',
      action: 'document_viewed',
      resourceType: 'document',
      resourceId: 'doc-1',
    });

    expect(res2.ok).toBe(true);
    expect(mockInsert).toHaveBeenCalledTimes(1); // No incrementó
  });

  it('no deduplica si el documento es diferente', async () => {
    await createAuditLog({
      organizationId: 'org-1',
      userId: 'user-1',
      action: 'document_viewed',
      resourceType: 'document',
      resourceId: 'doc-1',
    });

    await createAuditLog({
      organizationId: 'org-1',
      userId: 'user-1',
      action: 'document_viewed',
      resourceType: 'document',
      resourceId: 'doc-2',
    });

    expect(mockInsert).toHaveBeenCalledTimes(2);
  });

  it('no deduplica acciones distintas de document_viewed', async () => {
    await createAuditLog({
      organizationId: 'org-1',
      userId: 'user-1',
      action: 'case_created',
      resourceType: 'case',
      resourceId: 'case-1',
    });

    await createAuditLog({
      organizationId: 'org-1',
      userId: 'user-1',
      action: 'case_created',
      resourceType: 'case',
      resourceId: 'case-1',
    });

    expect(mockInsert).toHaveBeenCalledTimes(2);
  });
});
