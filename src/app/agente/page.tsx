import { redirect } from 'next/navigation';
import { AppShell } from '@/components/layout/AppShell';
import { createClient } from '@/lib/supabase/server';
import { getUserProfile } from '@/lib/auth/getUserProfile';
import { normalizeIndustryType } from '@/lib/industries/documentTypes';
import { canUseAi, isReadOnlyRole } from '@/lib/permissions/roles';
import { AgenteGlobalChat } from './AgenteGlobalChat';

export default async function AgentePage() {
  const { user, profile } = await getUserProfile();
  if (!user) redirect('/login');
  if (!profile) redirect('/onboarding');
  if (isReadOnlyRole(profile.role as any)) redirect('/acceso-denegado?motivo=rol');

  const supabase = await createClient();
  const { data: organization } = await supabase
    .from('organizations')
    .select('industry_type')
    .eq('id', profile.organization_id)
    .maybeSingle();

  const industry = normalizeIndustryType(organization?.industry_type);
  const puedeUsarIA = canUseAi(profile.role);

  return (
    <AppShell>
      <div className="mx-auto max-w-6xl py-6">
        <AgenteGlobalChat industry={industry} puedeUsarIA={puedeUsarIA} />
      </div>
    </AppShell>
  );
}
