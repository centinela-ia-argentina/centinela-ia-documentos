import { redirect } from 'next/navigation';
import { AppShell } from '@/components/layout/AppShell';
import { getUserProfile } from '@/lib/auth/getUserProfile';
import { createClient } from '@/lib/supabase/server';
import { normalizeIndustryType } from '@/lib/industries/documentTypes';
import { CalculadorasClient } from './CalculadorasClient';
import { CalculadorasNotarialesClient } from './CalculadorasNotarialesClient';

export default async function CalculadorasPage() {
  const { user, profile } = await getUserProfile();
  if (!user) redirect('/login');
  if (!profile) redirect('/onboarding');

  const supabase = await createClient();
  const { data: org } = await supabase
    .from('organizations')
    .select('industry_type')
    .eq('id', profile.organization_id)
    .maybeSingle();
  const industry = normalizeIndustryType(org?.industry_type);
  const puedeGuardar = profile.role === 'admin' || profile.role === 'employee';

  return (
    <AppShell>
      {industry === 'escribania' ? (
        <CalculadorasNotarialesClient />
      ) : (
        <CalculadorasClient puedeGuardar={puedeGuardar} />
      )}
    </AppShell>
  );
}
