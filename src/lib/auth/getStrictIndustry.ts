import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { getUserProfile } from './getUserProfile';
import { type IndustryType } from '@/lib/industries/documentTypes';

export async function getStrictIndustry(): Promise<IndustryType> {
  const { user, profile } = await getUserProfile();
  
  if (!user || !profile || !profile.organization_id) {
    throw new Error('Unauthorized: No active user, profile, or organization.');
  }

  const supabase = await createClient();
  const { data: org, error } = await supabase
    .from('organizations')
    .select('industry_type')
    .eq('id', profile.organization_id)
    .single();

  if (error || !org || !org.industry_type) {
    throw new Error('Unauthorized: Organization or industry_type not found.');
  }

  const allowedIndustries: IndustryType[] = ['legal', 'inmobiliaria', 'escribania'];
  
  if (!allowedIndustries.includes(org.industry_type as IndustryType)) {
    throw new Error(`Unauthorized: Industry type '${org.industry_type}' is not supported or allowed.`);
  }

  return org.industry_type as IndustryType;
}
