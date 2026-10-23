import { redirect } from 'next/navigation';
import { AppShell } from '@/components/layout/AppShell';
import { getUserProfile } from '@/lib/auth/getUserProfile';
import { canManageClient } from '@/lib/permissions/roles';
import {ClientRecordForm} from '@/components/approved/forms/ClientRecordForm';
import {FormPage} from '@/components/approved/forms/FormParts';
import { createClientRecord } from '../actions';

export default async function NuevoClientePage() {
  const { user, profile } = await getUserProfile();

  if (!user) redirect('/login');
  if (!profile) redirect('/onboarding');
  if (!canManageClient(profile.role)) redirect('/clientes');

  return <AppShell><FormPage backHref="/clientes" backLabel="Clientes" title="Registrar nuevo cliente" eyebrow="CLIENTES" description="Cargá sus datos de contacto y definí qué está buscando."><ClientRecordForm action={createClientRecord}/></FormPage></AppShell>;
}
