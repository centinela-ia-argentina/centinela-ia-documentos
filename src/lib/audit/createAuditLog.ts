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
    const isDedupAction = input.action === 'document_viewed' && Boolean(input.resourceId);
    const key = isDedupAction ? `${input.organizationId}:${input.userId}:${input.resourceId}` : null;
    const now = Date.now();

    if (isDedupAction && key) {
      // 1) L1 Fast-path: Memoria del proceso local
      const prev = recentDocumentViews.get(key);
      if (prev && now - prev < DEDUP_WINDOW_MS) {
        return { ok: true };
      }
    }

    const supabase = await createClient();

    if (isDedupAction && key) {
      // 2) L2 Consulta server-side persistente para aislamiento e idempotencia entre instancias serverless
      const cutoff = new Date(now - DEDUP_WINDOW_MS).toISOString();
      const { data: existing } = await supabase
        .from('audit_logs')
        .select('id')
        .eq('organization_id', input.organizationId)
        .eq('user_id', input.userId)
        .eq('action', input.action)
        .eq('resource_id', input.resourceId!)
        .gte('created_at', cutoff)
        .limit(1)
        .maybeSingle();

      if (existing) {
        recentDocumentViews.set(key, now);
        return { ok: true };
      }

      recentDocumentViews.set(key, now);
      if (recentDocumentViews.size > 1000) {
        for (const [k, ts] of recentDocumentViews.entries()) {
          if (now - ts > DEDUP_WINDOW_MS * 2) recentDocumentViews.delete(k);
        }
      }
    }

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
