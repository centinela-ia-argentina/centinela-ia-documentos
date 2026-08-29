import { redirect } from 'next/navigation';
import { AppShell } from '@/components/layout/AppShell';
import { createClient } from '@/lib/supabase/server';
import { getUserProfile } from '@/lib/auth/getUserProfile';
import { ProtocoloClient, type EscrituraProtocolo } from './ProtocoloClient';

export default async function ProtocoloPage() {
  const { user, profile } = await getUserProfile();
  if (!user) redirect('/login');
  if (!profile || profile.status !== 'active') redirect('/onboarding');

  const supabase = await createClient();

  const { data: org } = await supabase
    .from('organizations')
    .select('industry_type')
    .eq('id', profile.organization_id)
    .maybeSingle();

  if (!org || org.industry_type !== 'escribania') {
    redirect('/acceso-denegado');
  }

  const [escriturasResult, casesResult] = await Promise.all([
    supabase
      .from('protocolo_escrituras')
      .select('id, numero, anio, fecha_otorgamiento, tipo_acto, comparecientes, objeto, folio_desde, folio_hasta, observaciones, case_id')
      .eq('organization_id', profile.organization_id)
      .order('anio', { ascending: false })
      .order('numero', { ascending: false }),
    supabase
      .from('cases')
      .select('id, title')
      .eq('organization_id', profile.organization_id)
      .neq('status', 'archived')
      .neq('status', 'Archivado'),
  ]);

  const escrituras = (escriturasResult.data ?? []) as EscrituraProtocolo[];
  const cases = (casesResult.data ?? []).map((c) => ({ id: c.id, title: c.title || 'Expediente sin título' }));

  return (
    <AppShell>
      <ProtocoloClient escrituras={escrituras} cases={cases} />
    </AppShell>
  );
}
