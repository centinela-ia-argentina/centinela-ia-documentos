import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { getUserProfile } from './getUserProfile';
import {
  isActiveIndustryType,
  type IndustryType,
} from '@/lib/industries/documentTypes';

export async function getStrictIndustryForOrganization(organizationId: string): Promise<IndustryType> {
  if (!organizationId) {
    throw new Error('Unauthorized: No active user, profile, or organization.');
  }

  const supabase = await createClient();
  const { data: org, error } = await supabase
    .from('organizations')
    .select('industry_type')
    .eq('id', organizationId)
    .single();

  if (error || !org || !org.industry_type) {
    throw new Error('Unauthorized: Organization or industry_type not found.');
  }

  if (!isActiveIndustryType(org.industry_type)) {
    throw new Error('Unauthorized: Unsupported organization industry.');
  }

  return org.industry_type;
}

export async function getStrictIndustry(): Promise<IndustryType> {
  const { user, profile } = await getUserProfile();
  if (!user || !profile || !profile.organization_id) {
    throw new Error('Unauthorized: No active user, profile, or organization.');
  }
  return getStrictIndustryForOrganization(profile.organization_id);
}
