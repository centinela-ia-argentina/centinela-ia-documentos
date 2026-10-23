import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getUserProfile } from '@/lib/auth/getUserProfile';
import { AppShell } from '@/components/layout/AppShell';
import {RentalContractForm} from '@/components/approved/forms/RentalContractForm';
import {FormPage} from '@/components/approved/forms/FormParts';
import { canManageRental, isUserRole } from '@/lib/permissions/roles';
import { createRentalContract } from '../actions';

export default async function NewRentalPage() {
  const { user, profile } = await getUserProfile();
  if (!user) redirect('/login');
  if (!profile) redirect('/onboarding');
  if (!isUserRole(profile.role) || !canManageRental(profile.role)) {
    redirect('/acceso-denegado?motivo=rol&accion=crear');
  }

  const supabase = await createClient();
  const { data: propertiesData } = await supabase
    .from('properties')
    .select('id, name')
    .eq('organization_id', profile.organization_id)
    .is('archived_at', null)
    .order('name');

  const properties = propertiesData || [];

  return <AppShell><FormPage backHref="/alquileres" backLabel="Alquileres" title="Registrar nuevo contrato" eyebrow="ALQUILERES" description="Datos claros, condiciones de ajuste y fechas en un solo lugar."><RentalContractForm action={createRentalContract} properties={properties}/></FormPage></AppShell>;
}
