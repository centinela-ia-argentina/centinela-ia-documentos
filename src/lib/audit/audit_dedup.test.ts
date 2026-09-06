import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createAuditLog, _clearDocumentViewedCache } from './createAuditLog';

const mockInsert = vi.fn().mockResolvedValue({ error: null });
let mockExistingInDb: any = null;
let lastDbQueryFilters: Record<string, any> = {};

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockImplementation(() => ({
    from: vi.fn((table: string) => {
      if (table === 'audit_logs') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn((col1: string, val1: string) => {
              lastDbQueryFilters[col1] = val1;
              return {
                eq: vi.fn((col2: string, val2: string) => {
                  lastDbQueryFilters[col2] = val2;
                  return {
                    eq: vi.fn((col3: string, val3: string) => {
                      lastDbQueryFilters[col3] = val3;
                      return {
                        eq: vi.fn((col4: string, val4: string) => {
                          lastDbQueryFilters[col4] = val4;
                          return {
                            gte: vi.fn((col5: string, val5: string) => {
                              lastDbQueryFilters[col5] = val5;
                              return {
                                limit: vi.fn().mockReturnValue({
                                  maybeSingle: vi.fn().mockImplementation(() => {
                                    return Promise.resolve({ data: mockExistingInDb, error: null });
                                  }),
                                }),
                              };
                            }),
                          };
                        }),
                      };
                    }),
                  };
                }),
              };
            }),
          }),
          insert: (...args: any[]) => mockInsert(...args),
        };
      }
      return {} as any;
    }),
  })),
}));

describe('Auditoría - Deduplicación Híbrida (Memoria L1 + DB L2 Server-Side)', () => {
  beforeEach(() => {
    mockInsert.mockClear();
    mockExistingInDb = null;
    lastDbQueryFilters = {};
    _clearDocumentViewedCache();
  });

  it('1. registra el primer document_viewed cuando no existe en memoria ni en DB', async () => {
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

  it('2. solicitudes consecutivas del mismo usuario, doc y org: deduplica en memoria (L1) sin insertar en DB', async () => {
    await createAuditLog({
      organizationId: 'org-1',
      userId: 'user-1',
      action: 'document_viewed',
      resourceType: 'document',
      resourceId: 'doc-1',
    });

    // Segunda solicitud consecutiva inmediata
    const res2 = await createAuditLog({
      organizationId: 'org-1',
      userId: 'user-1',
      action: 'document_viewed',
      resourceType: 'document',
      resourceId: 'doc-1',
    });

    expect(res2.ok).toBe(true);
    expect(mockInsert).toHaveBeenCalledTimes(1); // No incrementa
  });

  it('3. deduplica a nivel serverless/DB (L2): si la memoria local está limpia pero existe en la base dentro de la ventana, no reinserta', async () => {
    // Simula que la solicitud llega a otra lambda/instancia (memoria limpia)
    _clearDocumentViewedCache();
    // La base de datos ya tiene un registro reciente
    mockExistingInDb = { id: 'audit-log-existente-en-otra-instancia' };

    const res = await createAuditLog({
      organizationId: 'org-1',
      userId: 'user-1',
      action: 'document_viewed',
      resourceType: 'document',
      resourceId: 'doc-1',
    });

    expect(res.ok).toBe(true);
    expect(mockInsert).not.toHaveBeenCalled(); // No debe insertar duplicado
    expect(lastDbQueryFilters['organization_id']).toBe('org-1');
    expect(lastDbQueryFilters['user_id']).toBe('user-1');
    expect(lastDbQueryFilters['action']).toBe('document_viewed');
    expect(lastDbQueryFilters['resource_id']).toBe('doc-1');
    expect(lastDbQueryFilters['created_at']).toBeDefined();
  });

  it('4. usuarios distintos: NO deduplica (se inserta registro para cada usuario)', async () => {
    await createAuditLog({
      organizationId: 'org-1',
      userId: 'user-1',
      action: 'document_viewed',
      resourceType: 'document',
      resourceId: 'doc-1',
    });

    await createAuditLog({
      organizationId: 'org-1',
      userId: 'user-2',
      action: 'document_viewed',
      resourceType: 'document',
      resourceId: 'doc-1',
    });

    expect(mockInsert).toHaveBeenCalledTimes(2);
  });

  it('5. documentos distintos: NO deduplica (se inserta registro para cada documento)', async () => {
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

  it('6. organizaciones distintas: NO deduplica (aislamiento organizacional multi-tenant)', async () => {
    await createAuditLog({
      organizationId: 'org-1',
      userId: 'user-1',
      action: 'document_viewed',
      resourceType: 'document',
      resourceId: 'doc-1',
    });

    await createAuditLog({
      organizationId: 'org-2',
      userId: 'user-1',
      action: 'document_viewed',
      resourceType: 'document',
      resourceId: 'doc-1',
    });

    expect(mockInsert).toHaveBeenCalledTimes(2);
  });

  it('7. no deduplica acciones distintas de document_viewed', async () => {
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
