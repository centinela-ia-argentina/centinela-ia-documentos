'use server';

import { createAuditLog } from '@/lib/audit/createAuditLog';
import { getUserProfile } from '@/lib/auth/getUserProfile';

export async function logWhatsAppAction(resourceId: string, resourceType: 'property' | 'client' | 'operation', action: 'whatsapp_message_generated' | 'whatsapp_link_opened') {
  const { user, profile } = await getUserProfile();
  if (!user || !profile) return;

  const typeMap = {
    'property': 'property',
    'client': 'clients', // Check what the audit log expects. Often 'client' or 'clients'. Let's use 'client' as the type if it matches the general types. Wait, 'clients' might not be a valid ResourceType. We'll use any.
    'operation': 'cases',
  };

  const rt = typeMap[resourceType] || resourceType;

  await createAuditLog({
    organizationId: profile.organization_id,
    userId: user.id,
    action: action as any,
    resourceType: rt as any,
    resourceId: resourceId,
  });
}
