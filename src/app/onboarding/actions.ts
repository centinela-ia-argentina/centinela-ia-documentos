'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export async function createOrganization(formData: FormData) {
  const orgName = String(formData.get('org_name') || '').trim();
  const industry = String(formData.get('industry') || '').trim();
  const city = String(formData.get('city') || 'Corrientes').trim();
  const province = String(formData.get('province') || 'Corrientes').trim();
  const adminName = String(formData.get('admin_full_name') || '').trim();

  const selectableIndustries = ['legal', 'escribania', 'inmobiliaria'];
  if (!orgName || !adminName || !selectableIndustries.includes(industry)) {
    redirect('/onboarding?error=invalid_input');
  }

  const supabase = await createClient();

  const { error } = await supabase.rpc('create_organization_with_admin', {
    org_name: orgName,
    org_industry: industry,
    org_city: city,
    org_province: province,
    admin_full_name: adminName,
  });

  if (error) {
    console.error('Onboarding error:', error);
    redirect('/onboarding?error=onboarding_failed');
  }

  redirect('/dashboard');
}