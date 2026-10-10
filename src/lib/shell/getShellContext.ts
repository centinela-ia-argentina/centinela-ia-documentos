import { cache } from 'react';
import { getUserProfile } from '@/lib/auth/getUserProfile';
import { isUserRole } from '@/lib/permissions/roles';
import { createClient } from '@/lib/supabase/server';
import {
  normalizeIndustryType,
  type IndustryType,
} from '@/lib/industries/documentTypes';

export interface ShellContext {
  profile: Awaited<ReturnType<typeof getUserProfile>>['profile'];
  role: string | null;
  industry: IndustryType;
  organizationName: string | null;
}

export const getShellContext = cache(async (): Promise<ShellContext> => {
  const { profile } = await getUserProfile();
  const role = isUserRole(profile?.role) ? profile.role : null;

  let industry: IndustryType = 'general';
  let organizationName: string | null = null;

  if (profile?.organization_id) {
    const supabase = await createClient();
    const { data: organization } = await supabase
      .from('organizations')
      .select('name, industry_type')
      .eq('id', profile.organization_id)
      .maybeSingle();

    industry = normalizeIndustryType(organization?.industry_type);
    organizationName = organization?.name?.trim() || null;
  }

  return { profile, role, industry, organizationName };
});