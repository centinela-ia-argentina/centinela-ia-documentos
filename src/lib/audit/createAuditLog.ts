import { createClient } from '@/lib/supabase/server';

interface CreateAuditLogInput {
  organizationId: string;
  userId: string;
  action: string;
  resourceType?: string;
  resourceId?: string;
  metadata?: Record<string, unknown>;
}

export async function createAuditLog(input: CreateAuditLogInput): Promise<{ ok: boolean }> {
  try {
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
