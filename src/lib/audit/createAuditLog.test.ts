import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createAuditLog } from './createAuditLog';
import * as serverModule from '@/lib/supabase/server';

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}));

describe('createAuditLog', () => {
  const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns { ok: true } on success', async () => {
    const mockInsert = vi.fn().mockResolvedValue({ error: null });
    const mockFrom = vi.fn().mockReturnValue({ insert: mockInsert });
    vi.mocked(serverModule.createClient).mockResolvedValue({
      from: mockFrom,
    } as any);

    const result = await createAuditLog({
      organizationId: 'org-1',
      userId: 'user-1',
      action: 'test_action',
    });

    expect(result).toEqual({ ok: true });
    expect(mockFrom).toHaveBeenCalledWith('audit_logs');
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });

  it('returns { ok: false } and logs safe details on Supabase error', async () => {
    const mockInsert = vi.fn().mockResolvedValue({
      error: { code: '23505', message: 'Secret internal DB error' },
    });
    vi.mocked(serverModule.createClient).mockResolvedValue({
      from: () => ({ insert: mockInsert }),
    } as any);

    const result = await createAuditLog({
      organizationId: 'org-1',
      userId: 'user-1',
      action: 'test_action',
      resourceType: 'doc',
      resourceId: 'doc-1',
      metadata: { secret: 'do-not-log' },
    });

    expect(result).toEqual({ ok: false });
    expect(consoleErrorSpy).toHaveBeenCalledWith('AuditLog insert error:', {
      code: '23505',
      action: 'test_action',
      resourceType: 'doc',
      resourceId: 'doc-1',
    });
    // Ensure metadata is not logged
    expect(consoleErrorSpy.mock.calls[0][1]).not.toHaveProperty('metadata');
  });

  it('returns { ok: false } and catches exceptions', async () => {
    vi.mocked(serverModule.createClient).mockRejectedValue(new Error('Network failure'));

    const result = await createAuditLog({
      organizationId: 'org-1',
      userId: 'user-1',
      action: 'test_action',
    });

    expect(result).toEqual({ ok: false });
    expect(consoleErrorSpy).toHaveBeenCalledWith('AuditLog unexpected error:', expect.objectContaining({
      action: 'test_action',
    }));
  });
});
