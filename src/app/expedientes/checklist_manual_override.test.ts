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

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}));

vi.mock('@/lib/audit/createAuditLog', () => ({
  createAuditLog: vi.fn().mockResolvedValue(true),
}));

vi.mock('@/lib/auth/getUserProfile', () => ({
  getUserProfile: vi.fn(),
}));

import { autoMarcarChecklist } from './actions';
import { createClient } from '@/lib/supabase/server';
import { createAuditLog } from '@/lib/audit/createAuditLog';
import { getUserProfile } from '@/lib/auth/getUserProfile';

describe('C-M3-J-001: Checklist manual match persistence over auto-match', () => {
  const mockUpdate = vi.fn();
  const mockEq = vi.fn();
  let fromHandler: any;

  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(getUserProfile).mockResolvedValue({
      user: { id: 'user-1' } as any,
      profile: { id: 'prof-1', organization_id: 'org-1', role: 'admin' } as any,
    });

    mockUpdate.mockReturnValue({
      eq: mockEq,
    });
    mockEq.mockReturnValue({
      eq: mockEq,
    });
  });

  it('preserves manual overrides: never unlinks or replaces items with match_source="manual"', async () => {
    const checklistData = { id: 'check-1' };
    const itemsData = [
      {
        id: 'item-manual',
        title: 'Boleto de compraventa',
        status: 'received',
        document_id: 'doc-user-chosen',
        match_source: 'manual',
      },
      {
        id: 'item-auto',
        title: 'DNI Comprador',
        status: 'pending',
        document_id: null,
        match_source: null,
      },
    ];
    const docsData = [
      {
        id: 'doc-dni',
        file_name: 'DNI_Comprador.pdf',
        document_type: 'dni',
      },
    ];

    fromHandler = vi.fn((table: string) => {
      if (table === 'checklists') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue({
                  limit: vi.fn().mockReturnValue({
                    maybeSingle: vi.fn().mockResolvedValue({ data: checklistData }),
                  }),
                }),
              }),
            }),
          }),
        };
      }
      if (table === 'checklist_items') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: itemsData }),
          }),
          update: mockUpdate,
        };
      }
      if (table === 'documents') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ data: docsData }),
            }),
          }),
        };
      }
      return {};
    });

    vi.mocked(createClient).mockResolvedValue({ from: fromHandler } as any);

    const formData = new FormData();
    formData.append('case_id', 'case-1');

    await autoMarcarChecklist(formData);

    // item-manual must NOT have been unlinked
    const updateCalls = mockUpdate.mock.calls;
    for (const call of updateCalls) {
      expect(call[0]).not.toEqual(expect.objectContaining({ document_id: null }));
    }

    // Must emit checklist_auto_match_override_skipped
    expect(createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'checklist_auto_match_override_skipped',
        metadata: expect.objectContaining({ skipped_count: 1 }),
      })
    );

    // checklist_auto_matched must record manual_overrides_preserved: 1
    expect(createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'checklist_auto_matched',
        metadata: expect.objectContaining({
          manual_overrides_preserved: 1,
        }),
      })
    );
  });
});
