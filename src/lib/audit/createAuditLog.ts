import { createClient } from '@/lib/supabase/server';

interface CreateAuditLogInput {
  organizationId: string;
  userId: string;
  action: string;
  resourceType?: string;
  resourceId?: string;
  metadata?: Record<string, unknown>;
}

const recentDocumentViews = new Map<string, number>();
const DEDUP_WINDOW_MS = 45_000;

export function _clearDocumentViewedCache(): void {
  recentDocumentViews.clear();
}

export async function createAuditLog(input: CreateAuditLogInput): Promise<{ ok: boolean }> {
  try {
    if (input.action === 'document_viewed' && input.resourceId) {
      const key = `${input.organizationId}:${input.userId}:${input.resourceId}`;
      const now = Date.now();
      const prev = recentDocumentViews.get(key);
      if (prev && now - prev < DEDUP_WINDOW_MS) {
        return { ok: true };
      }
      recentDocumentViews.set(key, now);
      if (recentDocumentViews.size > 1000) {
        for (const [k, ts] of recentDocumentViews.entries()) {
          if (now - ts > DEDUP_WINDOW_MS * 2) recentDocumentViews.delete(k);
        }
      }
    }

    const supabase = await createClient();

    const { error } = await supabase.from('audit_logs').insert({
      organization_id: input.organizationId,
      user_id: input.userId,
      action: input.action,
      resource_type: input.resourceType,
      resource_id: input.resourceId,
      metadata: input.metadata ?? {},
    });

    if (error) {
      console.error('AuditLog insert error:', {
        code: error.code,
        action: input.action,
        resourceType: input.resourceType,
        resourceId: input.resourceId,
      });
      return { ok: false };
    }

    return { ok: true };
  } catch (err: any) {
    console.error('AuditLog unexpected error:', {
      code: err?.code || 'UNKNOWN',
      action: input.action,
      resourceType: input.resourceType,
      resourceId: input.resourceId,
    });
    return { ok: false };
  }
}
