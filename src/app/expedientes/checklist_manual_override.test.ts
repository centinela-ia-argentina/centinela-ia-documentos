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

import { autoMarcarChecklist, linkChecklistItemDocument } from './actions';
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

    const checklistItemsEqOrg = vi.fn().mockResolvedValue({ data: itemsData });
    const checklistItemsEqCheck = vi.fn().mockReturnValue({ eq: checklistItemsEqOrg });

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
            eq: checklistItemsEqCheck,
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

    // Defensive check: organization_id was filtered in checklist_items query
    expect(checklistItemsEqOrg).toHaveBeenCalledWith('organization_id', 'org-1');

    // item-manual must NOT have been unlinked
    const updateCalls = mockUpdate.mock.calls;
    for (const call of updateCalls) {
      expect(call[0]).not.toEqual(expect.objectContaining({ document_id: null }));
    }

    // Auto-match marks candidate item with match_source: 'automatic'
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        document_id: 'doc-dni',
        match_source: 'automatic',
        status: 'received',
      })
    );

    // Defensive check: organization_id was filtered on update
    expect(mockEq).toHaveBeenCalledWith('organization_id', 'org-1');

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

  it('linkChecklistItemDocument sets match_source="manual" when linking and null when unlinking', async () => {
    const itemData = { id: 'item-1', checklist_id: 'check-1', status: 'pending' };
    const docData = { id: 'doc-1', file_name: 'DNI.pdf', case_id: 'case-1' };

    fromHandler = vi.fn((table: string) => {
      if (table === 'checklist_items') {
        const query: any = {
          eq: vi.fn().mockImplementation(() => query),
          maybeSingle: vi.fn().mockResolvedValue({ data: itemData }),
        };
        return {
          select: vi.fn().mockReturnValue(query),
          update: mockUpdate,
        };
      }
      if (table === 'checklists') {
        const query: any = {
          eq: vi.fn().mockImplementation(() => query),
          order: vi.fn().mockImplementation(() => query),
          limit: vi.fn().mockImplementation(() => query),
          maybeSingle: vi.fn().mockResolvedValue({ data: { id: 'check-1', case_id: 'case-1' } }),
        };
        return {
          select: vi.fn().mockReturnValue(query),
        };
      }
      if (table === 'documents') {
        const query: any = {
          eq: vi.fn().mockImplementation(() => query),
          maybeSingle: vi.fn().mockResolvedValue({ data: docData }),
        };
        return {
          select: vi.fn().mockReturnValue(query),
        };
      }
      return {};
    });

    vi.mocked(createClient).mockResolvedValue({ from: fromHandler } as any);

    // 1. Manual link
    const linkForm = new FormData();
    linkForm.append('case_id', 'case-1');
    linkForm.append('item_id', 'item-1');
    linkForm.append('document_id', 'doc-1');

    await expect(linkChecklistItemDocument(linkForm)).rejects.toThrow('NEXT_REDIRECT');

    expect(mockUpdate).toHaveBeenCalledWith({
      document_id: 'doc-1',
      match_source: 'manual',
      status: 'received',
    });

    // 2. Unlink
    mockUpdate.mockClear();
    const unlinkForm = new FormData();
    unlinkForm.append('case_id', 'case-1');
    unlinkForm.append('item_id', 'item-1');
    unlinkForm.append('document_id', '');

    await expect(linkChecklistItemDocument(unlinkForm)).rejects.toThrow('NEXT_REDIRECT');

    expect(mockUpdate).toHaveBeenCalledWith({
      document_id: null,
      match_source: null,
      status: 'pending',
    });
  });
});
