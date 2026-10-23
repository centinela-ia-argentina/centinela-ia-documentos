import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { AppShell } from '@/components/layout/AppShell';
import { createClient } from '@/lib/supabase/server';
import { getUserProfile } from '@/lib/auth/getUserProfile';
import { canManageClient } from '@/lib/permissions/roles';
import { updateClientRecord } from '../actions';
import { ArrowLeft, User } from 'lucide-react';
import { ClientDetailMode } from '@/components/approved/ClientDetailMode';
import { ClientDetailReadView } from '@/components/approved/ClientDetailReadView';
import styles from '@/components/approved/ApprovedDetail.module.css';
import {ClientRecordForm} from '@/components/approved/forms/ClientRecordForm';
import { getClientStatusLabel, getClientTypeLabel } from '@/lib/clients/labels';
import type { ClientRecord } from '@/types/client';
import type { PropertyRecord } from '@/types/property';
import { evaluarMatch, ordenarPorMatch } from '@/lib/matching/match';
import { canUseAi } from '@/lib/permissions/roles';
import { ClientMatchAiButton } from './ClientMatchAiButton';
import { WhatsAppIntentBuilder } from '@/components/WhatsAppIntentBuilder';
import { generateClientMessage } from '@/lib/whatsapp';

export default async function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, profile } = await getUserProfile();

  if (!user) redirect('/login');
  if (!profile) redirect('/onboarding');
  if (profile.role === 'client') redirect('/acceso-denegado');

  const supabase = await createClient();

  const { data: clientData, error } = await supabase
    .from('clients')
    .select('*')
    .eq('id', id)
    .eq('organization_id', profile.organization_id)
    .single();

  if (error || !clientData) {
    notFound();
  }

  const record = clientData as ClientRecord;
  const canManage = canManageClient(profile.role);

  // MATCHING FLEXIBLE: Buscar propiedades que encajen
  const { data: propertiesData } = await supabase
    .from('properties')
    .select('*')
    .eq('organization_id', profile.organization_id)
    .is('archived_at', null)
    .eq('status', 'disponible');

  const properties = (propertiesData || []) as PropertyRecord[];
  
  const matches = properties
    .map(p => ({ item: p, match: evaluarMatch(record, p) }))
    .filter(m => m.match.elegible);
  
  const sortedMatches = ordenarPorMatch(matches);

  return (
    <AppShell>
      <Link href="/clientes" className="mb-5 inline-flex min-h-11 items-center gap-2 text-sm text-slate-300 hover:text-white"><ArrowLeft size={16} aria-hidden="true" />Volver a clientes</Link>
      <ClientDetailMode name={record.name} canManage={canManage}
        identity={<div className={styles.identity}><span className={styles.avatar}><User size={32} aria-hidden="true" /></span><div><p className={styles.eyebrow}>Ficha de cliente</p><h1>{record.name}</h1><div className={styles.identityTags}><span>{getClientStatusLabel(record.status)}</span><span>{getClientTypeLabel(record.client_type)}</span></div></div></div>}
        editForm={canManage ? (
          <ClientRecordForm action={updateClientRecord} record={record}/>
        ) : null}
      >
        <ClientDetailReadView record={record} matches={sortedMatches}
          aiAction={canUseAi(profile.role) && sortedMatches.length > 0 ? <ClientMatchAiButton clientId={id} /> : null}
          contactMessage={<WhatsAppIntentBuilder compact phone={record.phone} context="client" resourceId={record.id} defaultMessage={generateClientMessage(record)} />}
        />
      </ClientDetailMode>
    </AppShell>
  );
}
